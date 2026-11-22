package main

import (
	"context"

	"github.com/wailsapp/wails/v3/pkg/application"

	"app/internal/services"
)

type PipelineService struct {
	app         *application.App
	modelSvc    *services.ModelService
	shutdownCtx context.Context
}

func NewPipelineService() *PipelineService {
	return &PipelineService{}
}

func (p *PipelineService) Bind(app *application.App, modelSvc *services.ModelService) {
	p.app = app
	p.modelSvc = modelSvc
}

func (p *PipelineService) ServiceStartup(ctx context.Context, _ application.ServiceOptions) error {
	p.shutdownCtx = ctx
	return nil
}

func (p *PipelineService) SearchModels(query string, pipelineTag string, library string, limit int) (string, error) {
	return p.modelSvc.SearchModels(query, pipelineTag, library, limit)
}

func (p *PipelineService) StartModelDownload(repoID string, revision string, family string) (map[string]any, error) {
	rec, jobID, err := p.modelSvc.DownloadModel(repoID, revision, family)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"model":  rec,
		"job_id": jobID,
	}, nil
}

func (p *PipelineService) ListModels() ([]services.ModelRecord, error) {
	return p.modelSvc.ListModels()
}

func (p *PipelineService) EmitWorkerEvent(eventName string, data any) {
	if p.app != nil {
		p.app.Event.Emit(eventName, data)
	}
}