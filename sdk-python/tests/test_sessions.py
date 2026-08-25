import json
import pytest
import respx
from httpx import Response

from agentwatch import AgentWatchConfig, configure, trace_agent, trace_llm, trace_session, trace_tool
from agentwatch.exporter import exporter


@respx.mock
def test_trace_session_propagates_to_child_spans():
    configure(AgentWatchConfig(api_key="test-key", endpoint="https://ingestion.test", org_id="org-1", flush_interval_seconds=60))
    route = respx.post("https://ingestion.test/v1/spans").mock(return_value=Response(202))

    @trace_tool("search_kb")
    def search_kb(q: str) -> str:
        return f"kb_result: {q}"

    with trace_session(session_id="sess_support_101", user_id="usr_rahul_42"):
        # Turn 1: User asks for policy
        with trace_agent("customer_support_bot", agent_id="support_bot"):
            search_kb("refund policy")

    exporter.flush()
    assert route.called
    spans = json.loads(route.calls.last.request.content)["spans"]
    assert len(spans) == 2

    for span in spans:
        assert span["session_id"] == "sess_support_101"
        assert span["user_id"] == "usr_rahul_42"


def test_session_scope_resets_on_exit():
    from agentwatch.tracing import current_session_id, current_user_id

    assert current_session_id.get() is None
    assert current_user_id.get() is None

    with trace_session(session_id="sess_temp", user_id="u_temp"):
        assert current_session_id.get() == "sess_temp"
        assert current_user_id.get() == "u_temp"

    assert current_session_id.get() is None
    assert current_user_id.get() is None
