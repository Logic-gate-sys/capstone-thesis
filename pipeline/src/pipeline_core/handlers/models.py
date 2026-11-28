import hashlib
from collections.abc import Callable
from pathlib import Path
from typing import Any

from huggingface_hub import HfApi, snapshot_download


def _compute_dir_checksum(directory: Path) -> str:
    """Computes a deterministic SHA-256 digest over sorted relative file paths and sizes/hashes."""
    hasher = hashlib.sha256()
    files = sorted([p for p in directory.rglob("*") if p.is_file()])
    for file_path in files:
        rel_path = file_path.relative_to(directory).as_posix()
        hasher.update(rel_path.encode("utf-8"))
        with open(file_path, "rb") as f:
            while chunk := f.read(1024 * 1024):
                hasher.update(chunk)
    return hasher.hexdigest()


def handle_search(job_id: str, config: dict[str, Any], emit_fn: Callable[..., None]) -> None:
    """Searches Hugging Face Hub models by query, architecture/task tags, and library."""
    query: str | None = config.get("query")
    pipeline_tag: str | None = config.get("pipeline_tag")
    library: str | None = config.get("library")
    limit: int = int(config.get("limit", 20))

    emit_fn(
        event_type="progress",
        job_id=job_id,
        progress=0.1,
        message=f"Querying Hugging Face Hub (query={query!r}, tag={pipeline_tag!r})...",
    )

    api = HfApi()
    models = api.list_models(
        search=query,
        filter=pipeline_tag,
        sort="downloads",
        limit=limit,
        full=False,
    )
    results: list[dict[str, Any]] = [
        {
            "repo_id": m.id,
            "author": getattr(m, "author", None),
            "downloads": getattr(m, "downloads", 0) or 0,
            "likes": getattr(m, "likes", 0) or 0,
            "size": getattr(m, "size", 0) or 0,
            "pipeline_tag": getattr(m, "pipeline_tag", None),
            "tags": getattr(m, "tags", []) or [],
            "library_name": getattr(m, "library_name", "") or library,
            "last_modified": str(m.last_modified)
            if getattr(m, "last_modified", None)
            else None,
        }
        for m in models
    ]

    emit_fn(
        "progress",
        job_id,
        progress=0.9,
        message=f"Retrieved {len(results)} candidate models.",
    )
    emit_fn(event_type="search_results", job_id=job_id, models=results)
    emit_fn(
        "complete",
        job_id,
        status="success",
        message=f"Search finished with {len(results)} results.",
    )


def handle_download(
    job_id: str, config: dict[str, Any], emit_fn: Callable[..., None]
) -> None:
    """Downloads a Hugging Face model snapshot and records provenance metadata."""
    repo_id: str | None = config.get("repo_id")
    revision: str | None = config.get("revision")
    save_dir: str = config.get("save_dir", "artifacts/models")
    token: str | None = config.get("hf_token")

    if not repo_id or not isinstance(repo_id, str):
        emit_fn(
            "error", job_id, message="Missing or invalid 'repo_id' in download config."
        )
        return

    target_dir = Path(save_dir) / repo_id.replace("/", "__")
    target_dir.mkdir(parents=True, exist_ok=True)

    emit_fn(
        "progress",
        job_id,
        progress=0.15,
        message=f"Downloading snapshot for '{repo_id}' into '{target_dir}'...",
    )

    downloaded_path = snapshot_download(
        repo_id=repo_id,
        revision=revision,
        local_dir=str(target_dir),
        token=token,
    )

    emit_fn(
        "progress",
        job_id,
        progress=0.85,
        message="Computing snapshot checksum for provenance...",
    )
    checksum = _compute_dir_checksum(Path(downloaded_path))

    emit_fn(
        "artifact",
        job_id,
        artifact_type="model_checkpoint",
        repo_id=repo_id,
        revision=revision or "main",
        path=downloaded_path,
        checksum=checksum,
    )
    emit_fn(
        "complete",
        job_id,
        status="success",
        message=f"Model '{repo_id}' downloaded and verified.",
        path=downloaded_path,
        checksum=checksum,
    )


def cancel_download(
    job_id: str, config: dict[str, Any], emit_fn: Callable[..., None]
) -> None:
    pass
