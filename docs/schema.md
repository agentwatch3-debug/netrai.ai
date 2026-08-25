# AgentWatch span schema

AgentWatch records one event for every meaningful step in an agent trace. The shape is compatible with OpenTelemetry's trace model: `trace_id`, `span_id`, and `parent_span_id` preserve hierarchy, while AgentWatch-specific attributes describe agent work.

## Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `trace_id` | string | yes | OpenTelemetry trace identifier (32 lowercase hex characters recommended). |
| `span_id` | string | yes | Span identifier, unique within a trace (16 lowercase hex characters recommended). |
| `parent_span_id` | string or null | no | Parent span identifier; omit or use `null` for a root span. |
| `agent_id` | string | yes | Agent or workflow identifier. |
| `org_id` | string | yes | Tenant/organization identifier. |
| `name` | string | yes | Human-readable operation name. |
| `span_type` | `llm_call` \| `tool_call` \| `agent_call` | yes | Operation category. |
| `input` | JSON | no | Sanitized request payload; mask or remove PII before ingestion. |
| `output` | JSON | no | Sanitized response payload; mask or remove PII before ingestion. |
| `model` | string | no | Model/provider name for LLM calls. |
| `prompt_tokens` | integer | no | Prompt/input token count. |
| `completion_tokens` | integer | no | Completion/output token count. |
| `cost_usd` | decimal | no | Estimated provider cost in USD. |
| `latency_ms` | integer | no | End-to-end duration in milliseconds. |
| `status` | `success` \| `error` | yes | Final execution state. |
| `error_message` | string | no | Sanitized error message when `status` is `error`. |
| `started_at` | RFC 3339 timestamp | yes | Span start time in UTC. |
| `ended_at` | RFC 3339 timestamp | yes | Span end time in UTC. |
| `metadata` | JSON | no | Additional indexed or contextual attributes; do not store secrets or raw PII. |

`input`, `output`, `error_message`, and `metadata` must pass through a configurable PII-masking policy before they are accepted. Timestamps should be UTC and `latency_ms` should normally equal `ended_at - started_at`.

## ClickHouse DDL

The table partitions by the calendar day of `started_at`; the primary sort key starts with `trace_id` and then time so trace lookups remain efficient while time range filtering benefits from partition pruning.

```sql
CREATE TABLE IF NOT EXISTS agentwatch.spans
(
    trace_id String,
    span_id String,
    parent_span_id Nullable(String),
    agent_id LowCardinality(String),
    org_id String,
    name String,
    span_type Enum8('llm_call' = 1, 'tool_call' = 2, 'agent_call' = 3),
    input JSON,
    output JSON,
    model LowCardinality(Nullable(String)),
    prompt_tokens Nullable(UInt32),
    completion_tokens Nullable(UInt32),
    cost_usd Nullable(Decimal(18, 8)),
    latency_ms Nullable(UInt64),
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
```

For production, apply a retention policy appropriate to your compliance needs, and consider materialized views for organization-wide time-series aggregates.
