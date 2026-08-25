import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
import respx
from httpx import Response
from circuit_breaker import CircuitBreakerEngine


def test_cost_velocity_threshold_detection():
    engine = CircuitBreakerEngine()
    # Below $50 limit -> False
    assert engine.check_cost_velocity_from_rows(org_id="org_1", cost_5m=12.50, threshold=50.0) is False
    # Exactly $50 limit -> False
    assert engine.check_cost_velocity_from_rows(org_id="org_1", cost_5m=50.00, threshold=50.0) is False
    # Above $50 limit -> True (Breach detected!)
    assert engine.check_cost_velocity_from_rows(org_id="org_1", cost_5m=54.20, threshold=50.0) is True


def test_infinite_tool_loop_detection():
    engine = CircuitBreakerEngine()

    # Create 35 tool call spans in a single trace (loop runaway)
    loop_spans = [
        {"trace_id": "tr_infinite_loop", "span_type": "tool_call", "name": "search_db", "agent_id": "loop_agent"}
        for _ in range(35)
    ]
    has_loop, agent_id, count = engine.detect_tool_loop_in_batch(loop_spans, threshold=30)
    assert has_loop is True
    assert agent_id == "loop_agent"
    assert count == 35

    # Safe spans (10 tool calls)
    safe_spans = [
        {"trace_id": "tr_safe", "span_type": "tool_call", "name": "search_db", "agent_id": "safe_agent"}
        for _ in range(10)
    ]
    has_loop, _, _ = engine.detect_tool_loop_in_batch(safe_spans, threshold=30)
    assert has_loop is False


@pytest.mark.anyio
@respx.mock
async def test_trip_breaker_dispatches_emergency_webhook():
    engine = CircuitBreakerEngine()
    webhook_route = respx.post("https://hooks.slack.com/services/EMERGENCY").mock(
        return_value=Response(200, json={"ok": True})
    )

    await engine.trip_breaker(
        org_id="org_test_trip",
        trigger_type="cost_velocity_spike",
        reason="5-Minute cost reached $78.50",
        cost_at_trigger=78.50,
        webhook_url="https://hooks.slack.com/services/EMERGENCY",
    )

    assert webhook_route.called
    payload = webhook_route.calls.last.request.content.decode("utf-8")
    assert "EMERGENCY: AgentWatch Circuit Breaker Tripped" in payload
    assert "org_test_trip" in payload
