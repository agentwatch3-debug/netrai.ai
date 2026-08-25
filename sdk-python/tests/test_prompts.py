import json
import pytest
import respx
from httpx import Response

from agentwatch import AgentWatchConfig, PromptTemplate, configure, get_prompt, publish_prompt


def test_prompt_template_compile():
    template = PromptTemplate(
        name="customer_triage",
        template="Hello {{user_name}}, your order {{order_id}} status is {{status}}.",
        version=2,
        model="gpt-4.1-mini",
    )
    rendered = template.compile(user_name="Aarav", order_id="ORD-1099", status="Shipped")
    assert rendered == "Hello Aarav, your order ORD-1099 status is Shipped."


@respx.mock
def test_get_prompt_with_api_compilation():
    configure(AgentWatchConfig(api_key="test-key", endpoint="https://ingestion.test", org_id="org-1"))
    respx.post("https://ingestion.test/v1/prompts/support_bot/compile?label=production").mock(
        return_value=Response(
            200,
            json={
                "name": "support_bot",
                "version": 3,
                "model": "gpt-4.1-mini",
                "model_parameters": {"temperature": 0.3},
                "raw_template": "Support prompt for {{topic}}",
                "compiled_prompt": "Support prompt for refunds",
            },
        )
    )

    prompt = get_prompt("support_bot", variables={"topic": "refunds"})
    assert prompt.version == 3
    assert prompt.template == "Support prompt for refunds"


@respx.mock
def test_publish_prompt_api():
    configure(AgentWatchConfig(api_key="test-key", endpoint="https://ingestion.test", org_id="org-1"))
    route = respx.post("https://ingestion.test/v1/prompts/sql_gen/versions").mock(
        return_value=Response(201, json={"status": "created"})
    )

    ok = publish_prompt(
        name="sql_gen",
        template="Generate SQL for: {{query}}",
        model="gpt-4o",
        commit_message="Added Postgres schema tables",
    )
    assert ok is True
    assert route.called
    data = json.loads(route.calls.last.request.content)
    assert data["template"] == "Generate SQL for: {{query}}"
    assert data["model"] == "gpt-4o"
