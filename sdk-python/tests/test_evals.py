import json
import pytest
import respx
from httpx import Response

from agentwatch import AgentWatchConfig, configure, score, trace_agent, trace_tool


@respx.mock
def test_score_submission_to_api():
    configure(AgentWatchConfig(api_key="test-key", endpoint="https://ingestion.test", org_id="org-1"))
    route = respx.post("https://ingestion.test/v1/evals/scores").mock(return_value=Response(201, json={"status": "created"}))

    ok = score(
        span_id="sp_test_1",
        score_name="hallucination",
        value=0.95,
        reasoning="All claims match source documents",
        trace_id="tr_test_1",
        evaluator_type="automated",
    )
    assert ok is True
    assert route.called
    data = json.loads(route.calls.last.request.content)
    assert data["span_id"] == "sp_test_1"
    assert data["score_name"] == "hallucination"
    assert data["score_value"] == 0.95


@respx.mock
def test_span_scope_score_method():
    configure(AgentWatchConfig(api_key="test-key", endpoint="https://ingestion.test", org_id="org-1"))
    route = respx.post("https://ingestion.test/v1/evals/scores").mock(return_value=Response(201, json={"status": "created"}))
    respx.post("https://ingestion.test/v1/spans").mock(return_value=Response(202))

    with trace_agent("test_agent") as span:
        ok = span.score("accuracy", 1.0, reasoning="Perfect match")
        assert ok is True

    assert route.called
    data = json.loads(route.calls.last.request.content)
    assert data["score_name"] == "accuracy"
    assert data["score_value"] == 1.0
    from agentwatch.exporter import exporter
    exporter.flush()
