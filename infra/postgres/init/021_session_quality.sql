-- 021_session_quality.sql: Session Quality, Retry Loops, and Misunderstanding Detection

CREATE TABLE IF NOT EXISTS session_quality (
    id BIGSERIAL PRIMARY KEY,
    org_id TEXT NOT NULL,
    session_id TEXT NOT NULL UNIQUE,
    agent_id TEXT NULL,
    user_id TEXT NULL,
    retry_count INT NOT NULL DEFAULT 0,
    total_tokens_in_loop INT NOT NULL DEFAULT 0,
    total_cost_in_loop DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    loop_type VARCHAR(64) NOT NULL DEFAULT 'misunderstanding_loop', -- 'misunderstanding_loop' | 'tool_arg_thrashing'
    similarity_scores JSONB DEFAULT '[]'::jsonb,
    sample_rephrasings JSONB DEFAULT '[]'::jsonb,
    tool_thrashing_detected BOOLEAN NOT NULL DEFAULT FALSE,
    task_completed BOOLEAN NOT NULL DEFAULT FALSE,
    flagged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_quality_org ON session_quality(org_id);
CREATE INDEX IF NOT EXISTS idx_session_quality_session ON session_quality(session_id);
CREATE INDEX IF NOT EXISTS idx_session_quality_cost ON session_quality(org_id, total_cost_in_loop DESC);
