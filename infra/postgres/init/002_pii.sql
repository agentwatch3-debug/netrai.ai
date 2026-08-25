ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS scopes TEXT[] NOT NULL DEFAULT ARRAY['ingest'];

CREATE TABLE IF NOT EXISTS pii_mappings
(
    org_id TEXT NOT NULL,
    span_id TEXT NOT NULL,
    token TEXT NOT NULL,
    encrypted_value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (org_id, span_id, token)
);

CREATE TABLE IF NOT EXISTS audit_log
(
    id BIGSERIAL PRIMARY KEY,
    org_id TEXT NOT NULL,
    api_key_hash TEXT NOT NULL,
    action TEXT NOT NULL,
    span_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
