-- 007_evals.sql: Automated Evals, Configs, and Quality Scorecards

CREATE TABLE IF NOT EXISTS eval_configs
(
    id BIGSERIAL PRIMARY KEY,
    org_id TEXT NOT NULL,
    name TEXT NOT NULL,
    eval_type VARCHAR(64) NOT NULL, -- 'llm_judge', 'hallucination', 'relevancy', 'tool_correctness', 'json_validity'
    target_agent_id TEXT NULL,     -- Specific agent or NULL for all agents
    model TEXT NULL DEFAULT 'gpt-4.1-mini',
    prompt_template TEXT NULL,
    sampling_rate DOUBLE PRECISION NOT NULL DEFAULT 1.0, -- 0.0 to 1.0 (100% of spans)
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS eval_configs_org_active_idx 
    ON eval_configs (org_id) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS eval_scores
(
    id BIGSERIAL PRIMARY KEY,
    org_id TEXT NOT NULL,
    span_id TEXT NOT NULL,
    trace_id TEXT NOT NULL,
    score_name VARCHAR(128) NOT NULL,
    score_value DOUBLE PRECISION NOT NULL, -- normalized between 0.0 and 1.0 (or -1/1 for thumbs)
    reasoning TEXT NULL,
    evaluator_type VARCHAR(32) NOT NULL DEFAULT 'automated', -- 'automated', 'human', 'rule'
    evaluator_model TEXT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS eval_scores_span_idx ON eval_scores (span_id);
CREATE INDEX IF NOT EXISTS eval_scores_trace_idx ON eval_scores (trace_id);
CREATE INDEX IF NOT EXISTS eval_scores_org_name_idx ON eval_scores (org_id, score_name);
