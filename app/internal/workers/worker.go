package workers

import (
	"app/internal/events"
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

type Worker struct {
	pipelineDir string
	mu          sync.Mutex
	cmd         *exec.Cmd
	stdin       io.WriteCloser
	stdout      io.ReadCloser
	stderr      io.ReadCloser
	closed       bool

	// channels
	eventsCh chan RawEvent
	jobsCh   chan events.JobPayload
	loopDone chan struct{}
}

// Supervising worker utilities and jsonl communication in the background needs  it's own struct with methods.
// When services needs to be spun up, measures must be taken to terminate underlying subprocess when no longer needed.
// Termination and setting up of subprocesses is synchronised deterministically
func NewWorker(pipelineDir string) *Worker {
	return &Worker{
		pipelineDir: pipelineDir,
		jobsCh:      make(chan events.JobPayload, 64),
		eventsCh:    make(chan RawEvent, 256),
	}
}

// Jobs return jobs channel directly so that services can enqueue to it
func (w *Worker) Jobs() chan<- events.JobPayload {
	return w.jobsCh
}

// returns events channel directly so that it can be subscribed to
func (w *Worker) Events() <- chan RawEvent {
	return w.eventsCh
}

// sends a job with context cancellation
func (w *Worker) Enqueue(ctx context.Context, job events.JobPayload) error {
	w.mu.Lock()
	isClosed := w.closed
	w.mu.Unlock()
	if isClosed {
		return errors.New("Worker is closed")
	}
	select {
		case w.jobsCh <- job:
		    return nil 
	  case <-ctx.Done():
			return ctx.Err()
	}
}

// Start: starts worker in the background. Locks sync.Mux for the process to prevent multiple starts of
// the same instance.
func (w *Worker) Start(ctx context.Context) error {
	w.mu.Lock()
	if w.cmd != nil {
		w.mu.Unlock()
		return nil
	}
	w.closed = false
  // starts the python JSONL worker  in a subprocess 
	cmd := exec.CommandContext(ctx, "uv", "run", "--no-sync", "python", "src/main.py")
	cmd.Dir = w.pipelineDir

	stdin, err := cmd.StdinPipe()
	if err != nil {
		w.mu.Unlock()
		return fmt.Errorf("stdin pipe: %w", err)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		w.mu.Unlock()
		return fmt.Errorf("stdout pipe: %w", err)
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		w.mu.Unlock()
		return fmt.Errorf("stderr pipe: %w", err)
	}
	if err := cmd.Start(); err != nil {
		w.mu.Unlock()
		return fmt.Errorf("start uv worker: %w", err)
	}

	loopDone := make(chan struct{})
	w.cmd = cmd
	w.stdin = stdin
	w.stdout = stdout
	w.stderr = stderr
	w.loopDone = loopDone
	w.mu.Unlock()

	go w.writeJobsLoop(ctx, stdin)
	go w.readStdout(stdout, loopDone)
	go w.drainStderr(stderr)

	return nil
}

// Continuously scans jobs channle and write any jobs down the stdin to python worker 
func (w *Worker) writeJobsLoop(ctx context.Context, stdin io.WriteCloser) {
	defer stdin.Close()

	for {
		select {
		case <-ctx.Done():
			return
		case job, ok := <- w.jobsCh:
			if !ok {return}
			encoded, err := json.Marshal(job)
			if err != nil {
				w.emit(RawEvent{
					"event":   "error",
					"job_id":  job.JobID,
					"message": fmt.Sprintf("marshal job: %v", err),
				})
				continue
			}
			encoded = append(encoded, '\n') // python worker reads JSON line by line
			if _, err := stdin.Write(encoded); err != nil {
				w.emit(RawEvent{
					"event":   "error",
					"job_id":  job.JobID,
					"message": fmt.Sprintf("write stdin: %v", err),
				})
				return
			}
		}
	}
}

// Continously scan stdout and writes any availabel output to events channel so subscribers can consume. 
func (w *Worker) readStdout(stdout io.ReadCloser, loopDone chan struct{}) {
	defer close(loopDone)
	defer stdout.Close()

	scanner := bufio.NewScanner(stdout)
	scanner.Buffer(make([]byte, 64*1024), 4*1024*1024) // 4MB of 64kb 

	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {continue}

		var payload RawEvent
		if err := json.Unmarshal(line, &payload); err != nil {
			w.emit(RawEvent{
				"event":   "error",
				"job_id":  "unknown",
				"message": fmt.Sprintf("invalid JSON from worker: %v", err),
				"raw":     string(line),
			})
			continue
		}

		if _, ok := payload["job_id"].(string); !ok || payload["job_id"] == "" {
			payload["job_id"] = "unknown"
		}
		// emit payload 
		w.emit(payload)
	}

	if err := scanner.Err(); err != nil {
		w.emit(RawEvent{
			"event":   "error",
			"job_id":  "worker",
			"message": fmt.Sprintf("stdout scanner error: %v", err),
		})
	}
}

// Read continously for any errors and emit if any errors is found in stderr
func (w *Worker) drainStderr(stderr io.ReadCloser) {
	defer stderr.Close()
	scanner := bufio.NewScanner(stderr)
	scanner.Buffer(make([]byte, 32*1024), 1024*1024) // 32kb of 1MB buffer 

	for scanner.Scan() {
		text := scanner.Text()
		if text != "" {
			w.emit(RawEvent{
				"event":   "log",
				"job_id":  "worker",
				"stream":  "stderr",
				"message": text,
			})
		}
		// scanner errors
	if err := scanner.Err(); err !=nil{
   w.emit(RawEvent{
			"event":   "log",
			"job_id":  "worker",
			"stream":  "stderr",
			"message": err.Error(),
		})
   }
	}
}

func (w *Worker) Stop() error {
	w.mu.Lock()
	if w.closed {
		w.mu.Unlock()
		return nil
	}
	w.closed = true
	cmd := w.cmd
	loopDone := w.loopDone
	w.cmd = nil
	w.stdin = nil
	w.stdout = nil
	w.stderr = nil
	w.loopDone = nil
	close(w.jobsCh)
	w.mu.Unlock()

	if cmd == nil {
		close(w.eventsCh)
		return nil
	}

	if loopDone != nil {<-loopDone}
	err := cmd.Wait() // close worker 
	close(w.eventsCh)

	if err != nil {
		var exitErr *exec.ExitError
		if !errors.As(err, &exitErr) {
			return err
		}
	}
	return nil
}


// Sends any worker events to events channel so that other services can subscribe and read from it
func (w *Worker) emit(ev RawEvent) {
	w.mu.Lock()
	closed := w.closed
	w.mu.Unlock()
	if closed {return}

	select {
	case w.eventsCh <- ev:
	default:
		// Avoid blocking stdout/stderr readers if consumer lags.
	}
}