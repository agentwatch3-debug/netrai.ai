CREATE TABLE IF NOT EXISTS agentwatch.spans
(
    trace_id String,
    span_id String,
    parent_span_id Nullable(String),
    agent_id LowCardinality(String),
    parent_agent_id Nullable(String),
    org_id String,
    session_id Nullable(String),
    user_id Nullable(String),
    end_user_id Nullable(String),
    consent_id Nullable(String),
    name String,
    span_type Enum8('llm_call' = 1, 'tool_call' = 2, 'agent_call' = 3),
    input JSON,
    output JSON,
    model LowCardinality(Nullable(String)),
    prompt_tokens Nullable(UInt32),
    completion_tokens Nullable(UInt32),
    cost_usd Nullable(Decimal(18, 8)),
    latency_ms Nullable(UInt64),
    injection_risk_score Nullable(Float32),
    injection_flags Array(String),
    status Enum8('success' = 1, 'error' = 2),
    error_message Nullable(String),
    started_at DateTime64(3, 'UTC'),
    ended_at DateTime64(3, 'UTC'),
    metadata JSON
)
ENGINE = MergeTree
PARTITION BY toDate(started_at)
ORDER BY (trace_id, started_at)
PRIMARY KEY (trace_id, started_at)
SETTINGS index_granularity = 8192;
