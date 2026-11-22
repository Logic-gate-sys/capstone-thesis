package services

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"path/filepath"
	"sync"
)

type JobSender interface {
	SendJob(jobID string, action string, config map[string]any) error
}

type ModelRecord struct {
	ID        string `json:"id"`
	RepoID    string `json:"repo_id"`
	Revision  string `json:"revision"`
	Family    string `json:"family"`
	Format    string `json:"format"`
	LocalPath string `json:"local_path"`
	Checksum  string `json:"checksum"`
	Status    string `json:"status"`
}

type ModelService struct {
	db           *sql.DB
	sender       JobSender
	modelsDir    string
	onStateEvent func(eventName string, data any)

	mu         sync.RWMutex
	jobToModel map[string]string
}

func NewModelService(
	db *sql.DB,
	sender JobSender,
	artifactsDir string,
	onStateEvent func(eventName string, data any),
) *ModelService {
	return &ModelService{
		db:           db,
		sender:       sender,
		modelsDir:    filepath.Join(artifactsDir, "models"),
		onStateEvent: onStateEvent,
		jobToModel:   make(map[string]string),
	}
}

func newID(prefix string) string {
	buf := make([]byte, 4)
	_, _ = rand.Read(buf)
	return prefix + "_" + hex.EncodeToString(buf)
}

func (s *ModelService) SearchModels(query, pipelineTag, library string, limit int) (string, error) {
	if limit <= 0 {
		limit = 20
	}
	jobID := newID("search")
	err := s.sender.SendJob(jobID, "search_models", map[string]any{
		"query":        query,
		"pipeline_tag": pipelineTag,
		"library":      library,
		"limit":        limit,
	})
	if err != nil {
		return "", err
	}
	return jobID, nil
}

func (s *ModelService) DownloadModel(repoID, revision, family string) (ModelRecord, string, error) {
	if repoID == "" {
		return ModelRecord{}, "", errors.New("repo_id is required")
	}
	if revision == "" {
		revision = "main"
	}
	if family == "" {
		family = "qwen-vl"
	}

	modelID := newID("mdl")
	jobID := newID("dl")

	rec := ModelRecord{
		ID:       modelID,
		RepoID:   repoID,
		Revision: revision,
		Family:   family,
		Format:   "hf-checkpoint",
		Status:   "downloading",
	}

	_, err := s.db.Exec(
		`INSERT INTO models (id, repo_id, revision, family, format, local_path, checksum, status)
		 VALUES (?, ?, ?, ?, ?, '', '', 'downloading')`,
		rec.ID, rec.RepoID, rec.Revision, rec.Family, rec.Format,
	)
	if err != nil {
		return ModelRecord{}, "", fmt.Errorf("insert model record: %w", err)
	}

	s.mu.Lock()
	s.jobToModel[jobID] = modelID
	s.mu.Unlock()

	err = s.sender.SendJob(jobID, "download_model", map[string]any{
		"repo_id":  repoID,
		"revision": revision,
		"save_dir": s.modelsDir,
	})
	if err != nil {
		_, _ = s.db.Exec(`UPDATE models SET status = 'failed' WHERE id = ?`, modelID)
		s.mu.Lock()
		delete(s.jobToModel, jobID)
		s.mu.Unlock()
		return ModelRecord{}, "", err
	}

	return rec, jobID, nil
}

func (s *ModelService) ListModels() ([]ModelRecord, error) {
	rows, err := s.db.Query(
		`SELECT id, repo_id, COALESCE(revision, ''), family, format, local_path, COALESCE(checksum, ''), status
		 FROM models ORDER BY created_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []ModelRecord
	for rows.Next() {
		var m ModelRecord
		if err := rows.Scan(&m.ID, &m.RepoID, &m.Revision, &m.Family, &m.Format, &m.LocalPath, &m.Checksum, &m.Status); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (s *ModelService) HandleWorkerEvent(eventType string, jobID string, payload map[string]any) {
	s.mu.RLock()
	modelID, isModelDownload := s.jobToModel[jobID]
	s.mu.RUnlock()

	if isModelDownload {
		switch eventType {
		case "artifact":
			localPath, _ := payload["path"].(string)
			checksum, _ := payload["checksum"].(string)
			if localPath != "" {
				_, _ = s.db.Exec(
					`UPDATE models SET local_path = ?, checksum = ? WHERE id = ?`,
					localPath, checksum, modelID,
				)
			}
		case "complete":
			status, _ := payload["status"].(string)
			finalStatus := "ready"
			if status != "success" {
				finalStatus = "failed"
			}
			_, _ = s.db.Exec(`UPDATE models SET status = ? WHERE id = ?`, finalStatus, modelID)
			s.clearJob(jobID)
		case "error":
			_, _ = s.db.Exec(`UPDATE models SET status = 'failed' WHERE id = ?`, modelID)
			s.clearJob(jobID)
		}
	}

	if s.onStateEvent != nil {
		s.onStateEvent("worker:event", payload)
	}
}

func (s *ModelService) clearJob(jobID string) {
	s.mu.Lock()
	delete(s.jobToModel, jobID)
	s.mu.Unlock()
}