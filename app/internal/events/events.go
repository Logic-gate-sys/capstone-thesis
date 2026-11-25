package events

type Actions string

const (
	ActionDownload Actions = "download_model"
	ActionSearch Actions = "search_model"
)

type JobPayload struct {
	JobID  string         `json:"job_id"`
	Action Actions        `json:"action"`
	Config map[string]any `json:"config"`
}
