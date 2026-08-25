import json
import pytest
import respx
from httpx import Response

import agentwatch
from agentwatch import AgentWatchConfig, OutputPolicyViolation, configure, scan_output_policy, trace_agent, trace_llm
from agentwatch.exporter import exporter


@respx.mock
def test_trace_llm_post_execution_blocking_raises_output_policy_violation():
    configure(AgentWatchConfig(api_key="test-key", endpoint="https://ingestion.test", org_id="org-1", flush_interval_seconds=60))
    route = respx.post("https://ingestion.test/v1/spans").mock(return_value=Response(202))

    @trace_llm("banking_advisor")
    def advise_loan():
        return "Your rate is 9.5% APR."

    with pytest.raises(OutputPolicyViolation) as exc_info:
        advise_loan()

    assert "Interest rate quotes must include an explicit disclaimer" in str(exc_info.value)

    exporter.flush()
    assert route.called
    span = json.loads(route.calls.last.request.content)["spans"][0]
    assert span["status"] == "error"
    assert "Output Policy Violation" in span["error_message"]


@respx.mock
def test_trace_llm_compliant_response_returns_normally():
    configure(AgentWatchConfig(api_key="test-key", endpoint="https://ingestion.test", org_id="org-1", flush_interval_seconds=60))
    route = respx.post("https://ingestion.test/v1/spans").mock(return_value=Response(202))

    @trace_llm("banking_advisor")
    def advise_compliant():
        return "Rates start at 7.5% APR, subject to terms and credit approval."

    result = advise_compliant()
    assert "7.5% APR" in result

    exporter.flush()
    assert route.called
    span = json.loads(route.calls.last.request.content)["spans"][0]
    assert span["status"] == "success"


def test_scan_output_policy_helper():
    res = scan_output_policy("You should definitely buy TSLA stock for guaranteed returns.")
    assert res.is_blocked is True
    assert any(v.rule_name == "banking_no_definitive_investment_advice" for v in res.violations)
