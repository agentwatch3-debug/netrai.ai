-- 003_sessions.sql: Add session_id and user_id columns to spans table for multi-turn threading

ALTER TABLE agentwatch.spans ADD COLUMN IF NOT EXISTS session_id Nullable(String);
ALTER TABLE agentwatch.spans ADD COLUMN IF NOT EXISTS user_id Nullable(String);
