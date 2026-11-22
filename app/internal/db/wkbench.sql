
CREATE TABLE IF NOT EXISTS models (
    id TEXT PRIMARY KEY,
    repo_id TEXT NOT NULL,
    revision TEXT,
    family TEXT NOT NULL DEFAULT 'qwen-vl',
    format TEXT NOT NULL DEFAULT 'hf-checkpoint',
    local_path TEXT NOT NULL,
    checksum TEXT,
    status TEXT NOT NULL DEFAULT 'downloading', -- downloading | ready | failed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
