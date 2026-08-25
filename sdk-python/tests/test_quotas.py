import json
import pytest
import respx
from httpx import Response

import agentwatch
from agentwatch import AgentWatchConfig, QuotaExceeded, check_quota, configure, trace_agent, trace_llm, trace_session
from agentwatch.exporter import exporter
from agentwatch.tracing import current_end_user_id


@respx.mock
def test_check_quota_allowed_when_under_limits():
    endpoint = "https://ingestion.test"
    configure(AgentWatchConfig(api_key="test-key", endpoint=endpoint, org_id="org-1"))

    route = respx.get(f"{endpoint}/v1/quotas/check?end_user_id=cust_healthy_101").mock(
        return_value=Response(
            200,
            json={
                "allowed": True,
                "end_user_id": "cust_healthy_101",
                "current_requests": 140,
                "max_requests": 1000,
                "current_cost": 0.52,
                "max_cost": 5.0,
            },
        )
    )

    result = check_quota("cust_healthy_101", endpoint=endpoint, api_key="test-key")
    assert result is True
    assert route.called


@respx.mock
def test_check_quota_raises_quota_exceeded_on_limit_hit():
    endpoint = "https://ingestion.test"
    configure(AgentWatchConfig(api_key="test-key", endpoint=endpoint, org_id="org-1"))

    route = respx.get(f"{endpoint}/v1/quotas/check?end_user_id=cust_exceeded_999").mock(
        return_value=Response(
            429,
            json={
                "detail": "Daily spend limit exceeded: $5.80/$5.00.",
            },
        )
    )

    with pytest.raises(QuotaExceeded) as exc_info:
        check_quota("cust_exceeded_999", endpoint=endpoint, api_key="test-key")

    assert "Daily spend limit exceeded" in str(exc_info.value)
    assert route.called


@respx.mock
def test_end_user_id_propagates_to_child_spans():
    endpoint = "https://ingestion.test"
    configure(AgentWatchConfig(api_key="test-key", endpoint=endpoint, org_id="org-1", flush_interval_seconds=60))
    route = respx.post(f"{endpoint}/v1/spans").mock(return_value=Response(202))

    assert current_end_user_id.get() is None

    with trace_agent("support_agent", end_user_id="cust_enterprise_77"):
        assert current_end_user_id.get() == "cust_enterprise_77"

        with trace_llm("gpt-4.1-mini") as llm:
            llm.finish(output="Customer query resolved.")

    # Context resets on exit
    assert current_end_user_id.get() is None

    exporter.flush()
    assert route.called
    spans = json.loads(route.calls.last.request.content)["spans"]
    assert len(spans) == 2

    for s in spans:
        assert s["end_user_id"] == "cust_enterprise_77"


@respx.mock
def test_trace_session_propagates_end_user_id():
    endpoint = "https://ingestion.test"
    configure(AgentWatchConfig(api_key="test-key", endpoint=endpoint, org_id="org-1", flush_interval_seconds=60))
    route = respx.post(f"{endpoint}/v1/spans").mock(return_value=Response(202))

    with trace_session("sess_alpha_99", end_user_id="cust_mobile_user_02"):
        with trace_agent("chat_agent"):
            with trace_llm("claude-3-haiku") as llm:
                llm.finish(output="Multi-turn response.")

    exporter.flush()
    spans = json.loads(route.calls.last.request.content)["spans"]
    assert len(spans) == 2

    for s in spans:
        assert s["end_user_id"] == "cust_mobile_user_02"
