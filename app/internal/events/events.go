package events

type Actions string

const (
	ActionDownload Actions = "download_model"
	ActionSearch   Actions = "search_models"
)

type JobPayload struct {
	JobID  string         `json:"job_id"`
	Action Actions        `json:"action"`
	Config map[string]any `json:"config"`
}

type WorkerEventPayload struct {
	JobID string `json:"jobId"`
}

// categories of events worker emits
type EventType string

const (
	Progress      EventType = "progress"
	SearchResults EventType = "search_results"
	Complete      EventType = "complete"
)

type Model struct {
	RepoID       string   `json:"repo_id"`
	Author       string   `json:"author"`
	Downloads    string   `json:"downloads"`
	Likes        int      `json:"likes"`
	Size         string   `json:"size"`
	PipelineTag  string   `json:"pipeline_tag"`
	Tags         []string `json:"tags"`
	LibraryName  string   `json:"library_name"`
	LastModified string   `json:"last_modified"`
}


type EmittedEvent struct {
	JobId string 	`json:"job_id"`
	Type    EventType `json:"event_type"`
	
}