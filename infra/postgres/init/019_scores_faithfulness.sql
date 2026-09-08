-- 019_scores_faithfulness.sql: Faithfulness Evaluation Scores, Versioned Judge Prompts & Evaluation Cost Tracking

CREATE TABLE IF NOT EXISTS scores
(
    id BIGSERIAL PRIMARY KEY,
    org_id TEXT NOT NULL,
    span_id TEXT NOT NULL,
    trace_id TEXT NULL,
    score_type VARCHAR(64) NOT NULL, -- e.g. 'faithfulness', 'hallucination', 'relevancy'
    value DOUBLE PRECISION NOT NULL,  -- normalized between 0.0 and 1.0
    unsupported_claims JSONB DEFAULT '[]'::jsonb,
    reasoning TEXT NULL,
    judge_model TEXT NOT NULL,
    judge_prompt_version VARCHAR(32) NOT NULL,
    prompt_tokens_eval INT NOT NULL DEFAULT 0,
    completion_tokens_eval INT NOT NULL DEFAULT 0,
    cost_usd_eval DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS scores_org_type_idx ON scores (org_id, score_type);
CREATE INDEX IF NOT EXISTS scores_span_idx ON scores (span_id);
CREATE INDEX IF NOT EXISTS scores_trace_idx ON scores (trace_id);
CREATE INDEX IF NOT EXISTS scores_judge_prompt_idx ON scores (judge_prompt_version);
