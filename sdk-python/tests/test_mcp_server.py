import json
import pytest

from agentwatch.mcp_server import AgentWatchMCPServer, TOOLS_REGISTRY


def test_mcp_tools_registry():
    tool_names = [t["name"] for t in TOOLS_REGISTRY]
    assert "get_traces" in tool_names
    assert "get_trace_details" in tool_names
    assert "get_security_alerts" in tool_names
    assert "inspect_prompts" in tool_names
    assert "run_golden_eval" in tool_names
    assert "check_quota_status" in tool_names
    assert "verify_audit_log" in tool_names
    assert "get_topology_graph" in tool_names
    assert len(TOOLS_REGISTRY) == 8


def test_mcp_initialize():
    server = AgentWatchMCPServer()
    req = {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}}
    res = server.handle_request(req)

    assert res["jsonrpc"] == "2.0"
    assert res["id"] == 1
    assert res["result"]["serverInfo"]["name"] == "agentwatch-mcp"
    assert "tools" in res["result"]["capabilities"]


def test_mcp_tools_list():
    server = AgentWatchMCPServer()
    req = {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}
    res = server.handle_request(req)

    assert res["jsonrpc"] == "2.0"
    assert res["id"] == 2
    assert len(res["result"]["tools"]) == 8


def test_mcp_tools_call_get_traces():
    server = AgentWatchMCPServer()
    req = {
        "jsonrpc": "2.0",
        "id": 3,
        "method": "tools/call",
        "params": {
            "name": "get_traces",
            "arguments": {"limit": 5, "status": "success"},
        },
    }
    res = server.handle_request(req)

    assert res["jsonrpc"] == "2.0"
    assert res["id"] == 3
    assert res["result"]["isError"] is False
    content_text = res["result"]["content"][0]["text"]
    data = json.loads(content_text)
    assert "traces" in data
    assert len(data["traces"]) > 0


def test_mcp_tools_call_verify_audit_log():
    server = AgentWatchMCPServer()
    req = {
        "jsonrpc": "2.0",
        "id": 4,
        "method": "tools/call",
        "params": {
            "name": "verify_audit_log",
            "arguments": {},
        },
    }
    res = server.handle_request(req)

    assert res["result"]["isError"] is False
    data = json.loads(res["result"]["content"][0]["text"])
    assert data["is_valid"] is True
    assert "SHA-256" in data["integrity"]


def test_mcp_tools_call_security_alerts():
    server = AgentWatchMCPServer()
    req = {
        "jsonrpc": "2.0",
        "id": 5,
        "method": "tools/call",
        "params": {
            "name": "get_security_alerts",
            "arguments": {"alert_type": "all"},
        },
    }
    res = server.handle_request(req)

    assert res["result"]["isError"] is False
    data = json.loads(res["result"]["content"][0]["text"])
    assert len(data["alerts"]) >= 2
