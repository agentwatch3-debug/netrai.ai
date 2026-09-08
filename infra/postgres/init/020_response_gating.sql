-- 020_response_gating.sql: Response-gating and eval gate policy rules

CREATE TABLE IF NOT EXISTS eval_gate_rules
(
    id BIGSERIAL PRIMARY KEY,
    org_id TEXT NOT NULL,
    agent_id TEXT NOT NULL DEFAULT '*',
    score_type VARCHAR(64) NOT NULL, -- 'faithfulness' | 'factuality'
    threshold DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    action VARCHAR(32) NOT NULL DEFAULT 'block', -- 'block' | 'flag' | 'reroute_to_model'
    fallback_model VARCHAR(128) NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS eval_gate_rules_org_idx ON eval_gate_rules (org_id, is_enabled);
CREATE INDEX IF NOT EXISTS eval_gate_rules_org_agent_idx ON eval_gate_rules (org_id, agent_id);
