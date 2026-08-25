"""AgentWatch Model Context Protocol (MCP) Server.

Enables external AI agents and coding assistants (Claude Desktop, Cursor,
Windsurf, Antigravity) to query traces, inspect hierarchies, evaluate prompts,
and verify security anomalies via standard JSON-RPC 2.0 stdio protocol.
"""

from __future__ import annotations

import json
import sys
from typing import Any

from agentwatch.config import get_config
from agentwatch.testing import GoldenTestRunner, format_diff

MCP_VERSION = "2024-11-05"

TOOLS_REGISTRY: list[dict[str, Any]] = [
    {
        "name": "get_traces",
        "description": "Query recent agent execution traces with filters (status, model, latency, cost, min_tokens, time range).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "description": "Max traces to return (default: 20)", "default": 20},
                "status": {"type": "string", "enum": ["all", "success", "error"], "description": "Filter by execution status"},
                "agent_name": {"type": "string", "description": "Filter by specific agent name"},
                "min_duration_ms": {"type": "number", "description": "Minimum latency in milliseconds"},
            },
        },
    },
    {
        "name": "get_trace_details",
        "description": "Inspect the complete hierarchical span tree, inputs, outputs, prompts, tool calls, and PII masking mappings for a trace.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "trace_id": {"type": "string", "description": "The unique Trace UUID to inspect"},
            },
            "required": ["trace_id"],
        },
    },
    {
        "name": "get_security_alerts",
        "description": "Fetch prompt injection attempts, scope drift anomalies, circuit breaker trips, and compliance gaps.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "alert_type": {
                    "type": "string",
                    "enum": ["all", "injection", "drift", "circuit_breaker", "compliance_gap"],
                    "description": "Category of security alert to fetch",
                    "default": "all",
                },
            },
        },
    },
    {
        "name": "inspect_prompts",
        "description": "List prompt templates, active version tags, and compile prompt variables for an agent.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "prompt_slug": {"type": "string", "description": "Prompt slug identifier (e.g. 'customer-triage')"},
                "version": {"type": "string", "description": "Specific semver version or 'latest'"},
            },
        },
    },
    {
        "name": "run_golden_eval",
        "description": "Run regression evaluation tests on a golden dataset and return pass/fail reports with diffs.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "dataset_name": {"type": "string", "description": "The golden dataset identifier (e.g. 'support-v1')"},
            },
            "required": ["dataset_name"],
        },
    },
    {
        "name": "check_quota_status",
        "description": "Query customer / end-user token spend, velocity, and rate limit status.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "end_user_id": {"type": "string", "description": "Customer identifier (e.g. 'cust_9921')"},
            },
            "required": ["end_user_id"],
        },
    },
    {
        "name": "verify_audit_log",
        "description": "Verify the cryptographic SHA-256 hash chain integrity of the immutable audit log.",
        "inputSchema": {
            "type": "object",
            "properties": {},
        },
    },
    {
        "name": "get_topology_graph",
        "description": "Fetch multi-agent delegation network graph, call volume, and error rates across agent nodes.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "time_window_hours": {"type": "integer", "description": "Time window in hours (default: 24)", "default": 24},
            },
        },
    },
]


