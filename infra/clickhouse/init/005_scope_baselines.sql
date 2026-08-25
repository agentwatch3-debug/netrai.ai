-- 005_scope_baselines.sql: 30-Day Rolling Tool & Resource Baselines

CREATE TABLE IF NOT EXISTS agentwatch.agent_baselines_30d
(
    org_id LowCardinality(String),
    agent_id LowCardinality(String),
    resource_type LowCardinality(String),
    resource_name String,
    first_seen_at DateTime64(3, 'UTC'),
    last_seen_at DateTime64(3, 'UTC'),
    call_count UInt64
)
ENGINE = SummingMergeTree(call_count)
PRIMARY KEY (org_id, agent_id, resource_type, resource_name)
ORDER BY (org_id, agent_id, resource_type, resource_name);
