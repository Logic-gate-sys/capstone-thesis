package db

import (
	"database/sql"
	_ "embed"
	"fmt"
	"os"
	"path/filepath"
)

//go:embed wkbench.sql
var schema string

var schemaSQL string

//Opens a connection to SQLite database and return reference to the database or error 
func OpenSQLiteDB(pipelineDir string) (*sql.DB, error) {
	dbPath := filepath.Join(pipelineDir, "..", "artifacts", "wkbench.sqlite")
	if err := os.MkdirAll(filepath.Dir(dbPath), 0o755); err != nil {
		return nil, fmt.Errorf("create artifacts dir: %w", err)
	}

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("open sqlite db: %w", err)
	}

	if _, err := db.Exec(schema); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("apply wkbench.sql schema: %w", err)
	}

	return db, nil
}
