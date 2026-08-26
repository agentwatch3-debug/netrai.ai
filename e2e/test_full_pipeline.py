"""End-to-end integration test validating ingestion, PII masking, ClickHouse storage,

unmasking, and audit log generation across live docker services.
"""

import hashlib
import json
import os
import secrets
import time
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import psycopg
import pytest

INGESTION_API_URL = os.getenv("INGESTION_API_URL", "http://localhost:8000").rstrip("/")
CLICKHOUSE_URL = os.getenv("CLICKHOUSE_HTTP_URL", "http://localhost:8123").rstrip("/")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://agentwatch:agentwatch@localhost:5432/agentwatch")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")


def wait_for_service(check_fn, timeout_secs: int = 45, interval_secs: float = 1.0, service_name: str = "service"):
    """Poll check_fn until it returns True or timeout is reached."""
    start = time.time()
    last_err = None
    while time.time() - start < timeout_secs:
        try:
            if check_fn():
                return True
        except Exception as e:
            last_err = e
        time.sleep(interval_secs)
    raise TimeoutError(f"Service {service_name} did not become ready within {timeout_secs}s. Last error: {last_err}")


@pytest.fixture(scope="session", autouse=True)
def wait_for_all_services():
    """Ensure Postgres, ClickHouse, Redis, and Ingestion API are reachable and healthy."""
    # 1. Ingestion API Healthz
    def check_api():
        req = urllib.request.Request(f"{INGESTION_API_URL}/healthz")
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            return resp.status == 200

    wait_for_service(check_api, service_name="Ingestion API (/healthz)")

    # 2. PostgreSQL
    def check_postgres():
        with psycopg.connect(DATABASE_URL, connect_timeout=3) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                return cur.fetchone()[0] == 1

    wait_for_service(check_postgres, service_name="PostgreSQL")

    # 3. ClickHouse
    def check_clickhouse():
        req = urllib.request.Request(f"{CLICKHOUSE_URL}/?query=SELECT%201")
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            return resp.read().strip() == b"1"

    wait_for_service(check_clickhouse, service_name="ClickHouse")


@pytest.fixture
def auth_key() -> tuple[str, str]:
    """Generate and insert an active API key with ingest and unmask scopes into Postgres."""
    org_id = f"e2e-org-{secrets.token_hex(4)}"
    raw_api_key = f"aw_test_{secrets.token_hex(16)}"
    key_hash = hashlib.sha256(raw_api_key.encode()).hexdigest()

    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            # Ensure orgs record exists
            cur.execute(
                """
                INSERT INTO orgs (id, plan_tier, monthly_spans_limit, retention_days)
                VALUES (%s, 'pro', 1000000, 30)
                ON CONFLICT (id) DO NOTHING
                """,
                (org_id,),
            )
            # Insert api_key with unmask scope
            cur.execute(
                """
                INSERT INTO api_keys (org_id, key_hash, scopes, name)
                VALUES (%s, %s, ARRAY['ingest', 'unmask', 'compliance'], 'E2E Test Runner')
                """,
                (org_id, key_hash),
            )
            conn.commit()

    return org_id, raw_api_key


