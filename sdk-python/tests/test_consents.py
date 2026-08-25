import json
import pytest
import respx
from httpx import Response

import agentwatch
from agentwatch import AgentWatchConfig, configure, set_consent_context, trace_agent, trace_llm, trace_tool
from agentwatch.exporter import exporter
from agentwatch.tracing import current_consent_id


@respx.mock
def test_set_consent_context_propagates_to_child_spans():
    configure(AgentWatchConfig(api_key="test-key", endpoint="https://ingestion.test", org_id="org-1", flush_interval_seconds=60))
    route = respx.post("https://ingestion.test/v1/spans").mock(return_value=Response(202))

    assert current_consent_id.get() is None

    with set_consent_context("cst_form_loan_8819"):
        assert current_consent_id.get() == "cst_form_loan_8819"

        with trace_agent("kyc_processor", user_id="user_rahul_99"):
            with trace_llm("gpt-4.1-mini") as scope:
                scope.finish(output="Verification completed.")

    # Exited context -> reset
    assert current_consent_id.get() is None

    exporter.flush()
    assert route.called
    spans = json.loads(route.calls.last.request.content)["spans"]
    assert len(spans) == 2
    for s in spans:
        assert s["consent_id"] == "cst_form_loan_8819"
        assert s["user_id"] == "user_rahul_99"


def test_consent_scope_resets_on_exit():
    assert current_consent_id.get() is None
    with set_consent_context("temp_consent"):
        assert current_consent_id.get() == "temp_consent"
    assert current_consent_id.get() is None