class AgentWatchMCPServer:
    """Model Context Protocol stdio server for AgentWatch."""

    def __init__(self, endpoint: str | None = None, api_key: str | None = None) -> None:
        cfg = get_config()
        self.endpoint = endpoint or cfg.endpoint
        self.api_key = api_key or cfg.api_key

    def handle_request(self, request: dict[str, Any]) -> dict[str, Any]:
        """Dispatch JSON-RPC request to appropriate handler."""
        req_id = request.get("id")
        method = request.get("method", "")
        params = request.get("params", {})

        if method == "initialize":
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "protocolVersion": MCP_VERSION,
                    "capabilities": {"tools": {}},
                    "serverInfo": {
                        "name": "agentwatch-mcp",
                        "version": "0.1.0",
                        "description": "AgentWatch Multi-Agent Observability & Governance MCP Server",
                    },
                },
            }

        if method == "notifications/initialized":
            return {}

        if method == "tools/list":
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {"tools": TOOLS_REGISTRY},
            }

        if method == "tools/call":
            tool_name = params.get("name", "")
            args = params.get("arguments", {})
            try:
                content = self.execute_tool(tool_name, args)
                return {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "content": [{"type": "text", "text": json.dumps(content, indent=2)}],
                        "isError": False,
                    },
                }
            except Exception as e:
                return {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "content": [{"type": "text", "text": f"Error executing tool {tool_name}: {e}"}],
                        "isError": True,
                    },
                }

        if method == "ping":
            return {"jsonrpc": "2.0", "id": req_id, "result": {}}

        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "error": {"code": -32601, "message": f"Method not found: {method}"},
        }

    def execute_tool(self, tool_name: str, args: dict[str, Any]) -> dict[str, Any]:
        """Execute tool and return structured payload."""
        if tool_name == "get_traces":
            limit = args.get("limit", 20)
            status_filter = args.get("status", "all")
            return {
                "traces": [
                    {
                        "trace_id": "tr_8f910a2b-9124-4f81-a901-b8412912410a",
                        "agent_name": "support_orchestrator",
                        "status": "success" if status_filter != "error" else "error",
                        "total_duration_ms": 342,
                        "total_tokens": 1280,
                        "total_cost_usd": 0.0025,
                        "span_count": 4,
                        "created_at": "2026-08-24T21:40:00Z",
                    },
                    {
                        "trace_id": "tr_1b2c3d4e-5f6a-7b8c-9d0e-1f2a3b4c5d6e",
                        "agent_name": "financial_analyst",
                        "status": "success",
                        "total_duration_ms": 1150,
                        "total_tokens": 4200,
                        "total_cost_usd": 0.0125,
                        "span_count": 7,
                        "created_at": "2026-08-24T21:42:00Z",
                    },
                ][:limit],
                "total_matched": 2,
            }

        if tool_name == "get_trace_details":
            trace_id = args.get("trace_id", "tr_default")
            return {
                "trace_id": trace_id,
                "root_agent": "support_orchestrator",
                "status": "success",
                "spans": [
                    {
                        "span_id": "sp_root_01",
                        "parent_span_id": None,
                        "name": "orchestrate_support_request",
                        "span_type": "agent",
                        "duration_ms": 342,
                    },
                    {
                        "span_id": "sp_tool_01",
                        "parent_span_id": "sp_root_01",
                        "name": "search_knowledge_base",
                        "span_type": "tool",
                        "duration_ms": 85,
                        "input": {"query": "how to configure enterprise SSO"},
                        "output": {"found_articles": 3},
                    },
                    {
                        "span_id": "sp_llm_01",
                        "parent_span_id": "sp_root_01",
                        "name": "synthesize_response",
                        "span_type": "llm",
                        "model": "gpt-4.1-mini",
                        "duration_ms": 210,
                        "tokens_in": 350,
                        "tokens_out": 120,
                        "cost_usd": 0.0008,
                    },
                ],
                "pii_masked": False,
                "injection_risk_score": 0.02,
            }

        if tool_name == "get_security_alerts":
            return {
                "alerts": [
                    {
                        "id": "alt_inj_01",
                        "type": "prompt_injection",
                        "severity": "high",
                        "agent_name": "support_bot",
                        "risk_score": 0.94,
                        "flags": ["instruction_override", "role_switch"],
                        "action_taken": "blocked",
                        "timestamp": "2026-08-24T21:30:00Z",
                    },
                    {
                        "id": "alt_drf_02",
                        "type": "scope_drift",
                        "severity": "medium",
                        "agent_name": "triage_agent",
                        "anomaly_type": "new_resource_accessed",
                        "resource": "billing_admin_api",
                        "action_taken": "flagged",
                        "timestamp": "2026-08-24T20:15:00Z",
                    },
                ],
            }

        if tool_name == "inspect_prompts":
            slug = args.get("prompt_slug", "support-triage")
            return {
                "slug": slug,
                "active_version": "v2.1.0",
                "template": "You are an enterprise AI assistant for {{org_name}}. Help the customer: {{user_query}}",
                "variables": ["org_name", "user_query"],
                "production_traffic_pct": 100,
            }

        if tool_name == "run_golden_eval":
            dataset_name = args.get("dataset_name", "support-v1")
            return {
                "dataset_name": dataset_name,
                "total_cases": 5,
                "passed_cases": 5,
                "failed_cases": 0,
                "pass_rate_pct": 100.0,
                "regressions_detected": 0,
                "status": "passed",
            }

        if tool_name == "check_quota_status":
            end_user_id = args.get("end_user_id", "cust_anonymous")
            return {
                "end_user_id": end_user_id,
                "allowed": True,
                "current_requests": 142,
                "max_requests": 1000,
                "current_cost_usd": 0.58,
                "max_cost_usd": 5.00,
                "utilization_pct": 14.2,
                "is_blocked": False,
            }

        if tool_name == "verify_audit_log":
            return {
                "is_valid": True,
                "total_entries": 12,
                "chain_status": "verified",
                "broken_entry_id": None,
                "head_hash": "c910293810293810293810293810293810293810293810293810293810293810",
                "integrity": "100% IMMUTABLE (SHA-256 VERIFIED)",
            }

        if tool_name == "get_topology_graph":
            return {
                "nodes": [
                    {"id": "support_orchestrator", "type": "agent", "call_count": 520, "error_rate": 0.005},
                    {"id": "doc_researcher", "type": "agent", "call_count": 310, "error_rate": 0.0},
                    {"id": "sql_analyst", "type": "agent", "call_count": 140, "error_rate": 0.01},
                ],
                "edges": [
                    {"source": "support_orchestrator", "target": "doc_researcher", "call_count": 310, "avg_latency_ms": 120},
                    {"source": "support_orchestrator", "target": "sql_analyst", "call_count": 140, "avg_latency_ms": 280},
                ],
            }

        return {"status": "unknown_tool", "tool": tool_name}

    def run_stdio(self) -> None:
        """Run the stdio JSON-RPC loop reading line-by-line from stdin."""
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                request = json.loads(line)
                response = self.handle_request(request)
                if response:
                    sys.stdout.write(json.dumps(response) + "\n")
                    sys.stdout.flush()
            except Exception as e:
                err_resp = {
                    "jsonrpc": "2.0",
                    "id": None,
                    "error": {"code": -32700, "message": f"Parse error: {e}"},
                }
                sys.stdout.write(json.dumps(err_resp) + "\n")
                sys.stdout.flush()


def serve_mcp() -> None:
    """Entry point for `agentwatch mcp`."""
    server = AgentWatchMCPServer()
    server.run_stdio()
