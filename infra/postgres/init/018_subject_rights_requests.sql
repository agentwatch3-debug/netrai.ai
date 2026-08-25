-- 018_subject_rights_requests.sql: GDPR / CCPA Subject Rights Erasure and Export Requests

CREATE TABLE IF NOT EXISTS subject_rights_requests
(
    id BIGSERIAL PRIMARY KEY,
    org_id TEXT NOT NULL,
    request_type VARCHAR(32) NOT NULL DEFAULT 'erasure', -- 'erasure' | 'export'
    end_user_id VARCHAR(255) NOT NULL,
    requested_by TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending_approval', -- 'pending_approval' | 'approved' | 'completed' | 'rejected'
    spans_count INT NOT NULL DEFAULT 0,
    pii_records_count INT NOT NULL DEFAULT 0,
    export_archive_url TEXT NULL,
    export_expires_at TIMESTAMPTZ NULL,
    approved_by TEXT NULL,
    approved_at TIMESTAMPTZ NULL,
    deleted_spans_count INT NOT NULL DEFAULT 0,
    deleted_pii_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS subject_rights_org_idx ON subject_rights_requests (org_id, status);
CREATE INDEX IF NOT EXISTS subject_rights_user_idx ON subject_rights_requests (org_id, end_user_id);
