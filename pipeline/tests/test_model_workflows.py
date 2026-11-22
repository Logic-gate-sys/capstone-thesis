import json
import subprocess
from pathlib import Path

pipeline_dir = Path(__file__).resolve().parents[1]


def test_model_search():
    payload = (
        json.dumps(
            {
                "job_id": "test_search",
                "action": "search_models",
                "config": {"query": "Qwen2-VL", "limit": 5},
            }
        )
        + "\n"
    )
    sub_proc = subprocess.run(
        ["uv", "run", "python", "src/main.py"],
        cwd=pipeline_dir,
        input=payload,
        text=True,
        capture_output=True,
        timeout=30,
        check=False,
    )

    # Ensure sub process returns success code 0 or print error if it fails
    assert sub_proc.returncode == 0, sub_proc.stderr

    events = [json.loads(line) for line in sub_proc.stdout.splitlines() if line.strip()]
    event_names = [e["event"] for e in events]

    assert "search_results" in event_names
    assert "complete" in event_names

    results_event = next(e for e in events if e["event"] == "search_results")
    complete_event = next(e for e in events if e["event"] == "complete")
    assert results_event["job_id"] == "test_search"
    assert len(results_event["models"]) <= 5
    assert complete_event["status"] == "success"

