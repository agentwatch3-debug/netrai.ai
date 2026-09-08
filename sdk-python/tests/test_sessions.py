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


@respx.mock
def test_trace_session_outcome_and_set_session_outcome():
    from agentwatch import set_session_outcome

    configure(AgentWatchConfig(api_key="test-key", endpoint="https://ingestion.test", org_id="org-1", flush_interval_seconds=60))
    route = respx.post("https://ingestion.test/v1/spans").mock(return_value=Response(202))

    # Test trace_session with outcome=True
    with trace_session(session_id="sess_ticket_991", outcome=True, metadata={"ticket_id": "TCK-991"}):
        with trace_agent("support_agent"):
            pass

    # Test explicit set_session_outcome
    set_session_outcome(True, session_id="sess_ticket_992", ticket_resolved=True, metadata={"resolution": "refund_approved"})

    exporter.flush()
    assert route.called
    spans = json.loads(route.calls.last.request.content)["spans"]

    outcome_spans = [s for s in spans if s.get("span_type") == "session_outcome"]
    assert len(outcome_spans) == 2

    # Verify first outcome span from context manager
    s1 = outcome_spans[0]
    assert s1["session_id"] == "sess_ticket_991"
    assert s1["status"] == "success"
    assert s1["metadata"]["ticket_resolved"] is True
    assert s1["metadata"]["outcome_success"] is True

    # Verify second outcome span from set_session_outcome
    s2 = outcome_spans[1]
    assert s2["session_id"] == "sess_ticket_992"
    assert s2["status"] == "success"
    assert s2["metadata"]["ticket_resolved"] is True
    assert s2["metadata"]["resolution"] == "refund_approved"

