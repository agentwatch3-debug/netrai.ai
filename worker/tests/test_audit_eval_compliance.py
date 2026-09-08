import hashlib
import json
import os
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from worker.audit import (
    GENESIS_HASH,
    compute_entry_hash,
    create_audit_entry,
    verify_audit_log_chain,
)


def test_ungrounded_response_audit_log_entry_creation():
    """Verify that an ungrounded regulated response creates a valid cryptographic audit block."""
    org_id = "org_healthcare_01"
    span_id = "sp_diag_90210"
    consent_id = "HIPAA_CONSENT_FORM_2026_V1"

    details = {
        "description": "Ungrounded response detected on regulated interaction",
        "score_type": "faithfulness",
        "score": 0.25,
        "threshold": 0.70,
        "unsupported_claims": [
            "Patient was diagnosed with Stage 2 Diabetes in 2024.",
            "Prescribe 500mg Metformin twice daily."
        ],
        "action_taken": "blocked",
        "consent_id": consent_id,
        "is_ai_quality_event": True,
        "compliance_relevant": True,
    }

    entry = create_audit_entry(
        prev_hash=GENESIS_HASH,
        org_id=org_id,
        actor_id="eval_engine",
        action="ungrounded_regulated_response",
        target_type="span",
        target_id=span_id,
        details=details,
        actor_email="system@agentwatch.ai",
    )

    assert entry["org_id"] == org_id
    assert entry["action"] == "ungrounded_regulated_response"
    assert entry["target_type"] == "span"
    assert entry["target_id"] == span_id
    assert entry["prev_hash"] == GENESIS_HASH
    assert len(entry["entry_hash"]) == 64
    assert entry["details"]["score"] == 0.25
    assert entry["details"]["action_taken"] == "blocked"
    assert len(entry["details"]["unsupported_claims"]) == 2


def test_chained_eval_failure_in_tamper_evident_audit_log():
    """Verify sequential chaining between regular access logs and AI evaluation failure compliance events."""
    org_id = "org_fintech_compliance"

    # 1. Admin logs in / configures policy
    hash_1 = compute_entry_hash(
        prev_hash=GENESIS_HASH,
        org_id=org_id,
        actor_id="admin_secops",
        action="policy.created",
        target_type="policy_rule",
        target_id="rule_finance_advice",
        details={"mode": "block", "threshold": 0.75},
    )
    block_1 = {
        "id": 1,
        "org_id": org_id,
        "actor_id": "admin_secops",
        "action": "policy.created",
        "target_type": "policy_rule",
        "target_id": "rule_finance_advice",
        "details": {"mode": "block", "threshold": 0.75},
        "prev_hash": GENESIS_HASH,
        "entry_hash": hash_1,
    }

    # 2. AI Eval failure detected on regulated interaction (chained to block 1)
    details_eval = {
        "description": "Ungrounded response detected on regulated interaction",
        "score_type": "factuality",
        "score": 0.40,
        "threshold": 0.70,
        "uncertain_claims": ["Federal Reserve announced a 150bps rate drop tomorrow."],
        "action_taken": "rerouted",
        "consent_id": "DPDP_CONSENT_USER_9981",
        "is_ai_quality_event": True,
        "compliance_relevant": True,
    }
    hash_2 = compute_entry_hash(
        prev_hash=hash_1,
        org_id=org_id,
        actor_id="eval_engine",
        action="ungrounded_regulated_response",
        target_type="span",
        target_id="sp_llm_advice_441",
        details=details_eval,
    )
    block_2 = {
        "id": 2,
        "org_id": org_id,
        "actor_id": "eval_engine",
        "action": "ungrounded_regulated_response",
        "target_type": "span",
        "target_id": "sp_llm_advice_441",
        "details": details_eval,
        "prev_hash": hash_1,
        "entry_hash": hash_2,
    }

    # 3. Compliance auditor reviews and exports audit chain (chained to block 2)
    hash_3 = compute_entry_hash(
        prev_hash=hash_2,
        org_id=org_id,
        actor_id="compliance_officer",
        action="compliance.export_downloaded",
        target_type="audit_log",
        target_id="export_batch_1",
        details={"format": "csv", "records_exported": 2},
    )
    block_3 = {
        "id": 3,
        "org_id": org_id,
        "actor_id": "compliance_officer",
        "action": "compliance.export_downloaded",
        "target_type": "audit_log",
        "target_id": "export_batch_1",
        "details": {"format": "csv", "records_exported": 2},
        "prev_hash": hash_2,
        "entry_hash": hash_3,
    }

    chain = [block_1, block_2, block_3]
    result = verify_audit_log_chain(chain)

    assert result["is_valid"] is True
    assert result["total_entries"] == 3
    assert result["chain_status"] == "verified"
    assert result["broken_entry_id"] is None
    assert result["head_hash"] == hash_3


def test_tampering_with_eval_incident_is_detected():
    """Verify that tampering with an ungrounded response score or claims invalidates the cryptographic chain."""
    org_id = "org_enterprise"

    hash_1 = compute_entry_hash(GENESIS_HASH, org_id, "admin", "org.init", "org", org_id, {})
    block_1 = {
        "id": 1,
        "org_id": org_id,
        "actor_id": "admin",
        "action": "org.init",
        "target_type": "org",
        "target_id": org_id,
        "details": {},
        "prev_hash": GENESIS_HASH,
        "entry_hash": hash_1,
    }

    eval_details = {
        "description": "Ungrounded response detected on regulated interaction",
        "score_type": "faithfulness",
        "score": 0.20,
        "threshold": 0.70,
        "unsupported_claims": ["Customer has unpaid balance of $50,000."],
        "action_taken": "blocked",
        "is_ai_quality_event": True,
    }
    hash_2 = compute_entry_hash(hash_1, org_id, "eval_engine", "ungrounded_regulated_response", "span", "sp_02", eval_details)
    block_2 = {
        "id": 2,
        "org_id": org_id,
        "actor_id": "eval_engine",
        "action": "ungrounded_regulated_response",
        "target_type": "span",
        "target_id": "sp_02",
        "details": eval_details,
        "prev_hash": hash_1,
        "entry_hash": hash_2,
    }

    # Maliciously alter score from 0.20 to 0.95 in block 2
    tampered_block_2 = dict(block_2)
    tampered_block_2["details"] = dict(eval_details)
    tampered_block_2["details"]["score"] = 0.95

    tampered_chain = [block_1, tampered_block_2]
    result = verify_audit_log_chain(tampered_chain)

    assert result["is_valid"] is False
    assert result["broken_entry_id"] == 2
    assert result["chain_status"] == "tampered"
    assert "Cryptographic digest mismatch at entry #2" in result["reason"]
