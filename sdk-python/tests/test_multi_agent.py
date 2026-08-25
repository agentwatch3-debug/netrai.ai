import json
import pytest
import respx
from httpx import Response

import agentwatch
from agentwatch import AgentWatchConfig, configure, trace_agent, trace_llm, trace_tool
from agentwatch.exporter import exporter
from agentwatch.tracing import current_agent_id


@respx.mock
def test_nested_agent_tags_parent_agent_id():
    configure(AgentWatchConfig(api_key="test-key", endpoint="https://ingestion.test", org_id="org-1", flush_interval_seconds=60))
    route = respx.post("https://ingestion.test/v1/spans").mock(return_value=Response(202))

    assert current_agent_id.get() is None

    with trace_agent("orchestrator_agent") as orch_scope:
        assert current_agent_id.get() == "orchestrator_agent"

        with trace_agent("research_subagent") as res_scope:
            assert current_agent_id.get() == "research_subagent"

            with trace_llm("gpt-4.1-mini") as llm_scope:
                llm_scope.finish(output="Subagent completed finding facts.")

        # After exiting child agent, context resets back to orchestrator
        assert current_agent_id.get() == "orchestrator_agent"

    # Fully exited
    assert current_agent_id.get() is None

    exporter.flush()
    assert route.called
    spans = json.loads(route.calls.last.request.content)["spans"]
    assert len(spans) == 3

    # Find the child agent span
    research_span = next(s for s in spans if s["span_type"] == "agent_call" and s["agent_id"] == "research_subagent")
    assert research_span["parent_agent_id"] == "orchestrator_agent"

    # Orchestrator should have no parent_agent_id
    orch_span = next(s for s in spans if s["span_type"] == "agent_call" and s["agent_id"] == "orchestrator_agent")
    assert orch_span["parent_agent_id"] is None


@respx.mock
def test_deep_three_level_agent_hierarchy():
    configure(AgentWatchConfig(api_key="test-key", endpoint="https://ingestion.test", org_id="org-1", flush_interval_seconds=60))
    route = respx.post("https://ingestion.test/v1/spans").mock(return_value=Response(202))

    with trace_agent("top_coordinator"):
        with trace_agent("mid_planner"):
            with trace_agent("leaf_executor"):
                with trace_llm("claude-3-haiku") as llm:
                    llm.finish(output="Leaf task executed.")

    exporter.flush()
    spans = json.loads(route.calls.last.request.content)["spans"]

    leaf_span = next(s for s in spans if s["span_type"] == "agent_call" and s["agent_id"] == "leaf_executor")
    assert leaf_span["parent_agent_id"] == "mid_planner"

    mid_span = next(s for s in spans if s["span_type"] == "agent_call" and s["agent_id"] == "mid_planner")
    assert mid_span["parent_agent_id"] == "top_coordinator"

    top_span = next(s for s in spans if s["span_type"] == "agent_call" and s["agent_id"] == "top_coordinator")
    assert top_span["parent_agent_id"] is None
