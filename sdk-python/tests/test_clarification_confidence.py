import json
import pytest
import respx
from httpx import Response

import agentwatch
from agentwatch import AgentWatchConfig, ClarificationRequired, configure, trace_llm, trace_tool
from agentwatch.exporter import exporter


from agentwatch.tracing import (
    current_consent_id,
    current_intent_confidence,
    current_intent_confidence_threshold,
    current_planned_action,
)


@pytest.fixture(autouse=True)
def setup_config():
    configure(
        AgentWatchConfig(
            api_key="test-key",
            endpoint="https://ingestion.test",
            org_id="org-1",
            plan_tier="team",
            flush_interval_seconds=60,
        )
    )
    exporter._take_batch()
    current_intent_confidence.set(None)
    current_intent_confidence_threshold.set(None)
    current_planned_action.set(None)
    current_consent_id.set(None)
    yield
    exporter._take_batch()
    current_intent_confidence.set(None)
    current_intent_confidence_threshold.set(None)
    current_planned_action.set(None)
    current_consent_id.set(None)



@respx.mock
def test_trace_llm_high_confidence_allows_downstream_tool():
    route = respx.post("https://ingestion.test/v1/spans").mock(return_value=Response(202))
    tool_executed = False

    @trace_tool(name="execute_refund")
    def execute_refund(user_id: str, amount: float):
        nonlocal tool_executed
        tool_executed = True
        return {"refund_id": "ref_101", "status": "processed"}

    @trace_llm(model="gpt-4o", intent_confidence_threshold=0.7)
    def agent_decide(query: str):
        # Agent's own confidence calculation is high (0.92 >= 0.70)
        return {
            "planned_action": "execute_refund",
            "confidence": 0.92,
            "arguments": {"user_id": "usr_99", "amount": 50.0},
        }

    decision = agent_decide("I need a refund for order #123")
    assert decision["confidence"] == 0.92
    assert not tool_executed

    # Execute downstream tool
    result = execute_refund(user_id="usr_99", amount=50.0)
    assert tool_executed is True
    assert result["status"] == "processed"

    exporter.flush()
    assert route.called
    all_spans = []
    for call in route.calls:
        body = json.loads(call.request.content)
        all_spans.extend(body.get("spans", []))

    assert len(all_spans) == 2
    llm_span = next(s for s in all_spans if s["span_type"] == "llm_call")
    assert llm_span["metadata"]["intent_confidence"] == 0.92
    assert llm_span["metadata"]["intent_confidence_threshold"] == 0.7
    assert llm_span["metadata"]["action_taken"] == "execute_refund"
    assert llm_span["metadata"]["clarification_requested"] is False

    tool_span = next(s for s in all_spans if s["span_type"] == "tool_call")
    assert tool_span["metadata"]["intent_confidence"] == 0.92
    assert tool_span["metadata"]["action_taken"] == "tool_executed"
    assert tool_span["metadata"]["clarification_requested"] is False


@respx.mock
def test_trace_llm_low_confidence_intercepts_downstream_tool_and_logs_clarification():
    route = respx.post("https://ingestion.test/v1/spans").mock(return_value=Response(202))
    tool_executed = False

    @trace_tool(name="delete_account")
    def delete_account(user_id: str):
        nonlocal tool_executed
        tool_executed = True
        return {"status": "deleted"}

    @trace_llm(model="gpt-4o", intent_confidence_threshold=0.75)
    def agent_decide(query: str):
        # Ambiguous query results in agent confidence 0.45 (< 0.75)
        return {
            "planned_action": "delete_account",
            "confidence": 0.45,
            "reasoning": "User said 'I want out', intent is ambiguous between pause vs delete.",
        }

    decision = agent_decide("I want out of this system")
    assert decision["confidence"] == 0.45

    # Calling downstream tool should be intercepted and raise ClarificationRequired
    with pytest.raises(ClarificationRequired) as exc_info:
        delete_account(user_id="usr_42")

    assert exc_info.value.confidence == 0.45
    assert exc_info.value.threshold == 0.75
    assert exc_info.value.action_taken == "clarification_requested"
    assert exc_info.value.tool == "delete_account"
    assert tool_executed is False

    exporter.flush()
    assert route.called
    all_spans = []
    for call in route.calls:
        body = json.loads(call.request.content)
        all_spans.extend(body.get("spans", []))

    assert len(all_spans) == 2
    llm_span = next(s for s in all_spans if s["span_type"] == "llm_call")
    assert llm_span["metadata"]["intent_confidence"] == 0.45
    assert llm_span["metadata"]["intent_confidence_threshold"] == 0.75
    assert llm_span["metadata"]["action_taken"] == "clarification_requested"
    assert llm_span["metadata"]["clarification_requested"] is True
    assert llm_span["metadata"]["clarification_required"] is True

    tool_span = next(s for s in all_spans if s["span_type"] == "tool_call")
    assert tool_span["metadata"]["action_taken"] == "clarification_requested"
    assert tool_span["metadata"]["clarification_requested"] is True
    assert tool_span["metadata"]["intent_confidence"] == 0.45


@respx.mock
def test_trace_llm_tuple_response_confidence_extraction():
    route = respx.post("https://ingestion.test/v1/spans").mock(return_value=Response(202))

    @trace_llm(model="claude-3-5-sonnet", intent_confidence_threshold=0.8)
    def agent_tuple_return(query: str):
        return ("search_database", 0.65)

    res = agent_tuple_return("Find user info")
    assert res == ("search_database", 0.65)

    exporter.flush()
    assert route.called
    span = json.loads(route.calls.last.request.content)["spans"][0]
    assert span["metadata"]["intent_confidence"] == 0.65
    assert span["metadata"]["action_taken"] == "clarification_requested"
    assert span["metadata"]["clarification_requested"] is True


@respx.mock
@pytest.mark.asyncio
async def test_trace_llm_async_clarification_confidence():
    route = respx.post("https://ingestion.test/v1/spans").mock(return_value=Response(202))
    tool_executed = False

    @trace_tool(name="async_charge_card")
    async def async_charge_card(amount: float):
        nonlocal tool_executed
        tool_executed = True
        return {"charged": amount}

    @trace_llm(model="gpt-4o-mini", intent_confidence_threshold=0.7)
    async def async_agent(query: str):
        return {"planned_action": "async_charge_card", "confidence": 0.50}

    await async_agent("Bill me something")

    with pytest.raises(ClarificationRequired) as exc_info:
        await async_charge_card(99.0)

    assert exc_info.value.confidence == 0.50
    assert tool_executed is False

    exporter.flush()
    assert route.called
    all_spans = []
    for call in route.calls:
        body = json.loads(call.request.content)
        all_spans.extend(body.get("spans", []))

    assert len(all_spans) == 2
    for s in all_spans:
        assert s["metadata"]["action_taken"] == "clarification_requested"
        assert s["metadata"]["clarification_requested"] is True

