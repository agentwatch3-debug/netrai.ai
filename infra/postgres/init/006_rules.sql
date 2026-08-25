-- 006_rules.sql: Alert Rules and Tool-Call Blocking Policy Rules

CREATE TABLE IF NOT EXISTS alert_rules
(
    id BIGSERIAL PRIMARY KEY,
    org_id TEXT NOT NULL,
    condition_type VARCHAR(64) NOT NULL,
    threshold DOUBLE PRECISION NOT NULL,
    webhook_url TEXT NOT NULL,
    window_minutes INTEGER NOT NULL DEFAULT 15,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    last_triggered_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS alert_rules_org_active_idx 
    ON alert_rules (org_id) WHERE is_enabled = TRUE;

CREATE TABLE IF NOT EXISTS policy_rules
(
    id BIGSERIAL PRIMARY KEY,
    org_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    blocked_tool_names TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_org_agent_policy UNIQUE (org_id, agent_id)
);

CREATE INDEX IF NOT EXISTS policy_rules_org_agent_idx 
    ON policy_rules (org_id, agent_id);
