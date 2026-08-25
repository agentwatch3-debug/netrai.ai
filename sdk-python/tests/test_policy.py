import json
import pytest
import respx
from httpx import Response

from agentwatch import AgentWatchConfig, PolicyViolation, configure, policy_cache, trace_agent, trace_tool
from agentwatch.exporter import exporter


@respx.mock
def test_blocked_tool_raises_policy_violation_and_records_span():
    configure(AgentWatchConfig(api_key="test-key", endpoint="https://ingestion.test", org_id="org-1", flush_interval_seconds=60))
    route = respx.post("https://ingestion.test/v1/spans").mock(return_value=Response(202))

    # Pre-configure policy cache
    policy_cache.set_local_policy("researcher", ["execute_sql", "delete_file"])

    @trace_tool("execute_sql")
    def run_query(sql: str) -> str:
        return f"result of {sql}"

    @trace_tool("search_web")
    def search(q: str) -> str:
        return f"search: {q}"

    with trace_agent("research", agent_id="researcher"):
        # Allowed tool works normally
        assert search("weather") == "search: weather"

        # Blocked tool raises PolicyViolation
        with pytest.raises(PolicyViolation) as exc_info:
            run_query("DROP TABLE users;")
        assert "blocked by policy rule" in str(exc_info.value)

    exporter.flush()
    assert route.called
    spans = json.loads(route.calls.last.request.content)["spans"]
    blocked_span = next(s for s in spans if s["name"] == "execute_sql")
    assert blocked_span["status"] == "error"
    assert "PolicyViolation" in blocked_span["error_message"]


@respx.mock
def test_policy_fetch_from_api():
    configure(AgentWatchConfig(api_key="test-key", endpoint="https://ingestion.test", org_id="org-1", flush_interval_seconds=60))
    respx.get("https://ingestion.test/v1/policies/tools?agent_id=analyst").mock(
        return_value=Response(200, json={"org_id": "org-1", "agent_id": "analyst", "blocked_tool_names": ["shell_exec"]})
    )
    policy_cache.clear()

    @trace_tool("shell_exec")
    def run_shell(cmd: str) -> str:
        return f"exec: {cmd}"

    with trace_agent("analyst_agent", agent_id="analyst"):
        with pytest.raises(PolicyViolation):
            run_shell("rm -rf /")

    exporter.flush()
