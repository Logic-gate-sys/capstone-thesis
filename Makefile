bin_dir=ml_workbench/build

.PHONY: help
help:
	@echo "Usage:"
	@sed -n 's/^##//p' ${MAKEFILE_LIST} | column -t -s ':' | sed -e 's/^/ /'

	
.PHONY: confirm
confirm:
	@echo -n "Are you sure you want to proceed? [y/N]" && read ans && [$${ans:-N}=y]

## dev: starts wails3 application in development mode with hot reload 
dev:
	cd app/ && WEBKIT_DISABLE_COMPOSITING_MODE=1 LIBGL_ALWAYS_SOFTWARE=1 wails3 dev

## bindings: generate typescript bindings 
bindings:
	cd app/ && wails3 generate bindings -ts
	
.PHONY: clean
## clean: clean built application binaries
clean: confirm
	@echo "Cleaning built binaries..." \
  @rm -rf ${bin_dir}

## venv: creates and activate virtual environment with uv
venv:
	cd pipeline/ && source .venv/bin/activate 

## test-workers
test-workers:
	uv run --project pipeline pytest pipeline/tests/test_model_workflows.py -s

## run-worker: run worker to test functionality
run-worker:
	cd pipeline/ && uv run --no-sync python src/main.py
.PHONY: uv-sync
## uv-sync: syncs uv packages 
uv-sync:
	cd pipeline/ && uv sync