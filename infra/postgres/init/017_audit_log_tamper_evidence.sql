-- 017_audit_log_tamper_evidence.sql: Tamper-Evident SHA-256 Audit Log Chaining & Append-Only Hardening

CREATE TABLE IF NOT EXISTS audit_logs
(
    id BIGSERIAL PRIMARY KEY,
    org_id TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    actor_email TEXT NULL,
    action VARCHAR(128) NOT NULL,
    target_type VARCHAR(64) NOT NULL,
    target_id TEXT NOT NULL,
    details JSONB NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    prev_hash VARCHAR(64) NOT NULL DEFAULT '0000000000000000000000000000000000000000000000000000000000000000',
    entry_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_org_chain_idx ON audit_logs (org_id, id ASC);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (org_id, created_at DESC);

-- Append-only trigger: strictly prevent any UPDATE or DELETE operations on audit_logs
CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable and tamper-evident. UPDATE and DELETE operations are strictly prohibited.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_mutation ON audit_logs;
CREATE TRIGGER trg_prevent_audit_log_mutation
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

-- Revoke mutation grants on the table for application roles
REVOKE UPDATE, DELETE ON audit_logs FROM PUBLIC;
