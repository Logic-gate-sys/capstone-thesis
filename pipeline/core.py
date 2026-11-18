"""Pipeline stages and artifact handling."""

from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import csv
import platform
import random
import sys
import time
import urllib.request
import base64
import mimetypes
from pathlib import Path
from typing import Any, Callable

Report = Callable[..., None]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def find_llama_quantize(explicit: str | None = None) -> str:
    if explicit:
        path = shutil.which(explicit) or (explicit if Path(explicit).is_file() else None)
        if path:
            return str(path)
        raise FileNotFoundError(f"llama-quantize executable not found: {explicit}")

    found = shutil.which("llama-quantize")
    if found:
        return found

    candidates = [
        Path("/usr/local/bin/llama-quantize"),
        Path("/usr/bin/llama-quantize"),
    ]
    for candidate in candidates:
        if candidate.is_file():
            return str(candidate)
    raise FileNotFoundError(
        "llama-quantize was not found. Build llama.cpp or configure executable_path."
    )


def find_llama_server(explicit: str | None = None) -> str:
    if explicit:
        path = shutil.which(explicit) or (explicit if Path(explicit).is_file() else None)
        if path:
            return str(path)
        raise FileNotFoundError(f"llama-server executable not found: {explicit}")
    found = shutil.which("llama-server")
    if found:
        return found
    for candidate in (Path("/usr/local/bin/llama-server"), Path("/usr/bin/llama-server")):
        if candidate.is_file():
            return str(candidate)
    raise FileNotFoundError("llama-server was not found. Configure llama_server.")


def find_llama_convert(explicit: str | None = None) -> str:
    if explicit:
        path = shutil.which(explicit) or (explicit if Path(explicit).is_file() else None)
        if path:
            return str(path)
        raise FileNotFoundError(f"llama conversion tool not found: {explicit}")

    names = ("convert_hf_to_gguf.py", "convert-hf-to-gguf.py")
    for name in names:
        found = shutil.which(name)
        if found:
            return found
    raise FileNotFoundError(
        "Hugging Face to GGUF converter was not found. Configure converter_path."
    )


def wait_for_server(host: str, port: int, timeout: int, process: subprocess.Popen) -> None:
    url = f"http://{host}:{port}/health"
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f"llama-server exited with code {process.returncode}")
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                if response.status == 200:
                    return
        except Exception:
            pass
        time.sleep(0.25)
    raise TimeoutError("llama-server did not become ready")


def encode_image(path: Path) -> str:
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    data = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{data}"


def parse_prediction(raw_text: str) -> dict[str, Any]:
    text = raw_text.strip()
    try:
        candidate = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            try:
                candidate = json.loads(text[start:end + 1])
            except json.JSONDecodeError:
                candidate = None
        else:
            candidate = None
    if not isinstance(candidate, dict):
        return {"predicted": None, "confidence": None, "parse_error": True, "raw": raw_text}

    raw_prediction = candidate.get("infected")
    if isinstance(raw_prediction, bool):
        predicted = int(raw_prediction)
    else:
        value = str(raw_prediction).strip().lower()
        predicted = 1 if value in {"yes", "true", "1", "positive"} else 0 if value in {"no", "false", "0", "negative"} else None
    confidence = None
    try:
        value = float(candidate.get("confidence"))
        if 0.0 <= value <= 1.0:
            confidence = value
    except (TypeError, ValueError):
        pass
    return {
        "predicted": predicted,
        "confidence": confidence,
        "rationale": candidate.get("rationale"),
        "parse_error": predicted is None,
        "raw": raw_text,
    }


