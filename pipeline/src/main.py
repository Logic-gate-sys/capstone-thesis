import json
import sys

from pipeline_core.workers import process_job


def main():
    """
    Main entry point of all events. Decode json lines sent into Stdin and
    pass line into process_job function. Runs when there's event in the stdin
    """
    print(json.dumps({"event": "ready", "workflow": "started"}))
    sys.stdout.flush()  # ensure python sends event out

    # Inspect python stdin to send available jobs to be executed
    for line in sys.stdin:
        line = line.strip()
        # If there's no line item, back to begining of loop
        if not line:
            continue
        process_job(line)


if __name__ == "__main__":
    main()
