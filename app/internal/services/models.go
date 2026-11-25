package services

import (
	"app/internal/events"
	"app/internal/store"
	"app/internal/utils"
	"app/internal/workers"
	"fmt"
	"path/filepath"
	"sync"
)

type ModelService struct {
	modelStore *store.ModelStore
	worker     *workers.Supervisor
	modelsDir  string 
	mu         sync.RWMutex
}

func NewModelService(mdStore *store.ModelStore, wk *workers.Supervisor, artifactDir string ) *ModelService {
	return &ModelService{
		modelStore: mdStore,
		worker:     wk,
		modelsDir: filepath.Join(artifactDir, "models"),
	}
}

func (mds *ModelService) SearchModels(query string, pipelineTag string, library string, limit int) (string, error) {
	if limit <= 0 {
		limit = 20
	}
	// configure job
	job := events.JobPayload{
		JobID:  utils.NewId("search"),
		Action: events.ActionSearch,
		Config: map[string]any{
			"query":    query,
			"pipeline": pipelineTag,
			"library":  library,
			"limit":    limit,
		},
	}
	// execute job
	if err := mds.worker.SendJob(job) ; err !=nil{
		return "", fmt.Errorf("send search_model job: %w", err)
	}
	// return job id
	return job.JobID, nil
}

// Hanldes model download initialisation
func (mds *ModelService) StartModelDownload(repoID string, revision string, family string) (map[string]any, error) {
	modelRec := store.ModelRecord{
		ID: utils.NewId("mdl"),
		RepoID: repoID,
		Revision: revision,
		Family: family,
		Format: "hf-checkpoint",
		Status: store.Downloading,
	}
	// insert initial download records into db
	if err := mds.modelStore.InsertDownloadingModel(modelRec); err != nil {
			return nil, fmt.Errorf("insert downloading model: %w", err)
		}
	//configure job to be sent
	mds.mu.Lock()
	

	job := events.JobPayload{
			JobID:  utils.NewId("dl"),
			Action: events.ActionDownload,
			Config: map[string]any{
				"repo_id":  repoID,
				"revision": revision,
				"save_dir": mds.modelsDir,
			},
		}

	if err := mds.worker.SendJob(job); err !=nil{
		_ = mds.modelStore.SetModelStatus(modelRec.ID, store.Failed)
		return nil , fmt.Errorf("sends model_download job: %w", err)
	}

	// while work happens in the background reutrn model top records
	return map[string]any{"job_id": job.JobID, "model": modelRec}, nil
}

//Lists available models in DB 
func (mds *ModelService) ListModels() ([]store.ModelRecord, error) {
	return mds.modelStore.ListDownloadedModels()
}



// func (s *ModelService) HandleWorkerEvent(eventType string, jobID string, payload workers.RawEvent) {
// 	s.mu.RLock()
// 	modelID, tracked := s.jobToModel[jobID]
// 	s.mu.RUnlock()
// 
// 	if tracked {
// 		switch eventType {
// 		case "artifact":
// 			localPath, _ := payload["path"].(string)
// 			checksum, _ := payload["checksum"].(string)
// 			if localPath != "" {
// 				_ = s.modelStore.SetModelArtifact(modelID, localPath, checksum)
// 			}
// 		case "complete":
// 			status, _ := payload["status"].(string)
// 			finalStatus := "ready"
// 			if status != "success" {
// 				finalStatus = "failed"
// 			}
// 			_ = s.modelStore.SetModelStatus(modelID, finalStatus)
// 			s.clearJob(jobID)
// 		case "error":
// 			_ = s.modelStore.SetModelStatus(modelID, "failed")
// 			s.clearJob(jobID)
// 		}
// 	}
// 
// 	if s.emitEvent != nil {
// 		s.emitEvent("worker:event", payload)
// 	}
// }
// 
// func (s *ModelService) clearJob(jobID string) {
// 	s.mu.Lock()
// 	delete(s.jobToModel, jobID)
// 	s.mu.Unlock()
// }