CREATE TABLE IF NOT EXISTS agentwatch.daily_span_metrics
(
    org_id String,
    agent_id LowCardinality(String),
    day Date,
    cost_usd AggregateFunction(sum, Decimal(18, 8)),
    prompt_tokens AggregateFunction(sum, UInt64),
    completion_tokens AggregateFunction(sum, UInt64),
    span_count AggregateFunction(count),
    error_count AggregateFunction(countIf, UInt8),
    latency_quantiles AggregateFunction(quantilesTDigest(0.5, 0.95), UInt64)
)
ENGINE = AggregatingMergeTree
PARTITION BY day
ORDER BY (org_id, agent_id, day);

CREATE MATERIALIZED VIEW IF NOT EXISTS agentwatch.daily_span_metrics_mv
TO agentwatch.daily_span_metrics
AS SELECT
    org_id,
    agent_id,
    toDate(started_at) AS day,
    sumState(ifNull(cost_usd, toDecimal64(0, 8))) AS cost_usd,
    sumState(toUInt64(ifNull(prompt_tokens, 0))) AS prompt_tokens,
    sumState(toUInt64(ifNull(completion_tokens, 0))) AS completion_tokens,
    countState() AS span_count,
    countIfState(toUInt8(status = 'error')) AS error_count,
    quantilesTDigestState(0.5, 0.95)(toUInt64(ifNull(latency_ms, 0))) AS latency_quantiles
FROM agentwatch.spans
GROUP BY org_id, agent_id, day;
