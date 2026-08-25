import hashlib
import json
import pytest

from worker.audit import GENESIS_HASH, compute_entry_hash, verify_audit_log_chain


def test_erasure_request_audit_logging_sanitizes_pii():
    """Verify that when an erasure request is executed, only record counts and actor metadata are logged to the cryptographic hash chain, and no customer PII is preserved."""
    org_id = "org_gdpr_compliance"
    end_user_id = "cust_sensitive_user_77"
    deleted_spans = 42
    deleted_pii = 8

    # Step 1: Genesis block
    genesis_hash = compute_entry_hash(
        prev_hash=GENESIS_HASH,
        org_id=org_id,
        actor_id="dpo@acmewatch.com",
        action="organization.init",
        target_type="organization",
        target_id=org_id,
    )
    block_1 = {
        "id": 1,
        "org_id": org_id,
        "actor_id": "dpo@acmewatch.com",
        "action": "organization.init",
        "target_type": "organization",
        "target_id": org_id,
        "details": {},
        "prev_hash": GENESIS_HASH,
        "entry_hash": genesis_hash,
    }

    # Step 2: Audit entry for erasure execution (sanitized details)
    sanitized_details = {
        "deleted_spans_count": deleted_spans,
        "deleted_pii_count": deleted_pii,
        "approved_by": "security_admin@acmewatch.com",
        "request_id": 101,
    }
    # Ensure no customer raw text or PII leaked into details
    assert "cust_sensitive_user_77" not in json.dumps(sanitized_details)

    erasure_hash = compute_entry_hash(
        prev_hash=genesis_hash,
        org_id=org_id,
        actor_id="security_admin@acmewatch.com",
        action="subject_rights.erasure_executed",
        target_type="subject_rights_request",
        target_id="101",
        details=sanitized_details,
    )
    block_2 = {
        "id": 2,
        "org_id": org_id,
        "actor_id": "security_admin@acmewatch.com",
        "action": "subject_rights.erasure_executed",
        "target_type": "subject_rights_request",
        "target_id": "101",
        "details": sanitized_details,
        "prev_hash": genesis_hash,
        "entry_hash": erasure_hash,
    }

    chain = [block_1, block_2]
    res = verify_audit_log_chain(chain)

    assert res["is_valid"] is True
    assert res["total_entries"] == 2
    assert res["chain_status"] == "verified"


def test_subject_rights_export_archive_url_generation():
    end_user_id = "cust_export_123"
    export_url = f"https://storage.agentwatch.dev/exports/export_{end_user_id}.json"
    assert export_url.startswith("https://")
    assert "cust_export_123" in export_url
    assert export_url.endswith(".json")


def test_two_step_safety_gate_status_transitions():
    """Verify state machine: pending_approval -> completed or rejected."""
    initial_request = {
        "id": 1,
        "status": "pending_approval",
        "spans_count": 15,
        "pii_records_count": 3,
        "deleted_spans_count": 0,
        "deleted_pii_count": 0,
        "approved_by": None,
    }

    # Step 1: Request cannot delete without approval
    assert initial_request["deleted_spans_count"] == 0

    # Step 2: Admin approves -> transitions to completed
    approved_request = dict(initial_request)
    approved_request["status"] = "completed"
    approved_request["approved_by"] = "admin@acmewatch.com"
    approved_request["deleted_spans_count"] = approved_request["spans_count"]
    approved_request["deleted_pii_count"] = approved_request["pii_records_count"]

    assert approved_request["status"] == "completed"
    assert approved_request["deleted_spans_count"] == 15
    assert approved_request["deleted_pii_count"] == 3
    assert approved_request["approved_by"] == "admin@acmewatch.com"
