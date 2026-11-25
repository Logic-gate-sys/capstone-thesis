package utils

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
)


func NewId(prefix string) string{
	// make a byte of size 4 & fill with random bytes
	b := make([]byte, 4)
	_, _ = rand.Read(b)
	return prefix + "_" + hex.EncodeToString(b)
}


func ResolvePipelineDir() (string, error) {
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