-- 015_user_quotas.sql: End-User Level Quotas and Rate Limits

CREATE TABLE IF NOT EXISTS user_quota_configs
(
    id BIGSERIAL PRIMARY KEY,
    org_id TEXT NOT NULL,
    end_user_id VARCHAR(255) NULL, -- NULL indicates default org-wide limit per end user
    max_requests_per_day INT NOT NULL DEFAULT 1000,
    max_cost_per_day NUMERIC(10, 4) NOT NULL DEFAULT 5.0000,
    is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, end_user_id)
);

CREATE TABLE IF NOT EXISTS quota_exceeded_events
(
    id BIGSERIAL PRIMARY KEY,
    org_id TEXT NOT NULL,
    end_user_id VARCHAR(255) NOT NULL,
    limit_type VARCHAR(32) NOT NULL, -- 'requests_per_day' | 'cost_per_day' | 'manual_block'
    current_value NUMERIC(10, 4) NOT NULL,
    max_limit NUMERIC(10, 4) NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_quotas_org_idx ON user_quota_configs (org_id, end_user_id);
CREATE INDEX IF NOT EXISTS quota_events_org_idx ON quota_exceeded_events (org_id, detected_at DESC);