def run_inference(
    host: str,
    port: int,
    images_dir: Path,
    labels_csv: Path,
    manifest: dict[str, Any],
    report: Report,
) -> list[dict[str, Any]]:
    prompt = manifest.get(
        "prompt",
        "Respond with ONLY a JSON object containing infected (yes/no), "
        "confidence (0 to 1), and rationale.",
    )
    max_images = manifest.get("max_images")
    rows: list[dict[str, Any]] = []
    with labels_csv.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            rows.append(row)
    if max_images is not None:
        rows = rows[:int(max_images)]

    image_field = manifest.get("image_field", "image_id")
    label_field = manifest.get("label_field", "label")
    positive_labels = {str(value).strip().lower() for value in manifest.get("positive_labels", ["medium", "high", "infection", "infection_ischaemia"])}
    predictions: list[dict[str, Any]] = []
    url = f"http://{host}:{port}/v1/chat/completions"

    for index, row in enumerate(rows, start=1):
        image_name = str(row[image_field]).strip()
        image_path = images_dir / image_name
        if not image_path.is_file():
            predictions.append({
                "image_id": image_name,
                "true_label": None,
                "predicted": None,
                "parse_error": True,
                "error": f"Image not found: {image_path}",
            })
            continue

        raw_label = str(row[label_field]).strip().lower()
        true_label = int(raw_label in positive_labels)
        payload = {
            "model": "model",
            "messages": [{
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": encode_image(image_path)}},
                ],
            }],
            "temperature": float(manifest.get("temperature", 0.0)),
            "max_tokens": int(manifest.get("max_tokens", 160)),
        }
        request = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        started = time.monotonic()
        try:
            with urllib.request.urlopen(request, timeout=int(manifest.get("timeout_seconds", 300))) as response:
                response_data = json.loads(response.read().decode("utf-8"))
            raw_text = response_data["choices"][0]["message"]["content"]
            parsed = parse_prediction(raw_text)
            parsed.update({
                "image_id": image_name,
                "true_label": true_label,
                "latency_seconds": time.monotonic() - started,
                "error": None,
            })
        except Exception as exc:
            parsed = {
                "image_id": image_name,
                "true_label": true_label,
                "predicted": None,
                "confidence": None,
                "rationale": None,
                "parse_error": True,
                "latency_seconds": time.monotonic() - started,
                "error": f"{type(exc).__name__}: {exc}",
            }
        predictions.append(parsed)
        report(
            "progress",
            stage="baseline",
            percent=10 + int(85 * index / len(rows)),
            completed=index,
            total=len(rows),
        )
    return predictions


def wilson_interval(successes: int, total: int, z: float = 1.96) -> list[float] | None:
    if total == 0:
        return None
    proportion = successes / total
    denominator = 1 + z * z / total
    centre = (proportion + z * z / (2 * total)) / denominator
    margin = z * ((proportion * (1 - proportion) / total + z * z / (4 * total * total)) ** 0.5) / denominator
    return [max(0.0, centre - margin), min(1.0, centre + margin)]


