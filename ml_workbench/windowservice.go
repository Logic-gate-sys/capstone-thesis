package main

import "fmt"

// WindowService exposes the small set of native window operations needed by
// the custom desktop title bar.
type WindowService struct{}

func (w *WindowService) Minimise() error {
	if workbenchWindow == nil {
		return fmt.Errorf("workbench window is not ready")
	}
	workbenchWindow.Minimise()
	return nil
}

func (w *WindowService) ToggleMaximise() error {
	if workbenchWindow == nil {
		return fmt.Errorf("workbench window is not ready")
	}
	workbenchWindow.ToggleMaximise()
	return nil
}

func (w *WindowService) Close() error {
	if workbenchWindow == nil {
		return fmt.Errorf("workbench window is not ready")
	}
	workbenchWindow.Close()
	return nil
}

func (w *WindowService) IsMaximised() bool {
	return workbenchWindow != nil && workbenchWindow.IsMaximised()
}
