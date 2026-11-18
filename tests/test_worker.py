import json
import subprocess
import sys
import unittest
import tempfile
from pathlib import Path

from pipeline.core import evaluate_predictions, register_dataset


ROOT = Path(__file__).resolve().parents[1]


def worker_messages(*messages):
    input_text = "".join(json.dumps(message) + "\n" for message in messages)
    result = subprocess.run(
        [sys.executable, "-m", "pipeline.worker"],
        cwd=ROOT,
        input=input_text,
        text=True,
        capture_output=True,
        check=True,
    )
    return [json.loads(line) for line in result.stdout.splitlines() if line]


class WorkerProtocolTests(unittest.TestCase):
    def test_ping_protocol(self):
        messages = worker_messages(
            {"command": "ping", "request_id": "ping-1"},
            {"command": "shutdown", "request_id": "shutdown-1"},
        )
        self.assertTrue(any(m["event"] == "ready" for m in messages))
        self.assertTrue(
            any(
                m["event"] == "pong" and m["request_id"] == "ping-1"
                for m in messages
            )
        )
        self.assertTrue(any(m["event"] == "shutdown" for m in messages))

    def test_unknown_command_is_structured_failure(self):
        messages = worker_messages({"command": "unknown", "request_id": "bad-1"})
        failure = next(m for m in messages if m["event"] == "failed")
        self.assertEqual(failure["request_id"], "bad-1")
        self.assertEqual(failure["status"], "failed")


class PipelineStageTests(unittest.TestCase):
    def test_dataset_register_creates_stratified_splits(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            images = root / "images"
            images.mkdir()
            for index in range(20):
                (images / f"{index}.jpg").write_bytes(b"test")
            labels = root / "labels.csv"
            with labels.open("w", newline="", encoding="utf-8") as handle:
                import csv
                writer = csv.writer(handle)
                writer.writerow(["image_id", "label"])
                for index in range(20):
                    writer.writerow([f"{index}.jpg", "medium" if index < 4 else "low"])

            manifest = {
                "schema_version": "1",
                "stage": "dataset",
                "job_id": "dataset-test",
                "artifacts_dir": str(root / "artifacts"),
                "images_dir": str(images),
                "labels_csv": str(labels),
                "image_field": "image_id",
                "label_field": "label",
                "positive_labels": ["medium"],
                "negative_labels": ["low"],
                "seed": 7,
                "train_fraction": 0.70,
                "validation_fraction": 0.15,
                "test_fraction": 0.15,
            }
            events = []
            result = register_dataset(manifest, lambda event, **data: events.append((event, data)))
            self.assertEqual(result["n_records"], 20)
            self.assertEqual(len(events), 1)
            for split in result["splits"].values():
                self.assertTrue(Path(split).is_file())

    def test_evaluation_calculates_metrics(self):
        predictions = [
            {"true_label": 1, "predicted": 1, "latency_seconds": 1.0},
            {"true_label": 1, "predicted": 0, "latency_seconds": 2.0},
            {"true_label": 0, "predicted": 0, "latency_seconds": 1.5},
            {"true_label": 0, "predicted": 1, "latency_seconds": 2.5},
        ]
        result = evaluate_predictions(predictions, {})
        self.assertEqual(result["confusion_matrix"]["true_positive"], 1)
        self.assertEqual(result["confusion_matrix"]["false_negative"], 1)
        self.assertEqual(result["confusion_matrix"]["true_negative"], 1)
        self.assertEqual(result["confusion_matrix"]["false_positive"], 1)
        self.assertEqual(result["accuracy"], 0.5)


if __name__ == "__main__":
    unittest.main()

