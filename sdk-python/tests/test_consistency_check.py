import json
import pytest
import respx
from httpx import Response

from agentwatch import (
    AgentWatchConfig,
    TierRestrictedError,
    compute_output_consistency,
    configure,
    trace_llm,
)
from agentwatch.exporter import exporter


def test_compute_output_consistency_identical_strings():
    outputs = [
        "The total refund is $45.00 for order 12345.",
        "The total refund is $45.00 for order 12345.",
        "The total refund is $45.00 for order 12345.",
    ]
    score = compute_output_consistency(outputs)
    assert score == 1.0


def test_compute_output_consistency_divergent_strings():
    outputs = [
        "Approve the refund immediately for customer.",
        "Deny request due to return window expiration.",
        "Ask user for additional receipt photographic proof.",
    ]
    score = compute_output_consistency(outputs)
    assert score < 0.5


def test_compute_output_consistency_structured_data():
    matching = [
        {"action": "refund", "amount": 50, "approved": True},
        {"action": "refund", "amount": 50, "approved": True},
        {"action": "refund", "amount": 50, "approved": True},
    ]
    assert compute_output_consistency(matching) == 1.0

    divergent = [
        {"action": "refund", "amount": 50, "approved": True},
        {"action": "deny", "amount": 0, "approved": False},
        {"action": "review", "amount": 50, "approved": False},
    ]
    assert compute_output_consistency(divergent) == 0.0


def test_compute_output_consistency_single_or_empty():
    assert compute_output_consistency([]) == 1.0
    assert compute_output_consistency(["Only one"]) == 1.0


@respx.mock
def test_trace_llm_consistency_check_high_agreement():
    configure(
        AgentWatchConfig(
            api_key="test-key",
            endpoint="https://ingestion.test",
            org_id="org-1",
            plan_tier="team",
            flush_interval_seconds=60,
        )
    )
    route = respx.post("https://ingestion.test/v1/spans").mock(return_value=Response(202))

    call_count = 0

    class MockUsage:
        prompt_tokens = 100
        completion_tokens = 20

    class MockLLMResponse:
        model = "gpt-4o"
        usage = MockUsage()
        choices = [type("Choice", (), {"message": type("Msg", (), {"content": "Refund approved: $50.00"})()})]

    @trace_llm(model="gpt-4o", consistency_check=True, consistency_samples=3, consistency_temperature=0.8)
    def decision_engine(prompt: str, temperature: float = 0.0):
        nonlocal call_count
        call_count += 1
        return MockLLMResponse()

    resp = decision_engine("Process refund #101")
    assert resp.model == "gpt-4o"
    assert call_count == 3  # 1 primary + 2 samples

    exporter.flush()
    assert route.called
    span = json.loads(route.calls.last.request.content)["spans"][0]
    assert span["span_type"] == "llm_call"
    assert span["metadata"]["consistency_check"] is True
    assert span["metadata"]["consistency_score"] == 1.0
    assert span["metadata"]["consistency_samples"] == 3
    assert span["metadata"]["consistency_temperature"] == 0.8
    assert len(span["metadata"]["alternate_outputs"]) == 2
    # Token usage aggregated
    assert span["prompt_tokens"] == 300
    assert span["completion_tokens"] == 60


@respx.mock
def test_trace_llm_consistency_check_divergent_outputs():
    configure(
        AgentWatchConfig(
            api_key="test-key",
            endpoint="https://ingestion.test",
            org_id="org-1",
            plan_tier="enterprise",
            flush_interval_seconds=60,
        )
    )
    route = respx.post("https://ingestion.test/v1/spans").mock(return_value=Response(202))

    counter = 0

    @trace_llm(name="diagnosis_check", consistency_check=True, consistency_samples=3)
    def medical_triage(symptoms: str):
        nonlocal counter
        counter += 1
        responses = [
            "Prescribe amoxicillin 500mg twice daily for bacterial infection.",
            "Recommend rest, hydration, and OTC paracetamol for viral illness.",
            "Escalate to urgent care for full pulmonary examination.",
        ]
        return responses[counter - 1]

    resp = medical_triage("Patient has mild cough and fever")
    assert "amoxicillin" in resp
    assert counter == 3

    exporter.flush()
    assert route.called
    span = json.loads(route.calls.last.request.content)["spans"][0]
    assert span["name"] == "diagnosis_check"
    assert span["metadata"]["consistency_score"] < 0.6
    assert len(span["metadata"]["alternate_outputs"]) == 2


@pytest.mark.asyncio
async def test_trace_llm_consistency_check_async():
    configure(
        AgentWatchConfig(
            api_key="test-key",
            endpoint="https://ingestion.test",
            org_id="org-1",
            plan_tier="team",
            flush_interval_seconds=60,
        )
    )

    invocations = 0

    @trace_llm(model="claude-3-5-sonnet", consistency_check=True, consistency_samples=3)
    async def async_llm_call(prompt: str):
        nonlocal invocations
        invocations += 1
        return {"decision": "APPROVE", "amount": 100}

    res = await async_llm_call("Verify loan criteria")
    assert res == {"decision": "APPROVE", "amount": 100}
    assert invocations == 3


def test_trace_llm_consistency_check_tier_gating_raises_error():
    configure(
        AgentWatchConfig(
            api_key="test-key",
            endpoint="https://ingestion.test",
            org_id="org-1",
            plan_tier="free",
        )
    )

    @trace_llm(consistency_check=True)
    def test_func():
        return "result"

    with pytest.raises(TierRestrictedError) as exc_info:
        test_func()
    assert "restricted to Team and Enterprise" in str(exc_info.value)


def test_trace_llm_context_manager_tier_gating():
    configure(
        AgentWatchConfig(
            api_key="test-key",
            endpoint="https://ingestion.test",
            org_id="org-1",
            plan_tier="pro",
        )
    )

    with pytest.raises(TierRestrictedError):
        with trace_llm("test_context", consistency_check=True):
            pass
