import json
import pytest
import respx
from httpx import Response

from agentwatch import (
    AgentWatchConfig,
    LowConfidenceResponse,
    configure,
    trace_llm,
)
from agentwatch.exporter import exporter


@respx.mock
def test_trace_llm_eval_gate_block_raises_low_confidence():
    configure(
        AgentWatchConfig(
            api_key="test-key",
            endpoint="https://ingestion.test",
            org_id="org-1",
            flush_interval_seconds=60,
        )
    )
    respx.post("https://ingestion.test/v1/spans").mock(return_value=Response(202))

    retrieved_doc = "Standard domestic shipping takes 3-5 business days."

    @trace_llm(
        name="shipping_advisor",
        eval_gate=True,
        gate_score_type="faithfulness",
        gate_threshold=0.7,
        gate_action="block",
        context=retrieved_doc,
    )
    def answer_shipping(prompt: str):
        return "We provide guaranteed free teleportation and instant delivery across the galaxy in 5 seconds."

    with pytest.raises(LowConfidenceResponse) as exc_info:
        answer_shipping("When will my order arrive?")

    err = exc_info.value
    assert err.score < 0.7
    assert err.check_type == "faithfulness"
    assert len(err.unsupported_claims) > 0
    exporter.flush()



@respx.mock
def test_trace_llm_eval_gate_faithful_response_passes():
    configure(
        AgentWatchConfig(
            api_key="test-key",
            endpoint="https://ingestion.test",
            org_id="org-1",
            flush_interval_seconds=60,
        )
    )
    route = respx.post("https://ingestion.test/v1/spans").mock(return_value=Response(202))

    retrieved_doc = "Standard domestic shipping takes 3-5 business days."

    @trace_llm(
        name="shipping_advisor",
        eval_gate=True,
        gate_threshold=0.7,
        gate_action="block",
        context=retrieved_doc,
    )
    def answer_shipping(prompt: str):
        return "Standard domestic shipping takes 3-5 business days."

    res = answer_shipping("When will my order arrive?")
    assert res == "Standard domestic shipping takes 3-5 business days."

    exporter.flush()
    assert route.called
    span = json.loads(route.calls.last.request.content)["spans"][0]
    assert span["metadata"]["eval_gate"] is True
    assert span["metadata"]["eval_gate_passed"] is True
    assert span["metadata"]["eval_gate_score"] == 1.0


@respx.mock
def test_trace_llm_eval_gate_reroute_to_fallback_model():
    configure(
        AgentWatchConfig(
            api_key="test-key",
            endpoint="https://ingestion.test",
            org_id="org-1",
            flush_interval_seconds=60,
        )
    )
    route = respx.post("https://ingestion.test/v1/spans").mock(return_value=Response(202))

    context_doc = "The policy covers fire and flood damage only."

    def llm_call(prompt: str, model: str = "gpt-4o-mini"):
        if model == "gpt-4o-mini":
            # Weak model hallucinates
            return "The policy covers earthquake damage, asteroid impacts, and alien invasions."
        else:
            # Stronger fallback model produces grounded output
            return "The policy covers fire and flood damage only."

    traced = trace_llm(
        model="gpt-4o-mini",
        eval_gate=True,
        gate_threshold=0.7,
        gate_action="reroute_to_model",
        fallback_model="gpt-4o",
        context=context_doc,
    )(llm_call)

    result = traced("What does the policy cover?")
    assert result == "The policy covers fire and flood damage only."

    exporter.flush()
    assert route.called
    span = json.loads(route.calls.last.request.content)["spans"][0]
    assert span["metadata"]["eval_gate_rerouted"] is True
    assert span["metadata"]["fallback_model"] == "gpt-4o"


@respx.mock
def test_trace_llm_eval_gate_flag_action():
    configure(
        AgentWatchConfig(
            api_key="test-key",
            endpoint="https://ingestion.test",
            org_id="org-1",
            flush_interval_seconds=60,
        )
    )
    route = respx.post("https://ingestion.test/v1/spans").mock(return_value=Response(202))

    context_doc = "Standard return is 30 days."

    @trace_llm(
        eval_gate=True,
        gate_threshold=0.8,
        gate_action="flag",
        context=context_doc,
    )
    def returns_bot(query: str):
        return "Returns are accepted within 30 days with receipt, but you might possibly get an extension."

    res = returns_bot("Can I return after 40 days?")
    assert "Returns are accepted" in res

    exporter.flush()
    assert route.called
    span = json.loads(route.calls.last.request.content)["spans"][0]
    assert span["metadata"]["eval_gate"] is True


@pytest.mark.asyncio
@respx.mock
async def test_trace_llm_eval_gate_async():
    configure(
        AgentWatchConfig(
            api_key="test-key",
            endpoint="https://ingestion.test",
            org_id="org-1",
            flush_interval_seconds=60,
        )
    )
    route = respx.post("https://ingestion.test/v1/spans").mock(return_value=Response(202))

    doc = "Authorized limit is $500 per transaction."

    @trace_llm(
        eval_gate=True,
        gate_threshold=0.7,
        gate_action="block",
        context=doc,
    )
    async def async_limit_check(user_id: str):
        return "The authorized limit is $500 per transaction."

    res = await async_limit_check("usr_123")
    assert "$500" in res

    exporter.flush()
    assert route.called

