package services

import (
	"app/internal/workers"
	"context"
	"maps"
)

type EmitFunction func(eventType string, data any)

// StreamWorkerEvents reads raw JSONL events from worker, updates SQLite
// records correlated by job_id, and forwards normalized payloads to Wails.
func StreamWorkerEvents(ctx context.Context, eventCh <- chan workers.RawEvent, ms *ModelService, emit EmitFunction) {
	for {
		select {
		case <-ctx.Done():
			return
		case raw, ok := <-eventCh:
			if !ok {
				return
			}
			if raw == nil {
				continue
			}
			// extract payload from events
			payload := maps.Clone(raw)
			eventType, _ := payload["event"].(string)
			jobID, _ := payload["job_id"].(string)
			if jobID == "" {
				jobID = "unknown"
				payload["job_id"] = jobID
			}

			if ms != nil {
			ms.ApplyWorkerEvent(eventType, jobID, payload)
			}
			if emit != nil {
				emit("worker:event", payload)
			}
		}
	}
}
