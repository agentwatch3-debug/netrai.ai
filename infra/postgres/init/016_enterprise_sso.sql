-- 016_enterprise_sso.sql: Enterprise SSO, SAML 2.0 / OIDC Identity Provider Configurations

-- Add SSO fields to organizations if not present
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sso_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sso_provider_config JSONB NULL;

-- Create dedicated SSO connections table
CREATE TABLE IF NOT EXISTS sso_connections
(
    id BIGSERIAL PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider VARCHAR(64) NOT NULL DEFAULT 'saml_custom', -- 'okta' | 'azure_ad' | 'google_workspace' | 'saml_custom'
    domain VARCHAR(255) NOT NULL,
    idp_entity_id TEXT NULL,
    idp_sso_url TEXT NULL,
    idp_certificate TEXT NULL,
    idp_metadata_url TEXT NULL,
    enforce_sso BOOLEAN NOT NULL DEFAULT FALSE,
    allow_idp_initiated BOOLEAN NOT NULL DEFAULT TRUE,
    status VARCHAR(32) NOT NULL DEFAULT 'pending', -- 'active' | 'pending' | 'disabled'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, domain)
);

CREATE INDEX IF NOT EXISTS sso_connections_org_idx ON sso_connections (org_id);
CREATE INDEX IF NOT EXISTS sso_connections_domain_idx ON sso_connections (domain);
