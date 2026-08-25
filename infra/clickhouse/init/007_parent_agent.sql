-- 007_parent_agent.sql: Add parent_agent_id for multi-agent hierarchy tracking

ALTER TABLE spans ADD COLUMN IF NOT EXISTS parent_agent_id Nullable(String);
