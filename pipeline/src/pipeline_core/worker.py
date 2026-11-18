import json
import sys
import traceback
from collections.abc import Callable
from typing import Any, Dict

# Import modular handlers
from pipeline_core.handlers import models


def emit(event_type: str, job_id: str, **kwargs: Any):
    """Helper to emit a structured JSONL event to Go."""
    payload = {"event": event_type, "job_id": job_id, **kwargs}
    print(json.dumps(payload))
    sys.stdout.flush()


# Command Dispatch Registry
ACTION_HANDLERS: Dict[str, Callable] = {
    "search_models": models.handle_search,
    "download_model": models.handle_download,
}


def process_job(line: str):
    try:
        job = json.loads(line)
        job_id = job.get("job_id", "unknown")
        action = job.get("action")
        config = job.get("config", {})

        handler = ACTION_HANDLERS.get(action)
        if not handler:
            emit("error", job_id, message=f"Unknown action: {action}")
            return

        # Execute the modular handler, passing emit and job context
        handler(job_id=job_id, config=config, emit_fn=emit)

    except Exception as e:
        tb = traceback.format_exc()
        emit("error", job_id="unknown", message=str(e), traceback=tb)


def main():
    print(json.dumps({"event": "ready"}))
    sys.stdout.flush()

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        process_job(line)


if __name__ == "__main__":
    main()
