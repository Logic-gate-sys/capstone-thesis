package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type PipelineEvent struct {
	Event     string         `json:"event"`
	RequestID string         `json:"request_id,omitempty"`
	JobID     string         `json:"job_id,omitempty"`
	Status    string         `json:"status,omitempty"`
	Stage     string         `json:"stage,omitempty"`
	Message   string         `json:"message,omitempty"`
	ErrorType string         `json:"error_type,omitempty"`
	Result    map[string]any `json:"result,omitempty"`
	Percent   int            `json:"percent,omitempty"`
	Format    string         `json:"format,omitempty"`
	Raw       map[string]any `json:"-"`
}

type PipelineService struct{}

func findProjectRoot() (string, error) {
	cwd, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for dir := cwd; ; dir = filepath.Dir(dir) {
		if _, err := os.Stat(filepath.Join(dir, "pipeline", "worker.py")); err == nil {
			return dir, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
	}
	return "", fmt.Errorf("could not locate pipeline/worker.py from %s", cwd)
}

func pipelinePython() string {
	if configured := os.Getenv("ML_WORKBENCH_PYTHON"); configured != "" {
		return configured
	}
	if _, err := exec.LookPath("python3"); err == nil {
		return "python3"
	}
	if _, err := exec.LookPath("python"); err == nil {
		return "python"
	}
	return "python3"
}

func (s *PipelineService) Ping() (PipelineEvent, error) {
	root, err := findProjectRoot()
	if err != nil {
		return PipelineEvent{}, err
	}

	cmd := exec.Command(pipelinePython(), "-m", "pipeline.worker")
	cmd.Dir = root
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return PipelineEvent{}, err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return PipelineEvent{}, err
	}
	var stderr strings.Builder
	cmd.Stderr = &stderr
	if err := cmd.Start(); err != nil {
		return PipelineEvent{}, err
	}

	if _, err := fmt.Fprintln(stdin, `{"command":"ping","request_id":"desktop-ping"}`); err != nil {
		return PipelineEvent{}, err
	}
	if _, err := fmt.Fprintln(stdin, `{"command":"shutdown","request_id":"desktop-shutdown"}`); err != nil {
		return PipelineEvent{}, err
	}

	var pong PipelineEvent
	scanner := bufio.NewScanner(stdout)
	for scanner.Scan() {
		var event PipelineEvent
		if err := json.Unmarshal(scanner.Bytes(), &event); err == nil && event.Event == "pong" {
			pong = event
		}
	}
	if err := cmd.Wait(); err != nil && stderr.Len() > 0 {
		return PipelineEvent{}, fmt.Errorf("%s", stderr.String())
	}
	if pong.Event == "" {
		return PipelineEvent{}, fmt.Errorf("pipeline worker did not return pong")
	}
	return pong, nil
}

func (s *PipelineService) RunJob(manifestJSON string) ([]PipelineEvent, error) {
	root, err := findProjectRoot()
	if err != nil {
		return nil, err
	}

	var manifest map[string]any
	if err := json.Unmarshal([]byte(manifestJSON), &manifest); err != nil {
		return nil, fmt.Errorf("invalid manifest JSON: %w", err)
	}
	if artifacts, ok := manifest["artifacts_dir"].(string); ok && !filepath.IsAbs(artifacts) {
		manifest["artifacts_dir"] = filepath.Join(root, artifacts)
	}

	request := map[string]any{
		"command":    "run",
		"request_id": "desktop-job",
		"manifest":   manifest,
	}
	requestJSON, err := json.Marshal(request)
	if err != nil {
		return nil, err
	}

	cmd := exec.Command(pipelinePython(), "-m", "pipeline.worker")
	cmd.Dir = root
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	var stderr strings.Builder
	cmd.Stderr = &stderr
	if err := cmd.Start(); err != nil {
		return nil, err
	}

	fmt.Fprintln(stdin, string(requestJSON))
	fmt.Fprintln(stdin, `{"command":"shutdown","request_id":"desktop-shutdown"}`)

	events := make([]PipelineEvent, 0)
	scanner := bufio.NewScanner(stdout)
	scanner.Buffer(make([]byte, 64*1024), 1024*1024)
	for scanner.Scan() {
		var event PipelineEvent
		if err := json.Unmarshal(scanner.Bytes(), &event); err == nil {
			events = append(events, event)
		}
	}
	if err := scanner.Err(); err != nil {
		return events, err
	}
	if err := cmd.Wait(); err != nil && stderr.Len() > 0 {
		return events, fmt.Errorf("%s", stderr.String())
	}
	return events, nil
}
