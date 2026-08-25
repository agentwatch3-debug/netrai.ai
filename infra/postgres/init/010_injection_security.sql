-- 010_injection_security.sql: Prompt Injection Security & Incident Audit Logging

ALTER TABLE orgs ADD COLUMN IF NOT EXISTS injection_threshold NUMERIC(3, 2) NOT NULL DEFAULT 0.70;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS injection_policy_mode VARCHAR(32) NOT NULL DEFAULT 'block'; -- 'block' | 'alert'

CREATE TABLE IF NOT EXISTS injection_logs
(
    id BIGSERIAL PRIMARY KEY,
    org_id TEXT NOT NULL,
    agent_id TEXT NULL,
    trace_id TEXT NULL,
    span_id TEXT NULL,
    user_input TEXT NOT NULL,
    risk_score NUMERIC(3, 2) NOT NULL,
    flags TEXT[] DEFAULT '{}',
    action_taken VARCHAR(32) NOT NULL DEFAULT 'blocked', -- 'blocked' | 'flagged'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS injection_logs_org_created_idx ON injection_logs (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS injection_logs_agent_idx ON injection_logs (agent_id);
