"""JSON Lines worker for the local Wails application.

The worker reads one JSON object per stdin line and writes one JSON object per
stdout line. Large files are addressed by paths or artifact IDs in manifests.
"""

from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import sys
import threading
import uuid
from pathlib import Path
from typing import Any

from .core import run_manifest


def emit(event: str, request_id: str | None = None, **data: Any) -> None:
    record = {"event": event, "request_id": request_id}
    record.update(data)
    sys.stdout.write(json.dumps(record, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def ping(request_id: str | None) -> None:
    emit("pong", request_id)


def validate_manifest(manifest: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    version = str(manifest.get("schema_version", ""))
    if version != "1":
        raise ValueError("Unsupported or missing manifest schema_version")

    job_id = str(manifest.get("job_id") or uuid.uuid4())
    manifest["job_id"] = job_id
    stage = str(manifest.get("stage", "")).strip()
    if not stage:
        raise ValueError("Manifest requires a stage")
    if "artifacts_dir" not in manifest:
        raise ValueError("Manifest requires artifacts_dir")
    return job_id, manifest


def handle_line(line: str) -> None:
    line = line.strip()
    if not line:
        return

    request_id: str | None = None
    try:
        message = json.loads(line)
        if not isinstance(message, dict):
            raise ValueError("Each input line must contain a JSON object")

        request_id = message.get("request_id")
        command = str(message.get("command", "")).strip()

        if command == "ping":
            ping(request_id)
            return

        if command == "shutdown":
            emit("shutdown", request_id)
            raise KeyboardInterrupt

        if command == "run":
            manifest = message.get("manifest")
            if not isinstance(manifest, dict):
                raise ValueError("run requires a manifest object")

            job_id, manifest = validate_manifest(manifest)
            emit(
                "started",
                request_id,
                job_id=job_id,
                stage=manifest["stage"],
            )

            def report(event: str, **data: Any) -> None:
                emit(event, request_id, job_id=job_id, **data)

            result = run_manifest(manifest, report)
            emit("completed", request_id, job_id=job_id, status="success", result=result)
            return

        raise ValueError(f"Unknown command: {command}")
    except KeyboardInterrupt:
        raise
    except Exception as exc:
        emit(
            "failed",
            request_id,
            status="failed",
            error_type=type(exc).__name__,
            message=str(exc),
        )


def main() -> int:
    emit("ready", protocol="jsonl", schema_version="1")
    try:
        for line in sys.stdin:
            handle_line(line)
    except KeyboardInterrupt:
        return 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

