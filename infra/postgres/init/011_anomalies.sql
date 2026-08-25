-- 011_anomalies.sql: Scope-Drift Baselines & Anomaly Audit Logging

CREATE TABLE IF NOT EXISTS agent_baselines
(
    id BIGSERIAL PRIMARY KEY,
    org_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    resource_type VARCHAR(32) NOT NULL, -- 'tool' | 'resource'
    resource_name VARCHAR(255) NOT NULL,
    added_by VARCHAR(64) NOT NULL DEFAULT 'auto', -- 'auto' | 'user_approved'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, agent_id, resource_type, resource_name)
);

CREATE TABLE IF NOT EXISTS anomalies
(
    id BIGSERIAL PRIMARY KEY,
    org_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    trace_id TEXT NULL,
    span_id TEXT NOT NULL,
    anomaly_type VARCHAR(64) NOT NULL, -- 'new_tool' | 'new_resource'
    resource_name VARCHAR(255) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at TIMESTAMPTZ NULL,
    resolved_by TEXT NULL,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS anomalies_org_resolved_idx ON anomalies (org_id, resolved, detected_at DESC);
CREATE INDEX IF NOT EXISTS anomalies_agent_idx ON anomalies (agent_id);
CREATE INDEX IF NOT EXISTS agent_baselines_lookup_idx ON agent_baselines (org_id, agent_id);
