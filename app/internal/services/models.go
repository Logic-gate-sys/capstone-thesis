package services

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"sync"

	"app/internal/events"
	"app/internal/store"
	"app/internal/utils"
	"app/internal/workers"
)

type ModelService struct {
	modelStore *store.ModelStore
	worker     *workers.Worker
	modelsDir  string
	jobToModel map[string]string
	mu         sync.RWMutex
}

func NewModelService(mdStore *store.ModelStore, wk *workers.Worker, artifactDir string) *ModelService {
	return &ModelService{
		modelStore: mdStore,
		worker:     wk,
		modelsDir:  filepath.Join(artifactDir, "models"),
		jobToModel: make(map[string]string),
	}
}

func (ms *ModelService) SearchModels(query string, pipelineTag string, library string, limit int) (string, error) {
	if limit <= 0 {
		limit = 20
	}

	job := events.JobPayload{
		JobID:  utils.NewId("search"),
		Action: events.ActionSearch,
		Config: map[string]any{
			"query":        query,
			"pipeline_tag": pipelineTag,
			"library":      library,
			"limit":        limit,
		},
	}

	if err := ms.worker.Enqueue(context.Background(), job); err != nil {
		return "", fmt.Errorf("send search_model job: %w", err)
	}

	return job.JobID, nil
}

// StartModelDownload initializes a model record in SQLite and enqueues a download job.
func (ms *ModelService) StartModelDownload(repoID string, revision string, family string) (map[string]any, error) {
	if repoID == "" {
		return nil, errors.New("repo_id is required")
	}
	if revision == "" {
		revision = "main"
	}
	if family == "" {
		family = "qwen-vl"
	}

	modelRec := store.ModelRecord{
		ID:       utils.NewId("mdl"),
		RepoID:   repoID,
		Revision: revision,
		Family:   family,
		Format:   "hf-checkpoint",
		Status:   store.Downloading,
	}

	if err := ms.modelStore.InsertDownloadingModel(modelRec); err != nil {
		return nil, fmt.Errorf("insert downloading model: %w", err)
	}

	jobID := utils.NewId("dl")
	job := events.JobPayload{
		JobID:  jobID,
		Action: events.ActionDownload,
		Config: map[string]any{
			"repo_id":  repoID,
			"revision": revision,
			"save_dir": ms.modelsDir,
		},
	}

	ms.mu.Lock()
	ms.jobToModel[jobID] = modelRec.ID
	ms.mu.Unlock()

	if err := ms.worker.Enqueue(context.Background(), job); err != nil {
		_ = ms.modelStore.SetModelStatus(modelRec.ID, store.Failed)
		ms.clearJob(jobID)
		return nil, fmt.Errorf("send model_download job: %w", err)
	}

	return map[string]any{"job_id": jobID, "model": modelRec}, nil
}

// ListModels returns persisted models from SQLite.
func (ms *ModelService) ListModels() ([]store.ModelRecord, error) {
	return ms.modelStore.ListDownloadedModels()
}

func (ms *ModelService) ApplyWorkerEvent(eventType string, jobID string, payload workers.RawEvent) {
	ms.mu.RLock()
	modelID, tracked := ms.jobToModel[jobID]
	ms.mu.RUnlock()

	if !tracked {
		return
	}

	switch eventType {
	case "artifact":
		localPath, _ := payload["path"].(string)
		checksum, _ := payload["checksum"].(string)
		if localPath != "" {
			_ = ms.modelStore.SetModelArtifact(modelID, localPath, checksum)
		}
	case "complete":
		status, _ := payload["status"].(string)
		finalStatus := store.Ready
		if status != "success" {
			finalStatus = store.Failed
		}
		_ = ms.modelStore.SetModelStatus(modelID, finalStatus)
		ms.clearJob(jobID)
	case "error":
		_ = ms.modelStore.SetModelStatus(modelID, store.Failed)
		ms.clearJob(jobID)
	}
}

func (ms *ModelService) clearJob(jobID string) {
	ms.mu.Lock()
	delete(ms.jobToModel, jobID)
	ms.mu.Unlock()
}