def evaluate_predictions(predictions: list[dict[str, Any]], manifest: dict[str, Any]) -> dict[str, Any]:
    valid = [
        item for item in predictions
        if item.get("true_label") in (0, 1) and item.get("predicted") in (0, 1)
    ]
    tp = sum(item["true_label"] == 1 and item["predicted"] == 1 for item in valid)
    tn = sum(item["true_label"] == 0 and item["predicted"] == 0 for item in valid)
    fp = sum(item["true_label"] == 0 and item["predicted"] == 1 for item in valid)
    fn = sum(item["true_label"] == 1 and item["predicted"] == 0 for item in valid)
    positives = tp + fn
    negatives = tn + fp
    sensitivity = tp / positives if positives else None
    specificity = tn / negatives if negatives else None
    accuracy = (tp + tn) / len(valid) if valid else None
    latencies = [item["latency_seconds"] for item in valid if item.get("latency_seconds") is not None]

    result = {
        "n_requested": len(predictions),
        "n_valid_predictions": len(valid),
        "confusion_matrix": {"true_positive": tp, "false_negative": fn, "true_negative": tn, "false_positive": fp},
        "sensitivity": sensitivity,
        "sensitivity_wilson_95": wilson_interval(tp, positives),
        "specificity": specificity,
        "specificity_wilson_95": wilson_interval(tn, negatives),
        "accuracy": accuracy,
        "accuracy_wilson_95": wilson_interval(tp + tn, len(valid)),
        "called_positive_rate": sum(item["predicted"] == 1 for item in valid) / len(valid) if valid else None,
        "latency_seconds": {
            "n": len(latencies),
            "mean": sum(latencies) / len(latencies) if latencies else None,
            "median": sorted(latencies)[len(latencies) // 2] if latencies else None,
        },
        "predictions": predictions,
    }
    return result


def quantize(manifest: dict[str, Any], report: Report) -> dict[str, Any]:
    source = Path(manifest["source"])
    if not source.is_file():
        raise FileNotFoundError(f"Source GGUF not found: {source}")

    target_format = str(manifest.get("format", "")).strip().upper()
    format_map = {
        "Q4": "Q4_K_M",
        "Q4_K_M": "Q4_K_M",
        "Q8": "Q8_0",
        "Q8_0": "Q8_0",
    }
    if target_format not in format_map:
        raise ValueError("Quantization format must be Q4/Q4_K_M or Q8/Q8_0")

    native_format = format_map[target_format]
    artifacts_dir = Path(manifest["artifacts_dir"])
    job_id = manifest["job_id"]
    output = artifacts_dir / job_id / f"{source.stem}-{native_format}.gguf"
    output.parent.mkdir(parents=True, exist_ok=True)

    quantize = find_llama_quantize(manifest.get("executable_path"))
    report("progress", stage="quantize", percent=10, format=native_format)
    process = subprocess.run(
        [quantize, str(source), str(output), native_format],
        check=False,
        capture_output=True,
        text=True,
    )
    if process.returncode != 0:
        raise RuntimeError(
            f"llama-quantize failed ({process.returncode}): "
            f"{process.stderr.strip() or process.stdout.strip()}"
        )

    report("progress", stage="quantize", percent=100, format=native_format)
    result = {
        "source": str(source),
        "format": native_format,
        "artifact": str(output),
        "checksum_sha256": sha256(output),
    }
    write_json(output.with_suffix(".manifest.json"), {
        "schema_version": "1",
        "stage": "quantize",
        "job_id": job_id,
        **result,
    })
    return result


def convert_to_gguf(manifest: dict[str, Any], report: Report) -> dict[str, Any]:
    source = Path(manifest["source"])
    if not source.exists():
        raise FileNotFoundError(f"Source checkpoint not found: {source}")
    artifacts_dir = Path(manifest["artifacts_dir"])
    job_id = manifest["job_id"]
    output = Path(manifest.get("output")) if manifest.get("output") else artifacts_dir / job_id / "model.gguf"
    output.parent.mkdir(parents=True, exist_ok=True)

    converter = find_llama_convert(manifest.get("converter_path"))
    command = [sys.executable, converter, str(source), "--outfile", str(output), "--outtype", manifest.get("outtype", "f16")]
    report("progress", stage="convert", percent=10)
    process = subprocess.run(command, check=False, capture_output=True, text=True)
    if process.returncode != 0:
        raise RuntimeError(
            f"GGUF conversion failed ({process.returncode}): "
            f"{process.stderr.strip() or process.stdout.strip()}"
        )
    if not output.is_file():
        raise RuntimeError("GGUF conversion completed without creating the output artifact")

    report("progress", stage="convert", percent=100)
    result = {
        "source": str(source),
        "artifact": str(output),
        "format": "GGUF",
        "checksum_sha256": sha256(output),
    }
    write_json(output.with_suffix(".manifest.json"), {
        "schema_version": "1",
        "stage": "convert",
        "job_id": job_id,
        **result,
    })
    return result


def register_dataset(manifest: dict[str, Any], report: Report) -> dict[str, Any]:
    required = ["images_dir", "labels_csv", "artifacts_dir"]
    missing = [key for key in required if not manifest.get(key)]
    if missing:
        raise ValueError(f"Dataset manifest missing: {', '.join(missing)}")

    images_dir = Path(manifest["images_dir"])
    labels_csv = Path(manifest["labels_csv"])
    if not images_dir.is_dir():
        raise FileNotFoundError(f"Images directory not found: {images_dir}")
    if not labels_csv.is_file():
        raise FileNotFoundError(f"Labels CSV not found: {labels_csv}")

    image_field = manifest.get("image_field", "image_id")
    label_field = manifest.get("label_field", "label")
    positive_labels = {str(value).strip().lower() for value in manifest.get("positive_labels", [])}
    seed = int(manifest.get("seed", 42))
    train_fraction = float(manifest.get("train_fraction", 0.70))
    validation_fraction = float(manifest.get("validation_fraction", 0.15))
    test_fraction = float(manifest.get("test_fraction", 0.15))
    if abs(train_fraction + validation_fraction + test_fraction - 1.0) > 1e-6:
        raise ValueError("train_fraction, validation_fraction, and test_fraction must sum to 1")

    records: list[dict[str, Any]] = []
    missing_images: list[str] = []
    with labels_csv.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            image_name = str(row[image_field]).strip()
            if not (images_dir / image_name).is_file():
                missing_images.append(image_name)
            raw_label = str(row[label_field]).strip().lower()
            records.append({
                "image_id": image_name,
                "raw_label": raw_label,
                "binary_label": int(raw_label in positive_labels) if positive_labels else None,
            })

    if missing_images:
        raise FileNotFoundError(
            f"{len(missing_images)} labels reference missing images; first: {missing_images[0]}"
        )
    if not records:
        raise ValueError("Dataset contains no records")

    groups: dict[str, list[dict[str, Any]]] = {}
    for record in records:
        key = str(record["binary_label"])
        groups.setdefault(key, []).append(record)

    rng = random.Random(seed)
    split_records: dict[str, list[dict[str, Any]]] = {
        "train": [], "validation": [], "test": [],
    }
    for group_records in groups.values():
        rng.shuffle(group_records)
        total = len(group_records)
        train_count = int(round(total * train_fraction))
        validation_count = int(round(total * validation_fraction))
        split_records["train"].extend(group_records[:train_count])
        split_records["validation"].extend(group_records[train_count:train_count + validation_count])
        split_records["test"].extend(group_records[train_count + validation_count:])

    output_dir = Path(manifest["artifacts_dir"]) / manifest["job_id"]
    output_dir.mkdir(parents=True, exist_ok=True)
    splits: dict[str, str] = {}
    for split_name, split_rows in split_records.items():
        path = output_dir / f"{split_name}.csv"
        with path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=["image_id", "raw_label", "binary_label"])
            writer.writeheader()
            writer.writerows(split_rows)
        splits[split_name] = str(path)

    report("progress", stage="dataset", percent=100)
    result = {
        "n_records": len(records),
        "n_missing_images": 0,
        "splits": splits,
        "seed": seed,
        "label_mapping": {
            "positive_labels": sorted(positive_labels),
            "negative_labels": manifest.get("negative_labels", []),
        },
        "split_fractions": {
            "train": train_fraction,
            "validation": validation_fraction,
            "test": test_fraction,
        },
    }
    write_json(output_dir / "dataset.manifest.json", {
        "schema_version": "1",
        "stage": "dataset",
        "job_id": manifest["job_id"],
        "images_dir": str(images_dir),
        "labels_csv": str(labels_csv),
        **result,
    })
    return result


