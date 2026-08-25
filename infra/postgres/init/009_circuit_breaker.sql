-- 009_circuit_breaker.sql: Automated Cost Runaway Circuit Breaker & Kill-Switch

ALTER TABLE orgs ADD COLUMN IF NOT EXISTS is_throttled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS throttled_reason TEXT NULL;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS throttled_at TIMESTAMPTZ NULL;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS max_cost_velocity_5m NUMERIC(10, 4) NOT NULL DEFAULT 50.0;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS max_tool_call_loop_count INT NOT NULL DEFAULT 30;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS emergency_webhook_url TEXT NULL;

CREATE TABLE IF NOT EXISTS circuit_breaker_events
(
    id BIGSERIAL PRIMARY KEY,
    org_id TEXT NOT NULL,
    agent_id TEXT NULL,
    trigger_type VARCHAR(64) NOT NULL, -- 'cost_velocity_spike' | 'infinite_tool_loop'
    cost_at_trigger NUMERIC(10, 4) NULL,
    loop_count INT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    action_taken VARCHAR(64) NOT NULL DEFAULT 'throttled', -- 'throttled' | 'key_revoked'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS circuit_breaker_org_idx ON circuit_breaker_events (org_id, created_at DESC);
