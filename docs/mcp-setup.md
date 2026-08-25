# AgentWatch Model Context Protocol (MCP) Setup

AgentWatch includes a native **Model Context Protocol (MCP)** stdio server that empowers AI assistants (such as **Claude Desktop**, **Cursor IDE**, **Windsurf**, and autonomous agents) to inspect traces, monitor prompt security, run evaluations, and query rate limits directly inside their context.

---

## 1. Quickstart

Start the MCP server locally using the `agentwatch` CLI:

```bash
agentwatch mcp --endpoint http://localhost:8000 --api-key your-api-key
```

Or run via `python -m agentwatch.mcp_server`.

---

## 2. Connecting to AI Assistants

### A. Claude Desktop

Add AgentWatch to your Claude Desktop configuration file:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "agentwatch": {
      "command": "python",
      "args": ["-m", "agentwatch.mcp_server"],
      "env": {
        "AGENTWATCH_ENDPOINT": "http://localhost:8000",
        "AGENTWATCH_API_KEY": "dev-key"
      }
    }
  }
}
```

---

### B. Cursor IDE

1. Open **Cursor Settings** $\rightarrow$ **Features** $\rightarrow$ **MCP Servers**.
2. Click **Add New MCP Server**:
   - **Name**: `AgentWatch`
   - **Type**: `command`
   - **Command**: `agentwatch mcp`
   - **Env**: `AGENTWATCH_ENDPOINT=http://localhost:8000`

---

### C. Windsurf (Codeium)

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "agentwatch": {
      "command": "agentwatch",
      "args": ["mcp"]
    }
  }
}
```

---

## 3. Available MCP Tools

Once connected, your AI assistant can invoke these 8 native tools:

| Tool | Purpose |
| :--- | :--- |
| `get_traces` | Query recent traces filtered by status, latency, model, or agent. |
| `get_trace_details` | Inspect full span tree, prompts, tool calls, latency, and PII masking. |
| `get_security_alerts` | Check prompt injection detections, scope drift, and circuit breaker trips. |
| `inspect_prompts` | List prompt versions and compile prompt variables. |
| `run_golden_eval` | Trigger golden dataset regression tests against agent functions. |
| `check_quota_status` | Inspect customer token limits, dollar spend, and throttling status. |
| `verify_audit_log` | Verify SHA-256 cryptographic hash chain integrity. |
| `get_topology_graph` | Fetch multi-agent delegation graph and call error rates. |

---

## 4. Example Prompts for Claude / Cursor

- *"Claude, check the latest AgentWatch traces and find why the customer support agent threw an error."*
- *"Are there any recent prompt injection attempts or circuit breaker trips in AgentWatch?"*
- *"Run golden dataset evaluation on 'customer-support-v1' and report any regressions."*
- *"Verify the cryptographic SHA-256 audit log chain in AgentWatch."*
