import json
from uuid import uuid4
import pytest
import respx
from httpx import Response

from agentwatch import (
    AgentWatchCallbackHandler,
    AgentWatchConfig,
    auto_instrument,
    configure,
    patch_anthropic,
    patch_openai,
    unpatch_openai,
)
from agentwatch.exporter import exporter


class MockOpenAIClient:
    def __init__(self):
        class Completions:
            def create(self, **kwargs):
                class Usage:
                    prompt_tokens = 150
                    completion_tokens = 45
                class ResponseObj:
                    model = "gpt-4.1-mini"
                    usage = Usage()
                return ResponseObj()
        class Chat:
            completions = Completions()
        self.chat = Chat()


class MockAnthropicClient:
    def __init__(self):
        class Messages:
            def create(self, **kwargs):
                class Usage:
                    input_tokens = 200
                    output_tokens = 80
                class ResponseObj:
                    model = "claude-3-5-haiku"
                    usage = Usage()
                return ResponseObj()
        self.messages = Messages()


@respx.mock
def test_openai_client_auto_instrumentation():
    configure(AgentWatchConfig(api_key="test-key", endpoint="https://ingestion.test", org_id="org-1", flush_interval_seconds=60))
    route = respx.post("https://ingestion.test/v1/spans").mock(return_value=Response(202))

    client = MockOpenAIClient()
    patch_openai(client)

    resp = client.chat.completions.create(model="gpt-4.1-mini", messages=[{"role": "user", "content": "Hello"}])
    assert resp.model == "gpt-4.1-mini"

    exporter.flush()
    assert route.called
    span = json.loads(route.calls.last.request.content)["spans"][0]
    assert span["span_type"] == "llm_call"
    assert span["model"] == "gpt-4.1-mini"
    assert span["prompt_tokens"] == 150
    assert span["completion_tokens"] == 45
    assert span["cost_usd"] > 0


@respx.mock
def test_anthropic_client_auto_instrumentation():
    configure(AgentWatchConfig(api_key="test-key", endpoint="https://ingestion.test", org_id="org-1", flush_interval_seconds=60))
    route = respx.post("https://ingestion.test/v1/spans").mock(return_value=Response(202))

    client = MockAnthropicClient()
    patch_anthropic(client)

    resp = client.messages.create(model="claude-3-5-haiku", messages=[{"role": "user", "content": "Analyze code"}])
    assert resp.model == "claude-3-5-haiku"

    exporter.flush()
    assert route.called
    span = json.loads(route.calls.last.request.content)["spans"][0]
    assert span["span_type"] == "llm_call"
    assert span["model"] == "claude-3-5-haiku"
    assert span["prompt_tokens"] == 200
    assert span["completion_tokens"] == 80


@respx.mock
def test_langchain_callback_handler():
    configure(AgentWatchConfig(api_key="test-key", endpoint="https://ingestion.test", org_id="org-1", flush_interval_seconds=60))
    route = respx.post("https://ingestion.test/v1/spans").mock(return_value=Response(202))

    handler = AgentWatchCallbackHandler(agent_id="support_bot")
    run_id = uuid4()

    # Simulate LangChain LLM lifecycle
    handler.on_llm_start({"name": "ChatOpenAI"}, ["What is the refund policy?"], run_id=run_id)
    class MockLLMOutput:
        token_usage = {"prompt_tokens": 80, "completion_tokens": 30}
        model_name = "gpt-4o-mini"
    class MockGen:
        text = "Our refund policy is 30 days."
    class MockResponse:
        llm_output = MockLLMOutput()
        generations = [[MockGen()]]

    handler.on_llm_end(MockResponse(), run_id=run_id)

    exporter.flush()
    assert route.called
    span = json.loads(route.calls.last.request.content)["spans"][0]
    assert span["name"] == "ChatOpenAI"
    assert span["agent_id"] == "support_bot"
    assert span["model"] == "gpt-4o-mini"
    assert span["prompt_tokens"] == 80


def test_auto_instrument_all_safe():
    auto_instrument(openai=True, anthropic=True, litellm=True)