def evaluate(manifest: dict[str, Any], report: Report) -> dict[str, Any]:
    predictions_path = Path(manifest["predictions"])
    if not predictions_path.is_file():
        raise FileNotFoundError(f"Predictions file not found: {predictions_path}")

    suffix = predictions_path.suffix.lower()
    if suffix == ".json":
        value = json.loads(predictions_path.read_text())
        predictions = value if isinstance(value, list) else value["predictions"]
    elif suffix == ".csv":
        with predictions_path.open(newline="", encoding="utf-8") as handle:
            predictions = list(csv.DictReader(handle))
            for item in predictions:
                item["true_label"] = int(item["true_label"])
                item["predicted"] = int(item["predicted"]) if item["predicted"] else None
    else:
        raise ValueError("Predictions must be JSON or CSV")

    report("progress", stage="evaluate", percent=10)
    result = evaluate_predictions(predictions, manifest)
    report("progress", stage="evaluate", percent=100)
    output_dir = Path(manifest["artifacts_dir"]) / manifest["job_id"]
    write_json(output_dir / "evaluation-result.json", {
        "schema_version": "1",
        "stage": "evaluate",
        "job_id": manifest["job_id"],
        **result,
    })
    return result


def benchmark(manifest: dict[str, Any], report: Report) -> dict[str, Any]:
    required = ["model", "mmproj", "images_dir", "artifacts_dir"]
    missing = [key for key in required if not manifest.get(key)]
    if missing:
        raise ValueError(f"Benchmark manifest missing: {', '.join(missing)}")

    model = Path(manifest["model"])
    mmproj = Path(manifest["mmproj"])
    images_dir = Path(manifest["images_dir"])
    for path in (model, mmproj, images_dir):
        if not path.exists():
            raise FileNotFoundError(f"Benchmark input not found: {path}")

    server = find_llama_server(manifest.get("llama_server"))
    host = str(manifest.get("host", "127.0.0.1"))
    port = int(manifest.get("port", 8081))
    command = [
        server, "-m", str(model), "--mmproj", str(mmproj),
        "--host", host, "--port", str(port),
        "--ctx-size", str(manifest.get("context_size", 4096)),
    ]
    output_dir = Path(manifest["artifacts_dir"]) / manifest["job_id"]
    output_dir.mkdir(parents=True, exist_ok=True)
    server_log = output_dir / "benchmark-llama-server.log"
    repeated = int(manifest.get("repeated_runs", 3))
    images = [path for path in sorted(images_dir.iterdir()) if path.is_file()][:int(manifest.get("max_images", repeated))]

    with server_log.open("wb") as log:
        process = subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT)
        try:
            wait_for_server(host, port, int(manifest.get("timeout_seconds", 300)), process)
            latencies: list[float] = []
            peak_rss = 0
            try:
                import psutil
                parent = psutil.Process(process.pid)
            except ImportError:
                parent = None
            for run in range(repeated):
                for image in images:
                    started = time.monotonic()
                    payload = {
                        "model": "model",
                        "messages": [{
                            "role": "user",
                            "content": [
                                {"type": "text", "text": manifest.get("prompt", "Respond with a JSON object containing infected and confidence.")},
                                {"type": "image_url", "image_url": {"url": encode_image(image)}},
                            ],
                        }],
                        "temperature": 0.0,
                        "max_tokens": int(manifest.get("max_tokens", 160)),
                    }
                    request = urllib.request.Request(
                        f"http://{host}:{port}/v1/chat/completions",
                        data=json.dumps(payload).encode("utf-8"),
                        headers={"Content-Type": "application/json"},
                        method="POST",
                    )
                    with urllib.request.urlopen(request, timeout=int(manifest.get("timeout_seconds", 300))):
                        pass
                    latencies.append(time.monotonic() - started)
                    if parent is not None:
                        try:
                            peak_rss = max(peak_rss, parent.memory_info().rss)
                            for child in parent.children(recursive=True):
                                peak_rss = max(peak_rss, child.memory_info().rss)
                        except Exception:
                            pass
                    report("progress", stage="benchmark", percent=int(100 * (run * len(images) + images.index(image) + 1) / (repeated * max(len(images), 1))))
        finally:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)

    sorted_latencies = sorted(latencies)
    p95 = sorted_latencies[max(0, int(0.95 * len(sorted_latencies)) - 1)] if sorted_latencies else None
    result = {
        "platform": platform.platform(),
        "python": sys.version,
        "model": str(model),
        "mmproj": str(mmproj),
        "n_runs": len(latencies),
        "latency_seconds": {
            "mean": sum(latencies) / len(latencies) if latencies else None,
            "median": sorted_latencies[len(sorted_latencies) // 2] if sorted_latencies else None,
            "p95": p95,
        },
        "peak_rss_bytes": peak_rss,
    }
    write_json(output_dir / "benchmark-result.json", {
        "schema_version": "1",
        "stage": "benchmark",
        "job_id": manifest["job_id"],
        **result,
    })
    return result


def adapt(manifest: dict[str, Any], report: Report) -> dict[str, Any]:
    required = {
        "source": "Hugging Face model id or local checkpoint",
        "train_data": "Training dataset artifact JSON",
        "output_dir": "Adapter/checkpoint output directory",
    }
    missing = [key for key in required if not manifest.get(key)]
    if missing:
        raise ValueError(f"Adapt manifest missing: {', '.join(missing)}")

    try:
        import torch
        import transformers
        import peft
    except ImportError as exc:
        raise RuntimeError(
            "LoRA adaptation dependencies are missing: torch, transformers, "
            "datasets, peft, and accelerate"
        ) from exc

    source = str(manifest["source"])
    train_data = Path(manifest["train_data"])
    if not train_data.is_file():
        raise FileNotFoundError(f"Training data not found: {train_data}")
    output_dir = Path(manifest["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)

    report("progress", stage="adapt", percent=5)
    script = Path(__file__).with_name("adapt_lora.py")
    process = subprocess.run(
        [
            sys.executable,
            str(script),
            "--source",
            source,
            "--train-data",
            str(train_data),
            "--output-dir",
            str(output_dir),
            "--config",
            json.dumps(manifest),
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    if process.returncode != 0:
        raise RuntimeError(
            f"LoRA adaptation failed ({process.returncode}): "
            f"{process.stderr.strip() or process.stdout.strip()}"
        )

    report("progress", stage="adapt", percent=100)
    manifest_path = output_dir / "adaptation.manifest.json"
    if manifest_path.is_file():
        result = json.loads(manifest_path.read_text())
    else:
        result = {"output_dir": str(output_dir), "status": "completed"}
    result["checksum_sha256"] = sha256(output_dir / "adapter_config.json") if (output_dir / "adapter_config.json").is_file() else None
    write_json(output_dir / "adaptation.manifest.json", {
        "schema_version": "1",
        "stage": "adapt",
        "job_id": manifest["job_id"],
        **result,
    })
    return result


def baseline(manifest: dict[str, Any], report: Report) -> dict[str, Any]:
    required = ["model", "mmproj", "images_dir", "labels_csv", "artifacts_dir"]
    missing = [key for key in required if not manifest.get(key)]
    if missing:
        raise ValueError(f"Baseline manifest missing: {', '.join(missing)}")

    model = Path(manifest["model"])
    mmproj = Path(manifest["mmproj"])
    images_dir = Path(manifest["images_dir"])
    labels_csv = Path(manifest["labels_csv"])
    for path in (model, mmproj, images_dir, labels_csv):
        if not path.exists():
            raise FileNotFoundError(f"Baseline input not found: {path}")

    server = find_llama_server(manifest.get("llama_server"))
    host = str(manifest.get("host", "127.0.0.1"))
    port = int(manifest.get("port", 8080))
    context_size = int(manifest.get("context_size", 4096))
    timeout = int(manifest.get("timeout_seconds", 300))

    command = [
        server,
        "-m", str(model),
        "--mmproj", str(mmproj),
        "--host", host,
        "--port", str(port),
        "--ctx-size", str(context_size),
    ]
    server_log = Path(manifest["artifacts_dir"]) / manifest["job_id"] / "llama-server.log"
    server_log.parent.mkdir(parents=True, exist_ok=True)
    with server_log.open("wb") as log:
        process = subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT)
        try:
            wait_for_server(host, port, timeout, process)
            report("progress", stage="baseline", percent=10)
            predictions = run_inference(
                host,
                port,
                images_dir,
                labels_csv,
                manifest,
                report,
            )
        finally:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)

    result = evaluate_predictions(predictions, manifest)
    report("progress", stage="baseline", percent=100)
    output_dir = Path(manifest["artifacts_dir"]) / manifest["job_id"]
    write_json(output_dir / "baseline-result.json", {
        "schema_version": "1",
        "stage": "baseline",
        "job_id": manifest["job_id"],
        **result,
    })
    return result


def run_manifest(manifest: dict[str, Any], report: Report) -> dict[str, Any]:
    stage = manifest["stage"]
    handlers = {
        "quantize": quantize,
        "convert": convert_to_gguf,
        "dataset": register_dataset,
        "evaluate": evaluate,
        "benchmark": benchmark,
        "adapt": adapt,
        "baseline": baseline,
    }
    if stage not in handlers:
        raise ValueError(f"Unknown pipeline stage: {stage}")
    return handlers[stage](manifest, report)

