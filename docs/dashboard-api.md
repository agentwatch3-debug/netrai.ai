# Dashboard query contract

The Next.js dashboard calls the ingestion API through server-side route handlers; its service key is never exposed to the browser. The expected query endpoints are:

- `GET /v1/traces?agent_id=&status=&started_after=&started_before=&min_cost=&cursor=` — returns `{ data, next_cursor }` for the active organization.
- `GET /v1/traces/{trace_id}` — returns `{ spans }`, ordered by `started_at`.
- `GET /v1/analytics/daily` — reads `agentwatch.daily_span_metrics` and returns daily cost, input/output tokens, error rate, and p50/p95 latency.
- `POST /v1/api-keys` and `DELETE /v1/api-keys/{id}` — provision and revoke organization API keys.

The dashboard proxy enforces Clerk sign-in and active-organization membership. Unmasking additionally requires the Clerk organization permission `org:traces:unmask`; the ingestion API independently requires the API key `unmask` scope.
