import json

import respx
from httpx import Response

from agentwatch import AgentWatchConfig, configure, trace_agent, trace_llm, trace_tool
from agentwatch.exporter import exporter


class MockUsage:
    prompt_tokens = 100
    completion_tokens = 25


class MockOpenAIResponse:
    model = "gpt-4.1-mini"
    usage = MockUsage()


@respx.mock
def test_openai_response_is_batched_and_exported() -> None:
    configure(AgentWatchConfig(api_key="test-key", endpoint="https://ingestion.test", org_id="org-1", flush_interval_seconds=60))
    route = respx.post("https://ingestion.test/v1/spans").mock(return_value=Response(202))

    @trace_llm("openai.chat")
    def call_openai() -> MockOpenAIResponse:
        return MockOpenAIResponse()

    call_openai()
    exporter.flush()

    assert route.called
    span = json.loads(route.calls.last.request.content)["spans"][0]
    assert span["model"] == "gpt-4.1-mini"
    assert span["prompt_tokens"] == 100
    assert span["completion_tokens"] == 25


@respx.mock
def test_agent_propagates_parent_span_to_tools() -> None:
    configure(AgentWatchConfig(api_key="test-key", endpoint="https://ingestion.test", org_id="org-1", flush_interval_seconds=60))
    route = respx.post("https://ingestion.test/v1/spans").mock(return_value=Response(202))

    @trace_tool()
    def retrieve(query: str) -> str:
        return f"result:{query}"

    with trace_agent("research", agent_id="researcher"):
        retrieve("pricing")
    exporter.flush()

    spans = json.loads(route.calls.last.request.content)["spans"]
    agent = next(span for span in spans if span["span_type"] == "agent_call")
    tool = next(span for span in spans if span["span_type"] == "tool_call")
    assert tool["trace_id"] == agent["trace_id"]
    assert tool["parent_span_id"] == agent["span_id"]
