-- 004_injection_spans.sql: Add injection_risk_score and injection_flags to spans table

ALTER TABLE agentwatch.spans ADD COLUMN IF NOT EXISTS injection_risk_score Nullable(Float32);
ALTER TABLE agentwatch.spans ADD COLUMN IF NOT EXISTS injection_flags Array(String);
