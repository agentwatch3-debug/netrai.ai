"""Tests for Cost Breakdown, Evaluation Overhead, and Business Outcome Analytics."""

import pytest
from fastapi.testclient import TestClient

from app.main import app, state


@pytest.fixture
def client(monkeypatch):
    import app.dependencies as deps
    monkeypatch.setattr(deps, "AUTH_DISABLED", True)
    return TestClient(app)


def test_cost_breakdown_endpoint_returns_stacked_categories(client):
    response = client.get("/v1/analytics/cost-breakdown?time_window=24h&overhead_threshold_pct=40")
    assert response.status_code == 200
    data = response.json()

    assert "summary" in data
    assert "agents" in data
    assert "tuning_candidates" in data
    assert "monthly_retry_loop_trends" in data
    assert "retry_loops_summary" in data

    summary = data["summary"]
    assert "total_cost" in summary
    assert "total_original_llm_cost" in summary
    assert "total_eval_judge_cost" in summary
    assert "total_consistency_check_cost" in summary
    assert "total_misunderstanding_cost" in summary
    assert "total_wasted_spend" in summary
    assert "org_cost_per_successful_outcome" in summary
    assert "org_success_rate_pct" in summary

    # Verify stacked categories sum up to total cost
    assert round(
        summary["total_original_llm_cost"]
        + summary["total_eval_judge_cost"]
        + summary["total_consistency_check_cost"]
        + summary["total_misunderstanding_cost"],
        2,
    ) == round(summary["total_cost"], 2)


def test_monthly_retry_loop_trends_and_misunderstanding_wasted_spend(client):
    response = client.get("/v1/analytics/cost-breakdown?time_window=30d")
    assert response.status_code == 200
    data = response.json()

    trends = data["monthly_retry_loop_trends"]
    assert len(trends) >= 3

    for trend in trends:
        assert "month" in trend
        assert "wasted_cost" in trend
        assert "loop_count" in trend
        assert trend["wasted_cost"] > 0
        assert trend["loop_count"] > 0
        assert "top_agent" in trend

    rl_summary = data["retry_loops_summary"]
    assert rl_summary["current_window_wasted_cost"] > 0
    assert rl_summary["total_flagged_loops"] > 0
    assert "primary_waste_driver" in rl_summary

    for agent in data["agents"]:
        assert "misunderstanding_cost" in agent
        assert "misunderstanding_pct" in agent
        assert agent["misunderstanding_cost"] >= 0


def test_eval_overhead_tuning_candidate_flagging(client):
    # Set high threshold (80%) -> few or 0 candidates
    res_high = client.get("/v1/analytics/cost-breakdown?overhead_threshold_pct=80")
    assert res_high.status_code == 200
    data_high = res_high.json()
    count_high = data_high["summary"]["tuning_candidates_count"]

    # Set lower threshold (30%) -> multiple tuning candidates flagged
    res_low = client.get("/v1/analytics/cost-breakdown?overhead_threshold_pct=30")
    assert res_low.status_code == 200
    data_low = res_low.json()
    count_low = data_low["summary"]["tuning_candidates_count"]

    assert count_low >= count_high
    assert count_low > 0

    # Verify tuning candidate recommendation exists
    for cand in data_low["tuning_candidates"]:
        assert cand["is_tuning_candidate"] is True
        assert cand["eval_overhead_pct"] > 30.0
        assert cand["tuning_recommendation"] is not None


def test_cost_per_successful_outcome_metrics(client):
    response = client.get("/v1/analytics/cost-breakdown?agent_id=refund_approval_agent")
    assert response.status_code == 200
    data = response.json()

    assert len(data["agents"]) == 1
    agent = data["agents"][0]

    assert agent["agent_id"] == "refund_approval_agent"
    assert agent["total_sessions"] > 0
    assert agent["successful_outcomes"] > 0
    assert agent["cost_per_successful_outcome"] > 0
    assert agent["misunderstanding_cost"] > 0

    expected_cost_per_outcome = round(agent["total_cost"] / agent["successful_outcomes"], 4)
    assert abs(agent["cost_per_successful_outcome"] - expected_cost_per_outcome) < 0.001

