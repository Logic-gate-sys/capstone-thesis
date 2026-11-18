import os
from collections.abc import Callable
from typing import Any, Dict

from huggingface_hub import HfApi, snapshot_download


def handle_search(job_id: str, config: Dict[str, Any], emit_fn: Callable) -> None:
    query = config.get("query", "qwen-vl")
    limit = config.get("limit", 15)

    emit_fn(
        "progress",
        job_id,
        progress=0.1,
        message=f"Searching Hugging Face Hub for '{query}'...",
    )

    api = HfApi()
    models = api.list_models(
        search=query, sort="downloads", direction=-1, limit=limit, full=True
    )

    results = [
        {
            "repo_id": m.id,
            "author": m.author,
            "downloads": m.downloads,
            "likes": m.likes,
            "tags": m.tags,
        }
        for m in models
    ]

    emit_fn("search_results", job_id, models=results)
    emit_fn(
        "complete", job_id, status="success", message=f"Found {len(results)} models."
    )


def handle_download(job_id: str, config: Dict[str, Any], emit_fn: Callable) -> None:
    repo_id = config.get("repo_id")
    save_dir = config.get("save_dir", "artifacts/models")

    if not repo_id:
        emit_fn("error", job_id, message="Missing 'repo_id' configuration.")
        return

    emit_fn("progress", job_id, progress=0.0, message=f"Downloading {repo_id}...")
    os.makedirs(save_dir, exist_ok=True)
    target_path = os.path.join(save_dir, repo_id.replace("/", "_"))

    downloaded_path = snapshot_download(
        repo_id=repo_id,
        local_dir=target_path,
        local_dir_use_symlinks=False,
        resume_download=True,
    )

    emit_fn("artifact", job_id, path=downloaded_path, artifact_type="model_checkpoint")
    emit_fn(
        "complete", job_id, status="success", message=f"Downloaded to {downloaded_path}"
    )
