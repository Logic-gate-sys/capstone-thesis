# Pipeline

The Python pipeline is an executable JSON Lines worker used by the Go desktop
application. It does not expose an HTTP service.

Run locally:

```bash
python3 -m pipeline.worker
```

Send a request:

```json
{"command":"ping","request_id":"1"}
{"command":"run","request_id":"2","manifest":{"schema_version":"1","stage":"quantize","job_id":"demo","artifacts_dir":"artifacts","source":"sample_work/models/Qwen3VL-4B-Instruct-Q8_0.gguf","format":"Q4"}}
{"command":"shutdown","request_id":"3"}
```

Each event is emitted as a JSON object on stdout. The worker is a thin adapter
over the Python pipeline core. Hugging Face/Transformers code belongs in the
adaptation stage; llama.cpp belongs in conversion, quantization, and runtime
adapters.

## Implemented stages

- `dataset`: validates images and labels, creates stratified train/validation/test
  splits, and writes dataset manifests.
- `baseline`: launches `llama-server`, runs frozen-prompt image inference, and
  calculates classification and latency metrics.
- `quantize`: invokes `llama-quantize` and writes a checksumed Q4_K_M or Q8_0
  artifact manifest.
- `convert`: invokes a llama.cpp Hugging Face-to-GGUF converter.
- `adapt`: invokes a PEFT/LoRA adaptation script for a Hugging Face vision
  checkpoint.
- `evaluate`: calculates confusion, sensitivity, specificity, accuracy,
  Wilson intervals, positive-call rate, and latency.
- `benchmark`: runs repeated local inference and records latency, peak RSS,
  platform, model, and runtime inputs.

