-- 012_consents.sql: User Consent Linkage & PII Compliance Gaps

CREATE TABLE IF NOT EXISTS consents
(
    id BIGSERIAL PRIMARY KEY,
    org_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    consent_type VARCHAR(64) NOT NULL, -- 'ai_processing' | 'marketing' | 'analytics' | 'support'
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ NULL,
    consent_reference TEXT NOT NULL, -- e.g. Form ID, Terms v2.1, or Timestamped Signature
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compliance_gaps
(
    id BIGSERIAL PRIMARY KEY,
    org_id TEXT NOT NULL,
    trace_id TEXT NOT NULL,
    span_id TEXT NOT NULL,
    agent_id TEXT NULL,
    user_id TEXT NULL,
    pii_types TEXT[] NOT NULL DEFAULT '{}',
    gap_reason TEXT NOT NULL DEFAULT 'PII accessed without linked consent_id',
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS consents_org_user_idx ON consents (org_id, user_id);
CREATE INDEX IF NOT EXISTS compliance_gaps_org_idx ON compliance_gaps (org_id, detected_at DESC);
