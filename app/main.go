package main

import (
	"context"
	"embed"
	"errors"
	"fmt"
	"log"
	"path/filepath"

	"app/internal/db"
	"app/internal/services"
	"app/internal/store"
	"app/internal/utils"
	"app/internal/workers"

	"github.com/wailsapp/wails/v3/pkg/application"
	_ "modernc.org/sqlite"
)

var workbenchWindow *application.WebviewWindow // handles UI layouts, etc

// Wails uses Go's `embed` package to embed the frontend files into the binary.
// Any files in the frontend/dist folder will be embedded into the binary and
// made available to the frontend.
// See https://pkg.go.dev/embed for more information.

//go:embed all:frontend/dist
var assets embed.FS

func init() {
	// Register a custom event whose associated data type is string.
	// Binding generator will pick up registered events and provide a strongly typed JS/TS API for them.
	application.RegisterEvent[map[string]any]("worker:event") // any event from worker
}

// main function serves as the application's entry point. It initializes the application, creates a window,
// It subsequently runs the application and logs any error that might occur.
func main() {
	// where python pipeline directory is located
	pipDir, err := utils.ResolvePipelineDir()
	if err != nil {
		log.Fatal(err)
	}
	artifactDir := filepath.Join(filepath.Dir(pipDir), "artifact")
	// setup SQLite database
	db, err := db.OpenSQLiteDB(pipDir)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	 modelStore := store.NewModel(db)
	// services
  supervisor := workers.NewSupervisor(pipDir, )
	modelService := services.NewModelService(modelStore, supervisor, artifactDir)
	windowService := &WindowService{}
	
 // Shut down worker when app closes
	workerCtx, cancelCtx := context.WithCancel(context.Background())
	defer func() {
		cancelCtx()
		if stopErr := supervisor.Stop(); err !=nil{
			 log.Printf("worker stop message :%w", stopErr)
		}
	}()

	if err := supervisor.Start(workerCtx); err != nil {
			log.Fatalf("start python worker: %v", err)
		}
	// Create a new Wails application by providing the necessary options.
	// Variables 'Name' and 'Description' are for application metadata.
	// 'Assets' configures the asset server with the 'FS' variable`assets`` pointing to the frontend files.
	// 'Bind' is a list of Go struct instances. The frontend has access to the methods of these instances.
	// 'Mac' options tailor the application when running an macOS.
	app := application.New(application.Options{
		Name:        "ML WorkBench",
		Description: "A minimal workbench for folks deploying minimal local AI models",
		Services: []application.Service{
			application.NewService(modelService),
			application.NewService(windowService),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	// Create a new window with the necessary options.
	// 'Title' is the title of the window.
	// 'Mac' options tailor the window when running on macOS.
	// 'BackgroundColour' is the background colour of the window.
	// 'URL' is the URL that will be loaded into the webview.
	workbenchWindow = app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:     "ML Workbench",
		Width:     1000,
		Height:    800,
		Frameless: true,
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		BackgroundColour: application.NewRGB(6, 7, 15),
		URL:              "/",
	})
  // app starts 
	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}

// WindowService exposes the small set of native window operations needed by
// the custom desktop title bar.
type WindowService struct{}

type toggleType string

const (
	minimize toggleType = "MINIMISE"
	maximise toggleType = "MAXIMISE"
	close    toggleType = "CLOSE"
)

func (w *WindowService) Toggle(sg toggleType) error {
	if workbenchWindow == nil {
		return fmt.Errorf("workbench window is not ready")
	}
	switch sg {
	case minimize:
		workbenchWindow.Minimise()
		return nil

	case maximise:
		workbenchWindow.Maximise()
		return nil

	case close:
		workbenchWindow.Close()
		return nil
	default:
		return errors.New("Invaild input!")
	}
}

func (w *WindowService) IsMaximised() bool {
	return workbenchWindow != nil && workbenchWindow.IsMaximised()
}
