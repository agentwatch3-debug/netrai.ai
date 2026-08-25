"""Automated Cost Runaway Circuit Breaker & Kill-Switch Engine."""

import json
import logging
from typing import Any, Optional

import httpx

logger = logging.getLogger("agentwatch.circuit_breaker")


class CircuitBreakerEngine:
    def __init__(self, postgres_pool: Any = None, redis_client: Any = None, clickhouse_client: Any = None) -> None:
        self.postgres = postgres_pool
        self.redis = redis_client
        self.clickhouse = clickhouse_client

    def check_cost_velocity_from_rows(self, org_id: str, cost_5m: float, threshold: float = 50.0) -> bool:
        """Check if 5-minute cost exceeds threshold."""
        return cost_5m > threshold

    def detect_tool_loop_in_batch(self, spans: list[dict[str, Any]], threshold: int = 30) -> tuple[bool, Optional[str], int]:
        """Detect infinite tool loops in a batch of spans grouped by trace_id."""
        trace_tools: dict[str, int] = {}
        trace_agents: dict[str, Optional[str]] = {}
        for s in spans:
            if s.get("span_type") == "tool_call":
                t_id = s.get("trace_id", "unknown")
                trace_tools[t_id] = trace_tools.get(t_id, 0) + 1
                trace_agents[t_id] = s.get("agent_id")
        for t_id, count in trace_tools.items():
            if count >= threshold:
                return True, trace_agents.get(t_id), count
        return False, None, 0

    async def check_and_evaluate(self, org_id: str, spans: list[dict[str, Any]]) -> None:
        """Run cost velocity and tool loop checks against active org."""
        if not org_id:
            return

        # Fetch org config from Postgres if available
        threshold_cost = 50.0
        threshold_loop = 30
        webhook_url = None
        is_already_throttled = False

        if self.postgres is not None:
            row = await self.postgres.fetchrow(
                "SELECT is_throttled, max_cost_velocity_5m, max_tool_call_loop_count, emergency_webhook_url FROM orgs WHERE org_id = $1",
                org_id,
            )
            if row:
                is_already_throttled = row["is_throttled"]
                threshold_cost = float(row["max_cost_velocity_5m"] or 50.0)
                threshold_loop = int(row["max_tool_call_loop_count"] or 30)
                webhook_url = row["emergency_webhook_url"]

        if is_already_throttled:
            return

        # 1. Tool Loop Check
        has_loop, loop_agent, loop_count = self.detect_tool_loop_in_batch(spans, threshold=threshold_loop)
        if has_loop:
            await self.trip_breaker(
                org_id=org_id,
                trigger_type="infinite_tool_loop",
                agent_id=loop_agent,
                cost_at_trigger=0.0,
                loop_count=loop_count,
                reason=f"Detected infinite tool call loop ({loop_count} executions in single trace)",
                webhook_url=webhook_url,
            )
            return

        # 2. ClickHouse Cost Velocity Check
        if self.clickhouse is not None:
            try:
                res = self.clickhouse.query(
                    f"SELECT sum(ifNull(cost_usd, 0)) FROM spans WHERE org_id = '{org_id}' AND started_at >= now() - INTERVAL 5 MINUTE"
                )
                if res.result_rows and res.result_rows[0][0] is not None:
                    cost_5m = float(res.result_rows[0][0])
                    if cost_5m > threshold_cost:
                        await self.trip_breaker(
                            org_id=org_id,
                            trigger_type="cost_velocity_spike",
                            agent_id=None,
                            cost_at_trigger=cost_5m,
                            loop_count=0,
                            reason=f"5-Minute cost velocity (${cost_5m:.2f}) exceeded runaway limit (${threshold_cost:.2f})",
                            webhook_url=webhook_url,
                        )
            except Exception as exc:
                logger.warning("Failed querying ClickHouse cost velocity: %s", exc)

    async def trip_breaker(
        self,
        org_id: str,
        trigger_type: str,
        reason: str,
        agent_id: Optional[str] = None,
        cost_at_trigger: float = 0.0,
        loop_count: int = 0,
        webhook_url: Optional[str] = None,
    ) -> None:
        """Trip the circuit breaker, throttle org, update Redis cache, and send emergency webhook."""
        logger.error("🚨 TRIPPING CIRCUIT BREAKER for org %s: %s", org_id, reason)

        # 1. Update Postgres
        if self.postgres is not None:
            await self.postgres.execute(
                """
                UPDATE orgs
                SET is_throttled = TRUE, throttled_reason = $1, throttled_at = NOW()
                WHERE org_id = $2
                """,
                reason,
                org_id,
            )
            await self.postgres.execute(
                """
                INSERT INTO circuit_breaker_events (org_id, agent_id, trigger_type, cost_at_trigger, loop_count, details, action_taken)
                VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
                """,
                org_id,
                agent_id,
                trigger_type,
                cost_at_trigger,
                loop_count,
                json.dumps({"reason": reason}),
                "throttled",
            )

        # 2. Update Redis fast lookup
        if self.redis is not None:
            try:
                await self.redis.set(f"org:throttled:{org_id}", reason)
            except Exception:
                pass

        # 3. Emergency Webhook Dispatch (Slack / PagerDuty)
        if webhook_url:
            payload = {
                "text": f"🚨 *EMERGENCY: AgentWatch Circuit Breaker Tripped*\n*Org ID*: `{org_id}`\n*Trigger*: `{trigger_type}`\n*Reason*: {reason}\n*Action*: Traffic Throttled (HTTP 429)",
                "org_id": org_id,
                "trigger_type": trigger_type,
                "reason": reason,
                "cost_usd": cost_at_trigger,
                "action": "throttled",
            }
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    await client.post(webhook_url, json=payload)
            except Exception as exc:
                logger.warning("Failed dispatching emergency webhook: %s", exc)
