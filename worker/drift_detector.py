"""Scope-Drift Detection Engine for unauthorized agent tools and resource access."""

import json
import logging
import os
import re
from dataclasses import dataclass, field
from typing import Any, Optional
import httpx

logger = logging.getLogger("agentwatch.drift_detector")

TABLE_PATTERN = re.compile(r"(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+([a-zA-Z0-9_]+)", re.IGNORECASE)
URL_PATTERN = re.compile(r"https?://[^\s/$.?#].[^\s]*", re.IGNORECASE)


@dataclass
class DriftAnomaly:
    org_id: str
    agent_id: str
    trace_id: str
    span_id: str
    anomaly_type: str  # "new_tool" | "new_resource"
    resource_name: str
    details: dict[str, Any] = field(default_factory=dict)


class ScopeDriftDetector:
    def __init__(self, postgres_pool: Any = None) -> None:
        self.postgres_pool = postgres_pool
        self.known_tools: set[tuple[str, str, str]] = set()  # (org_id, agent_id, tool_name)
        self.known_resources: set[tuple[str, str, str]] = set()  # (org_id, agent_id, resource_name)
        self.alerted_keys: set[str] = set()

    def add_baseline_tool(self, org_id: str, agent_id: str, tool_name: str) -> None:
        self.known_tools.add((org_id, agent_id, tool_name))

    def add_baseline_resource(self, org_id: str, agent_id: str, resource_name: str) -> None:
        self.known_resources.add((org_id, agent_id, resource_name))

    def extract_resources(self, input_data: Any) -> list[str]:
        """Extract data tables, API URLs, or bucket resources from tool input."""
        resources = []
        if not input_data:
            return resources

        if isinstance(input_data, dict):
            # Direct resource keys
            for key in ["table", "table_name", "collection", "bucket", "endpoint", "url", "target"]:
                val = input_data.get(key)
                if isinstance(val, str) and val.strip():
                    resources.append(val.strip())

            # Text content inside dictionary
            for v in input_data.values():
                if isinstance(v, str):
                    for match in TABLE_PATTERN.finditer(v):
                        tbl = match.group(1).lower()
                        if tbl not in {"select", "where", "group", "order", "limit", "and", "or", "set"}:
                            resources.append(f"table:{tbl}")
                    for match in URL_PATTERN.finditer(v):
                        resources.append(f"api:{match.group(0)}")

        elif isinstance(input_data, str):
            for match in TABLE_PATTERN.finditer(input_data):
                tbl = match.group(1).lower()
                if tbl not in {"select", "where", "group", "order", "limit", "and", "or", "set"}:
                    resources.append(f"table:{tbl}")
            for match in URL_PATTERN.finditer(input_data):
                resources.append(f"api:{match.group(0)}")

        return list(set(resources))

    def check_span(self, span: dict[str, Any]) -> list[DriftAnomaly]:
        """Inspect tool_call span against baseline for new tools or unapproved resources."""
        if span.get("span_type") != "tool_call":
            return []

        org_id = span.get("org_id", "development")
        agent_id = span.get("agent_id", "default_agent")
        trace_id = span.get("trace_id", "")
        span_id = span.get("span_id", "")
        tool_name = span.get("name", "unknown_tool")

        anomalies: list[DriftAnomaly] = []

        # 1. Check if tool_name is known in baseline
        if (org_id, agent_id, tool_name) not in self.known_tools:
            anomalies.append(
                DriftAnomaly(
                    org_id=org_id,
                    agent_id=agent_id,
                    trace_id=trace_id,
                    span_id=span_id,
                    anomaly_type="new_tool",
                    resource_name=tool_name,
                    details={"reason": f"Agent '{agent_id}' called tool '{tool_name}' for the first time outside 30-day baseline."},
                )
            )

        # 2. Extract and check data resources
        extracted_resources = self.extract_resources(span.get("input"))
        for res in extracted_resources:
            if (org_id, agent_id, res) not in self.known_resources:
                anomalies.append(
                    DriftAnomaly(
                        org_id=org_id,
                        agent_id=agent_id,
                        trace_id=trace_id,
                        span_id=span_id,
                        anomaly_type="new_resource",
                        resource_name=res,
                        details={"reason": f"Agent '{agent_id}' accessed new data resource '{res}' outside 30-day baseline."},
                    )
                )

        return anomalies

    async def persist_and_alert(
        self,
        anomalies: list[DriftAnomaly],
        webhook_url: str | None = None,
        dashboard_url: str = "http://localhost:3000",
    ) -> None:
        """Save anomalies to PostgreSQL and dispatch Slack alert with trace waterfall link."""
        if not anomalies:
            return

        for a in anomalies:
            alert_key = f"{a.org_id}:{a.agent_id}:{a.anomaly_type}:{a.resource_name}"

            if self.postgres_pool is not None:
                try:
                    await self.postgres_pool.execute(
                        """
                        INSERT INTO anomalies (org_id, agent_id, trace_id, span_id, anomaly_type, resource_name, details, resolved)
                        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, FALSE)
                        """,
                        a.org_id,
                        a.agent_id,
                        a.trace_id,
                        a.span_id,
                        a.anomaly_type,
                        a.resource_name,
                        json.dumps(a.details),
                    )
                except Exception as exc:
                    logger.error(f"Failed to persist anomaly: {exc}")

            # Send Slack webhook alert only once per unique drift item to avoid spam
            if webhook_url and alert_key not in self.alerted_keys:
                self.alerted_keys.add(alert_key)
                trace_link = f"{dashboard_url}/traces/{a.trace_id}"
                slack_payload = {
                    "text": f"🚨 *AgentWatch Scope-Drift Alert*: New {a.anomaly_type} detected for agent `{a.agent_id}`",
                    "blocks": [
                        {
                            "type": "header",
                            "text": {"type": "plain_text", "text": "🚨 Agent Scope-Drift Anomaly Detected", "emoji": True},
                        },
                        {
                            "type": "section",
                            "fields": [
                                {"type": "mrkdwn", "text": f"*Agent ID:*\n`{a.agent_id}`"},
                                {"type": "mrkdwn", "text": f"*Anomaly Type:*\n`{a.anomaly_type}`"},
                                {"type": "mrkdwn", "text": f"*Resource/Tool:*\n`{a.resource_name}`"},
                                {"type": "mrkdwn", "text": f"*Trace Waterfall:*\n<{trace_link}|Inspect Trace>"},
                            ],
                        },
                        {
                            "type": "context",
                            "elements": [{"type": "mrkdwn", "text": a.details.get("reason", "Outside 30-day baseline set.")}],
                        },
                    ],
                }
                try:
                    async with httpx.AsyncClient(timeout=5.0) as client:
                        await client.post(webhook_url, json=slack_payload)
                except Exception as exc:
                    logger.error(f"Failed to fire Slack scope-drift alert: {exc}")
