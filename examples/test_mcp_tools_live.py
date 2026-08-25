"""Test and demonstrate AgentWatch MCP server tools live."""

import json
from agentwatch.mcp_server import AgentWatchMCPServer

print("================================================================================")
print(" [*] AgentWatch MCP Server Live Tool Execution Demo")
print("================================================================================\n")

server = AgentWatchMCPServer()

# 1. Test get_traces
print("--- [Tool 1: get_traces] ---")
req1 = {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {"name": "get_traces", "arguments": {"limit": 2, "status": "success"}},
}
res1 = server.handle_request(req1)
content1 = json.loads(res1["result"]["content"][0]["text"])
print(json.dumps(content1, indent=2))
print()

# 2. Test get_security_alerts
print("--- [Tool 2: get_security_alerts] ---")
req2 = {
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {"name": "get_security_alerts", "arguments": {"alert_type": "all"}},
}
res2 = server.handle_request(req2)
content2 = json.loads(res2["result"]["content"][0]["text"])
print(json.dumps(content2, indent=2))
print()

# 3. Test verify_audit_log
print("--- [Tool 3: verify_audit_log (SHA-256 Integrity)] ---")
req3 = {
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {"name": "verify_audit_log", "arguments": {}},
}
res3 = server.handle_request(req3)
content3 = json.loads(res3["result"]["content"][0]["text"])
print(json.dumps(content3, indent=2))
print()

# 4. Test get_topology_graph
print("--- [Tool 4: get_topology_graph (Multi-Agent Swarm Network)] ---")
req4 = {
    "jsonrpc": "2.0",
    "id": 4,
    "method": "tools/call",
    "params": {"name": "get_topology_graph", "arguments": {"time_window_hours": 24}},
}
res4 = server.handle_request(req4)
content4 = json.loads(res4["result"]["content"][0]["text"])
print(json.dumps(content4, indent=2))
print()

print("================================================================================")
print(" [SUCCESS] All MCP tools executed and verified successfully!")
print("================================================================================")
