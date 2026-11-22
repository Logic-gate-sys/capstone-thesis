package main

import (
	"context"
	"database/sql"
	"embed"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	_ "modernc.org/sqlite"
	"app/internal/services"
	"app/internal/workers"
)

var workbenchWindow *application.WebviewWindow

// Wails uses Go's `embed` package to embed the frontend files into the binary.
// Any files in the frontend/dist folder will be embedded into the binary and
// made available to the frontend.
// See https://pkg.go.dev/embed for more information.

//go:embed all:frontend/dist
var assets embed.FS

//go:embed internal/db/wkbench.sql
var schemaSQL string


func init() {
	// Register a custom event whose associated data type is string.
	// This is not required, but the binding generator will pick up registered events
	// and provide a strongly typed JS/TS API for them.
	application.RegisterEvent[string]("time")
	application.RegisterEvent[map[string]any]("worker:event")
}

func resolvePipelineDir() (string, error) {
	cwd, err := os.Getwd()
	if err != nil {
		return "", err
	}
	dir := cwd
	for {
		candidate := filepath.Join(dir, "pipeline")
		if _, err := os.Stat(filepath.Join(candidate, "pyproject.toml")); err == nil {
			return candidate, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", fmt.Errorf("could not locate pipeline/pyproject.toml starting from %s", cwd)
		}
		dir = parent
	}
}


func openSQLiteDB(pipelineDir string) (*sql.DB, error) {
	dbPath := filepath.Join(pipelineDir, "..", "artifacts", "wkbench.sqlite")
	if err := os.MkdirAll(filepath.Dir(dbPath), 0o755); err != nil {
		return nil, fmt.Errorf("create artifacts dir: %w", err)
	}

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("open sqlite db: %w", err)
	}

	if _, err := db.Exec(schemaSQL); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("apply wkbench.sql schema: %w", err)
	}

	return db, nil
}



// main function serves as the application's entry point. It initializes the application, creates a window,
// and starts a goroutine that emits a time-based event every second. It subsequently runs the application and
// logs any error that might occur.
func main() {
	pipelineDir, err := resolvePipelineDir()
	if err != nil {
		log.Fatal(err)
	}

	db, err := openSQLiteDB(pipelineDir)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	pipelineSvc := NewPipelineService()
	windowSvc := &WindowService{}

	// Create a new Wails application by providing the necessary options.
	// Variables 'Name' and 'Description' are for application metadata.
	// 'Assets' configures the asset server with the 'FS' vari `21ece pointing to the frontend files.
	// 'Bind' is a list of Go struct instances. The frontend has access to the methods of these instances.
	// 'Mac' options tailor the application when running an macOS.
	app := application.New(application.Options{
		Name:        "ML WorkBench",
		Description: "A minimal workbench for folks deploying minimal local AI models",
		Services: []application.Service{
			application.NewService(pipelineSvc),
			application.NewService(windowSvc),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	artifactsDir := filepath.Join(filepath.Dir(pipelineDir), "artifacts")

	var modelSvc *services.ModelService
	supervisor := workers.NewSupervisor(pipelineDir, func(eventType string, jobID string, payload workers.RawEvent) {
		if modelSvc != nil {
			modelSvc.HandleWorkerEvent(eventType, jobID, payload)
		}
	})

	modelSvc = services.NewModelService(db, supervisor, artifactsDir, func(eventName string, data any) {
		pipelineSvc.EmitWorkerEvent(eventName, data)
	})

	pipelineSvc.Bind(app, modelSvc)

	workerCtx, cancelWorker := context.WithCancel(context.Background())
	defer func() {
		cancelWorker()
		if stopErr := supervisor.Stop(); stopErr != nil {
			log.Printf("worker stop warning: %v", stopErr)
		}
	}()

	if err := supervisor.Start(workerCtx); err != nil {
		log.Fatalf("failed to start python worker: %v", err)
	}

	// Create a new window with the necessary options.
	// 'Title' is the title of the window.
	// 'Mac' options tailor the window when running on macOS.
	// 'BackgroundColour' is the background colour of the window.
	// 'URL' is the URL that will be loaded into the webview.
	workbenchWindow = app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:     "ML Workbench",
		Width:     1000,
		Height:    618,
		Frameless: true,
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		BackgroundColour: application.NewRGB(6, 7, 15),
		URL:              "/",
	})

	go func() {
		ticker := time.NewTicker(time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-workerCtx.Done():
				return
			case now := <-ticker.C:
				app.Event.Emit("time", now.Format(time.RFC1123))
			}
		}
	}()

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}