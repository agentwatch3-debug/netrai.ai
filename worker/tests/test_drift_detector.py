import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
import respx
from httpx import Response
from drift_detector import ScopeDriftDetector


def test_new_tool_anomaly_detection():
    detector = ScopeDriftDetector()
    detector.add_baseline_tool("org_test", "support_bot", "lookup_order")

    # Baseline tool call -> no anomaly
    known_span = {
        "span_type": "tool_call",
        "org_id": "org_test",
        "agent_id": "support_bot",
        "name": "lookup_order",
        "input": {"order_id": "123"},
        "trace_id": "tr_1",
        "span_id": "sp_1",
    }
    anomalies = detector.check_span(known_span)
    assert len(anomalies) == 0

    # New unapproved tool call -> anomaly detected
    new_tool_span = {
        "span_type": "tool_call",
        "org_id": "org_test",
        "agent_id": "support_bot",
        "name": "drop_all_tables",
        "input": {},
        "trace_id": "tr_2",
        "span_id": "sp_2",
    }
    anomalies = detector.check_span(new_tool_span)
    assert len(anomalies) == 1
    assert anomalies[0].anomaly_type == "new_tool"
    assert anomalies[0].resource_name == "drop_all_tables"


def test_unapproved_data_resource_extraction_and_detection():
    detector = ScopeDriftDetector()
    detector.add_baseline_tool("org_test", "sql_agent", "execute_sql")
    detector.add_baseline_resource("org_test", "sql_agent", "table:public_orders")

    # Accessing known table
    known_res_span = {
        "span_type": "tool_call",
        "org_id": "org_test",
        "agent_id": "sql_agent",
        "name": "execute_sql",
        "input": {"query": "SELECT * FROM public_orders WHERE id = 1"},
        "trace_id": "tr_3",
        "span_id": "sp_3",
    }
    assert len(detector.check_span(known_res_span)) == 0

    # Accessing unauthorized sensitive table
    unauthorized_span = {
        "span_type": "tool_call",
        "org_id": "org_test",
        "agent_id": "sql_agent",
        "name": "execute_sql",
        "input": {"query": "SELECT * FROM prod_executive_salaries WHERE level = 10"},
        "trace_id": "tr_4",
        "span_id": "sp_4",
    }
    anomalies = detector.check_span(unauthorized_span)
    assert len(anomalies) == 1
    assert anomalies[0].anomaly_type == "new_resource"
    assert anomalies[0].resource_name == "table:prod_executive_salaries"


@pytest.mark.anyio
@respx.mock
async def test_drift_detector_dispatches_slack_alert_with_trace_link():
    detector = ScopeDriftDetector()
    webhook_route = respx.post("https://hooks.slack.com/services/DRIFT_ALERT").mock(
        return_value=Response(200, json={"ok": True})
    )

    span = {
        "span_type": "tool_call",
        "org_id": "org_test",
        "agent_id": "research_agent",
        "name": "access_payroll",
        "input": {"url": "https://payroll.corp.internal/api"},
        "trace_id": "tr_drift_trace_99",
        "span_id": "sp_drift_span_12",
    }
    anomalies = detector.check_span(span)
    assert len(anomalies) >= 1

    await detector.persist_and_alert(anomalies, webhook_url="https://hooks.slack.com/services/DRIFT_ALERT")

    assert webhook_route.called
    payload = webhook_route.calls.last.request.content.decode("utf-8")
    assert "AgentWatch Scope-Drift Alert" in payload
    assert "research_agent" in payload
    assert "http://localhost:3000/traces/tr_drift_trace_99" in payload