def test_full_e2e_pipeline(auth_key: tuple[str, str]):
    """Execute complete end-to-end lifecycle:

    1. Submit span with sensitive PII (Email + Aadhaar).
    2. Background worker consumes from Redis and masks PII with Presidio.
    3. ClickHouse stores masked tokens (<EMAIL_ADDRESS_1>, <AADHAAR_1>).
    4. Unmask endpoint successfully restores original plaintexts using MultiFernet.
    5. Audit log table in Postgres records the unmasking action.
    """
    org_id, api_key = auth_key
    span_id = f"sp_e2e_{secrets.token_hex(6)}"
    trace_id = f"tr_e2e_{secrets.token_hex(8)}"

    fake_email = "alice.smith.e2e@example.com"
    fake_aadhaar = "9988 7766 5544"

    raw_input = {
        "user_query": f"Please verify applicant {fake_email} with Aadhaar {fake_aadhaar}",
        "action": "loan_verification",
    }
    raw_output = {
        "status": "approved",
        "notification_sent_to": fake_email,
    }

    now = datetime.now(timezone.utc)
    span_payload = {
        "trace_id": trace_id,
        "span_id": span_id,
        "parent_span_id": None,
        "agent_id": "e2e_loan_officer",
        "parent_agent_id": None,
        "org_id": org_id,
        "session_id": "sess_e2e_01",
        "user_id": "user_e2e_tester",
        "end_user_id": "end_user_e2e_42",
        "name": "loan_officer_evaluation",
        "span_type": "agent_call",
        "input": raw_input,
        "output": raw_output,
        "model": "gpt-4.1-mini",
        "prompt_tokens": 120,
        "completion_tokens": 45,
        "cost_usd": 0.0015,
        "latency_ms": 320,
        "status": "success",
        "error_message": None,
        "started_at": now.isoformat(),
        "ended_at": (now + timedelta(milliseconds=320)).isoformat(),
        "metadata": {"environment": "e2e-test"},
    }

    # Step 1: Send trace batch to Ingestion API
    submit_url = f"{INGESTION_API_URL}/v1/spans"
    req_body = json.dumps({"spans": [span_payload]}).encode("utf-8")
    submit_req = urllib.request.Request(
        submit_url,
        data=req_body,
        headers={"Content-Type": "application/json", "X-AgentWatch-Key": api_key},
        method="POST",
    )

    with urllib.request.urlopen(submit_req, timeout=5.0) as resp:
        assert resp.status == 202, f"Expected 202 Accepted, got {resp.status}"
        resp_data = json.loads(resp.read().decode())
        assert resp_data.get("status") == "accepted"
        assert resp_data.get("accepted") == 1

    # Step 2: Poll ClickHouse until worker processes stream and inserts masked span
    def check_span_in_clickhouse():
        query = f"SELECT input, output FROM spans WHERE span_id = '{span_id}' AND org_id = '{org_id}'"
        encoded_query = urllib.parse.urlencode({"query": query})
        ch_req = urllib.request.Request(f"{CLICKHOUSE_URL}/?{encoded_query}")
        with urllib.request.urlopen(ch_req, timeout=3.0) as ch_resp:
            content = ch_resp.read().decode().strip()
            if content:
                lines = content.split("\n")
                if len(lines) >= 1 and lines[0]:
                    return lines[0]
        return False

    raw_row = wait_for_service(check_span_in_clickhouse, timeout_secs=30, interval_secs=1.0, service_name="ClickHouse worker consumer")
    parts = raw_row.split("\t")
    ch_input_str = parts[0]
    ch_output_str = parts[1] if len(parts) > 1 else ""

    # Step 3: Assert masking - ClickHouse must have masked tokens and NEVER raw PII
    assert fake_email not in ch_input_str, "Raw email address leaked into ClickHouse!"
    assert fake_aadhaar not in ch_input_str, "Raw Aadhaar leaked into ClickHouse!"
    assert "<EMAIL_ADDRESS_" in ch_input_str or "<EMAIL_" in ch_input_str
    assert "<AADHAAR_" in ch_input_str

    if ch_output_str:
        assert fake_email not in ch_output_str

    # Step 4: Call /v1/spans/{span_id}/unmask with unmask-scoped API key
    unmask_url = f"{INGESTION_API_URL}/v1/spans/{span_id}/unmask"
    unmask_req = urllib.request.Request(
        unmask_url,
        data=b"",
        headers={"Content-Type": "application/json", "X-AgentWatch-Key": api_key},
        method="POST",
    )

    with urllib.request.urlopen(unmask_req, timeout=5.0) as unmask_resp:
        assert unmask_resp.status == 200
        unmask_data = json.loads(unmask_resp.read().decode())
        assert unmask_data["span_id"] == span_id
        replacements = unmask_data.get("replacements", {})

        # Assert decrypted values match original plaintexts
        decrypted_values = set(replacements.values())
        assert fake_email in decrypted_values, f"Expected {fake_email} in decrypted replacements, got {replacements}"
        assert fake_aadhaar in decrypted_values, f"Expected {fake_aadhaar} in decrypted replacements, got {replacements}"

    # Step 5: Assert audit_log entry created in Postgres
    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, org_id, action, span_id, created_at
                FROM audit_log
                WHERE org_id = %s AND span_id = %s AND action = 'unmask'
                """,
                (org_id, span_id),
            )
            audit_entry = cur.fetchone()
            assert audit_entry is not None, f"No audit_log entry found for unmasking span {span_id}"
            assert audit_entry[1] == org_id
            assert audit_entry[2] == "unmask"
            assert audit_entry[3] == span_id
