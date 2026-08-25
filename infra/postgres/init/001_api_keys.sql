CREATE TABLE IF NOT EXISTS api_keys
(
    org_id TEXT NOT NULL,
    key_hash TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS api_keys_active_hash_idx
    ON api_keys (key_hash) WHERE revoked_at IS NULL;
