"""LoRA adaptation worker for image-text checkpoints.

This script is invoked by the JSONL worker. It keeps model-specific behavior
behind Transformers' processor/model loader and writes a PEFT adapter plus
provenance metadata.
"""

from __future__ import annotations

import argparse
import json
import csv
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--train-data", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--config", required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    manifest = json.loads(args.config)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        import torch
        from PIL import Image
        from datasets import Dataset
        from peft import LoraConfig, get_peft_model
        from transformers import AutoProcessor, AutoModelForImageTextToText, TrainingArguments, Trainer
    except ImportError as exc:
        raise SystemExit(
            "Missing adaptation dependencies. Install torch, transformers, "
            "datasets, Pillow, peft, and accelerate."
        ) from exc

    source = str(manifest.get("processor_id") or args.source)
    processor = AutoProcessor.from_pretrained(source, trust_remote_code=True)
    model = AutoModelForImageTextToText.from_pretrained(
        args.source,
        torch_dtype=torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16,
        device_map="auto",
        trust_remote_code=True,
    )

    rank = int(manifest.get("rank", 16))
    alpha = int(manifest.get("alpha", 32))
    dropout = float(manifest.get("dropout", 0.05))
    target_modules = manifest.get("target_modules")
    lora = LoraConfig(
        r=rank,
        lora_alpha=alpha,
        lora_dropout=dropout,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=target_modules,
    )
    model = get_peft_model(model, lora)
    model.print_trainable_parameters()

    train_path = Path(args.train_data)
    if train_path.suffix.lower() == ".json":
        train_data = json.loads(train_path.read_text())
        if isinstance(train_data, dict):
            train_data = train_data["records"]
    elif train_path.suffix.lower() == ".csv":
        with train_path.open(newline="", encoding="utf-8") as handle:
            train_data = list(csv.DictReader(handle))
    else:
        raise SystemExit("Training data must be JSON or CSV")

    prompt_template = manifest.get(
        "prompt_template",
        "A medical image is shown. Respond with infected yes/no and a brief rationale.",
    )
    images_dir = Path(manifest["images_dir"])
    image_field = manifest.get("image_field", "image_id")
    label_field = manifest.get("label_field", "binary_label")

    def transform(record):
        image_path = images_dir / str(record[image_field])
        image = Image.open(image_path).convert("RGB")
        label = int(record[label_field])
        answer = "yes" if label == 1 else "no"
        messages = [{
            "role": "user",
            "content": [
                {"type": "text", "text": prompt_template},
                {"type": "image", "image": image},
            ],
        }]
        batch = processor.apply_chat_template(
            messages,
            add_generation_prompt=False,
            tokenize=True,
            return_dict=True,
            return_tensors="pt",
        )
        batch["labels"] = batch["input_ids"].clone()
        return {key: value.squeeze(0) if hasattr(value, "squeeze") else value for key, value in batch.items()}

    dataset = Dataset.from_list(train_data).map(transform)
    training_args = TrainingArguments(
        output_dir=str(output_dir),
        num_train_epochs=float(manifest.get("epochs", 3)),
        learning_rate=float(manifest.get("learning_rate", 2e-4)),
        per_device_train_batch_size=int(manifest.get("batch_size", 1)),
        gradient_accumulation_steps=int(manifest.get("gradient_accumulation_steps", 8)),
        warmup_ratio=float(manifest.get("warmup_ratio", 0.03)),
        logging_steps=int(manifest.get("logging_steps", 10)),
        save_strategy="epoch",
        report_to=[],
        bf16=bool(torch.cuda.is_bf16_supported()),
        fp16=bool(not torch.cuda.is_bf16_supported()),
        remove_unused_columns=False,
    )
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=dataset,
        processing_class=processor,
    )
    trainer.train()
    model.save_pretrained(output_dir)
    processor.save_pretrained(output_dir)

    provenance = {
        "schema_version": "1",
        "stage": "adapt",
        "source": args.source,
        "processor": source,
        "rank": rank,
        "alpha": alpha,
        "dropout": dropout,
        "target_modules": target_modules,
        "epochs": manifest.get("epochs", 3),
        "learning_rate": manifest.get("learning_rate", 2e-4),
        "batch_size": manifest.get("batch_size", 1),
    }
    (output_dir / "adaptation-result.json").write_text(
        json.dumps(provenance, indent=2) + "\n"
    )
    print(json.dumps(provenance))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
