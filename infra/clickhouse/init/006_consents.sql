-- 006_consents.sql: Add consent_id to spans table

ALTER TABLE agentwatch.spans ADD COLUMN IF NOT EXISTS consent_id Nullable(String);
