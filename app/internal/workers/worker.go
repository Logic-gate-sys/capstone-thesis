package workers

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os/exec"
	"sync"
)

type RawEvent map[string]any

type EventHandler func(eventType string, jobID string, payload RawEvent)

type Supervisor struct {
	pipelineDir string
	onEvent     EventHandler

	mu     sync.Mutex
	cmd    *exec.Cmd
	stdin  io.WriteCloser
	stdout io.ReadCloser
	stderr io.ReadCloser
	doneCh chan struct{}
}

// Supervising worker utilities and jsonl communication in the background needs  it's own struct with methods.
// When services needs to be spun up, measures must be taken to terminate underlying subprocess when no longer needed.
// Termination and setting up of subprocesses is synchronised deterministically
func NewSupervisor(pipelineDir string, onEvent EventHandler) *Supervisor {
	return &Supervisor{
		pipelineDir: pipelineDir,
		onEvent:     onEvent,
	}
}

// Start: starts worker in the background. Locks sync.Mux for the process to prevent multiple starts of
// the same instance.
func (s *Supervisor) Start(ctx context.Context) error {
	s.mu.Lock()
	if s.cmd != nil {
		s.mu.Unlock()
		return nil
	}

	// start the long live python worker process in the background
	cmd := exec.CommandContext(ctx, "uv", "run", "--no-sync", "python", "src/main.py")
	cmd.Dir = s.pipelineDir // where python worker is located

	stdin, err := cmd.StdinPipe()
	if err != nil {
		s.mu.Unlock()
		return fmt.Errorf("stdin pipe: %w", err)
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		s.mu.Unlock()
		return fmt.Errorf("stdout pipe: %w", err)
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		s.mu.Unlock()
		return fmt.Errorf("stderr pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		s.mu.Unlock()
		return fmt.Errorf("start uv worker: %w", err)
	}

	doneCh := make(chan struct{})
	s.cmd = cmd
	s.stdin = stdin
	s.stdout = stdout
	s.stderr = stderr
	s.doneCh = doneCh
	s.mu.Unlock()

	// Routines to read stdout & stderr respectively
	go s.readStdout(stdout, doneCh)
	go s.drainStderr(stderr)

	return nil
}

// Sends job to be passed down stdin to  the underlying worker processs/thread
// Job sent to the stdin of the worker process is picked and process by the worker thread in the background
func (s *Supervisor) SendJob(jobID string, action string, config map[string]any) error {
	msg := map[string]any{
		"job_id": jobID,
		"action": action,
		"config": config,
	}

	// json encode job to be passed down the stdin of the worker thread
	encoded, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("marshal job: %w", err)
	}
	encoded = append(encoded, '\n')

	s.mu.Lock()
	defer s.mu.Unlock()

	// verify worker is running  & send job via stdin
	if s.cmd == nil || s.stdin == nil {
		return errors.New("worker is not running")
	}

	if _, err := s.stdin.Write(encoded); err != nil {
		return fmt.Errorf("write to worker stdin: %w", err)
	}
	return nil
}

func (s *Supervisor) Stop() error {
	s.mu.Lock()
	cmd := s.cmd
	stdin := s.stdin
	doneCh := s.doneCh
	s.cmd = nil
	s.stdin = nil
	s.doneCh = nil
	s.mu.Unlock()

	if cmd == nil {
		return nil
	}

	if stdin != nil {
		_ = stdin.Close()
	}

	if doneCh != nil {
		<-doneCh
	}

	if err := cmd.Wait(); err != nil {
		var exitErr *exec.ExitError
		if !errors.As(err, &exitErr) {
			return err
		}
	}
	return nil
}

func (s *Supervisor) readStdout(stdout io.ReadCloser, doneCh chan struct{}) {
	defer close(doneCh)
	defer stdout.Close()

	scanner := bufio.NewScanner(stdout)
	// create a read buffer of size 4MiB, storing bytes each of size 64kiB
	scanner.Buffer(make([]byte, 64*1024), 4*1024*1024)

	// Read stdout lines into each 64Kib chunk of the slice in the buffer,
	// Decode lines into json
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		var payload RawEvent
		if err := json.Unmarshal(line, &payload); err != nil {
			if s.onEvent != nil {
				s.onEvent("error", "unknown", RawEvent{
					"event":   "error",
					"job_id":  "unknown",
					"message": fmt.Sprintf("invalid JSON from worker: %v", err),
					"raw":     string(line),
				})
			}
			continue
		}

		eventType, _ := payload["event"].(string)
		jobID, _ := payload["job_id"].(string)
		if jobID == "" {
			jobID = "unknown"
		}

		if s.onEvent != nil {
			s.onEvent(eventType, jobID, payload)
		}
	}
	if scanner.Err() != nil {
		fmt.Println("Failed to open scanner!")
		return
	}
}

func (s *Supervisor) drainStderr(stderr io.ReadCloser) {
	defer stderr.Close()
	scanner := bufio.NewScanner(stderr)
	scanner.Buffer(make([]byte, 32*1024), 1024*1024)
	for scanner.Scan() {
		// Surface non-fatal stderr diagnostics as worker log events if needed.
		text := scanner.Text()
		if text != "" && s.onEvent != nil {
			s.onEvent("log", "worker", RawEvent{
				"event":   "log",
				"job_id":  "worker",
				"stream":  "stderr",
				"message": text,
			})
		}
	}

	if scanner.Err() != nil {
		fmt.Println("Failed to open scanner!")
		return
	}
}
