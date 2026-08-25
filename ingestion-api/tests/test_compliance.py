import io
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient

from app.main import app, state
from app.pdf_generator import generate_audit_pdf


@pytest.fixture
def client():
    # Configure in-memory mode and disabled auth for testing
    return TestClient(app)


def test_pdf_generator_creates_valid_pdf_structure():
    records = [
        {
            "id": 1,
            "org_id": "org_test",
            "created_at": datetime.now(timezone.utc),
            "action": "unmask",
            "api_key_hash": "a1b2c3d4e5f6",
            "span_id": "span_12345",
            "details": "{}",
        },
        {
            "id": 2,
            "org_id": "org_test",
            "created_at": datetime.now(timezone.utc),
            "action": "data_access",
            "api_key_hash": "a1b2c3d4e5f6",
            "span_id": None,
            "details": '{"export_type": "audit_export"}',
        },
    ]
    pdf_bytes = generate_audit_pdf("org_test", records, "2026-01-01", "2026-02-01")
    assert pdf_bytes.startswith(b"%PDF-1.4")
    assert b"%%EOF" in pdf_bytes
    assert b"/Catalog" in pdf_bytes
    assert b"/Pages" in pdf_bytes


def test_audit_export_csv(client):
    state.memory_audit_logs = [
        {
            "id": 1,
            "org_id": "development",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "action": "unmask",
            "api_key_hash": "dev_key_hash",
            "span_id": "span_abc",
            "details": "{}",
        }
    ]
    response = client.get("/v1/compliance/audit-export?format=csv")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment; filename=\"audit-export-development-" in response.headers["content-disposition"]
    content = response.text
    assert "id,org_id,created_at,action,api_key_hash,span_id,details" in content
    assert "unmask" in content
    assert "span_abc" in content


def test_audit_export_pdf(client):
    state.memory_audit_logs = [
        {
            "id": 1,
            "org_id": "development",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "action": "unmask",
            "api_key_hash": "dev_key_hash",
            "span_id": "span_abc",
            "details": "{}",
        }
    ]
    response = client.get("/v1/compliance/audit-export?format=pdf")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF-1.4")
    assert b"%%EOF" in response.content
