import json
import sys
import traceback
from collections.abc import Callable
from typing import Any
from xxlimited import Error

# Import modular handlers
from pipeline_core.handlers import models


def emit(event_type: str, job_id: str, **kwargs: Any):
    """Helper to emit a structured JSONL event to Go."""
    payload = {"event": event_type, "job_id": job_id, **kwargs}
    print(json.dumps(payload))
    sys.stdout.flush()


# Command Dispatch Registry
ACTION_HANDLERS: dict[str, Callable] = {
    "search_models": models.handle_search,
    "download_model": models.handle_download,
    "cancel_download": models.cancel_download,
}


def process_job(line: str) -> None:
  """
  The main process for jobs. This spins up a function for each job that needs it.
  Streams feedbacks back to be sent to stdout.
  """
  try:
      job = json.loads(line)
      print(f"Job: ${job}")
      job_id = job.get("job_id", "unknown")
      action = job.get("action")
      config = job.get("config", {})

      handler = ACTION_HANDLERS.get(action)
      if not handler:
          emit("error", job_id, message=f"Unknown action: {action}")
          return

      # Execute the modular handler, passing emit and job context
      handler(job_id=job_id, config=config, emit_fn=emit)

  # Catch any errors thrown and sent to stdout
  except Error as e:
      tb = traceback.format_exc()
      emit("error", job_id="unknown", message=str(e), traceback=tb)
