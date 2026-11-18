# ML Workbench Desktop

This directory contains the Wails 3 desktop application:

- React and TypeScript user interface;
- Tailwind CSS for styling;
- Redux for application state;
- Go for desktop orchestration and Python worker supervision.

Run the desktop application from this directory:

```bash
wails3 dev
```

Build it with:

```bash
wails3 build
```

The Go `PipelineService` invokes the repository-level Python JSONL worker.
Set `ML_WORKBENCH_PYTHON` to use a specific Python executable, for example:

```bash
export ML_WORKBENCH_PYTHON=/absolute/path/to/python
```
