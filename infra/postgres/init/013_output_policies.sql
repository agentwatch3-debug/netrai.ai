-- 013_output_policies.sql: Output Policy Templates and Violations Ledger

CREATE TABLE IF NOT EXISTS policy_templates
(
    id BIGSERIAL PRIMARY KEY,
    org_id TEXT NOT NULL,
    industry VARCHAR(32) NOT NULL, -- 'banking' | 'healthcare' | 'insurance' | 'generic'
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    rules JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS output_policy_violations
(
    id BIGSERIAL PRIMARY KEY,
    org_id TEXT NOT NULL,
    agent_id TEXT NULL,
    trace_id TEXT NULL,
    span_id TEXT NULL,
    rule_name TEXT NOT NULL,
    action_taken VARCHAR(32) NOT NULL DEFAULT 'blocked', -- 'blocked' | 'flagged'
    matched_text TEXT NOT NULL,
    message TEXT NOT NULL,
    output_snippet TEXT NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS policy_templates_org_idx ON policy_templates (org_id, industry);
CREATE INDEX IF NOT EXISTS policy_violations_org_idx ON output_policy_violations (org_id, detected_at DESC);
