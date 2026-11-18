package worker

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"os/exec"
	"sync"
)

type WorkerEvent struct {
	Event    string  `json:"event"`
	JobID    string  `json:"job_id"`
	Progress float64 `json:"progress,omitempty"`
	Message  string  `json:"message,omitempty"`
	Path     string  `json:"path,omitempty"`
	Status   string  `json:"status,omitempty"`
}

type Supervisor struct {
	cmd     *exec.Cmd
	stdin   io.WriteCloser
	mu      sync.Mutex
	running bool
}

func NewSupervisor(pythonEnvPath string) *Supervisor {
	return &Supervisor{}
}

func (s *Supervisor) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Launch Python worker using uv inside your pipeline directory
	s.cmd = exec.Command("uv", "run", "python", "-m", "ml_workbench_core.worker")

	stdinPipe, err := s.cmd.StdinPipe()
	if err != nil {
		return err
	}
	s.stdin = stdinPipe

	stdoutPipe, err := s.cmd.StdoutPipe()
	if err != nil {
		return err
	}

	// Read stdout asynchronously line by line
	scanner := bufio.NewScanner(stdoutPipe)
	go func() {
		for scanner.Scan() {
			line := scanner.Text()
			var event WorkerEvent
			if err := json.Unmarshal([]byte(line), &event); err == nil {
				// TODO: Forward event to Wails event bus -> Redux UI
				fmt.Printf("[Worker Event] Job: %s, Event: %s, Msg: %s\n", event.JobID, event.Event, event.Message)
			}
		}
	}()

	if err := s.cmd.Start(); err != nil {
		return err
	}

	s.running = true
	return nil
}

func (s *Supervisor) SendJob(jobID string, action string, config map[string]interface{}) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	jobPayload := map[string]interface{}{
		"job_id": jobID,
		"action": action,
		"config": config,
	}

	data, err := json.Marshal(jobPayload)
	if err != nil {
		return err
	}

	_, err = s.stdin.Write(append(data, '\n'))
	return err
}

func (s *Supervisor) Stop() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.stdin != nil {
		s.stdin.Close()
	}
	if s.cmd != nil && s.cmd.Process != nil {
		return s.cmd.Process.Kill()
	}
	s.running = false
	return nil
}
