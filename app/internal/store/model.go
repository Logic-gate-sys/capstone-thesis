package store

import (
	"database/sql"
	"fmt"
)

type Status string 
const (
	Downloading Status = "downloading"
	Failed      Status = "failed"
	Ready        Status = "ready"
)

// Model struct
type ModelRecord struct {
	ID        string `json:"id"`
	RepoID    string `json:"repo_id"`
	Revision  string `json:"revision"`
	Family    string `json:"family"`
	Format    string `json:"format"`
	LocalPath string `json:"local_path"`
	Checksum  string `json:"checksum"`
	Status    Status `json:"status"`
}

// Model store interface for interacting with model records in database. 
type ModelStore struct {
	db *sql.DB
}

func NewModel(db *sql.DB) *ModelStore {
	return &ModelStore{
		db: db,
	}
}

// Creates a record for a downloaded model in the local sqlite databse
func (s *ModelStore) InsertDownloadingModel(m ModelRecord) error {
	query := 	`INSERT INTO models (id, repo_id, revision, family, format, local_path, checksum, status)
	 					VALUES (?, ?, ?, ?, ?, '', '', 'downloading')`
	//execute query 
	_, err := s.db.Exec(query,m.ID, m.RepoID, m.Revision, m.Family, m.Format)
	if err != nil {
		return fmt.Errorf("insert downloading model: %w", err)
	}
	return nil
}

// Sets models local artifact location upons successful model download
func (s *ModelStore) SetModelArtifact(id, localPath, checksum string) error {
	query := `UPDATE models SET local_path = ?, checksum = ? WHERE id = ?`
	_, err := s.db.Exec(
		query,
		localPath, checksum, id,
	)
	return err
}

// Removes a models record when model is deleted
func (s *ModelStore) DeleteModelRecord(id string) error  {
	query := `DELETE * FROM models WHERE id = $1`
  if	_, err := s.db.Exec(query, id); err != nil{
    return err 
  }
  return nil
}

func (s *ModelStore) ListDownloadedModels () ([]ModelRecord, error){
  query := `SELECT id, repo_id, COALESCE(revision, ''), family, format, local_path, 
  					COALESCE(checksum, ''), status  
       			FROM models`
  rows, err := s.db.Query(query)
  if  err !=nil{
     return nil, err
  }
  var mdRecs []ModelRecord
  for rows.Next(){
   var md ModelRecord
   if err := rows.Scan(&md.ID, &md.RepoID, &md.Revision, &md.Family, &md.Format, &md.LocalPath, &md.Checksum); 
   err !=nil{
     return nil, err
   }
   mdRecs = append(mdRecs, md)
  }
  // return mdRecords and error
  return mdRecs, rows.Err()
}


func (s *ModelStore) SetModelStatus(id string, status Status) error {
	_, err := s.db.Exec(`UPDATE models SET status = ? WHERE id = ?`, status, id)
	return err
}


