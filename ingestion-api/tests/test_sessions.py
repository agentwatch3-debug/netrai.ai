"""Tests for multi-turn sessions and misunderstanding loop endpoints."""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client(monkeypatch):
    import app.dependencies as deps
    monkeypatch.setattr(deps, "AUTH_DISABLED", True)
    return TestClient(app)


def test_list_misunderstanding_loops_endpoint(client):
    response = client.get("/v1/sessions/misunderstanding-loops")
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    loops = data["data"]
    assert len(loops) > 0

    # Verify sorted by wasted cost descending
    costs = [l["total_cost_in_loop"] for l in loops]
    assert costs == sorted(costs, reverse=True)

    # Verify fields in each loop record
    first = loops[0]
    assert "session_id" in first
    assert "retry_count" in first
    assert "total_tokens_in_loop" in first
    assert "total_cost_in_loop" in first
    assert "sample_rephrasings" in first
    assert len(first["sample_rephrasings"]) >= 3


def test_get_session_thread(client):
    response = client.get("/v1/sessions/sess_refund_confusion_882")
    assert response.status_code == 200
    data = response.json()
    assert data["session_id"] == "sess_refund_confusion_882"
    assert "turns" in data
