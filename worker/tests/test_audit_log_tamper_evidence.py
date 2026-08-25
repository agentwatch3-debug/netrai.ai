import hashlib
import json
import pytest

from worker.audit import GENESIS_HASH, compute_entry_hash, verify_audit_log_chain


def test_genesis_hash_format():
    assert len(GENESIS_HASH) == 64
    assert GENESIS_HASH == "0" * 64


def test_audit_log_chain_verification_passes_for_valid_chain():
    org_id = "org_enterprise_corp"

    # Block 1 (Genesis)
    hash_1 = compute_entry_hash(
        prev_hash=GENESIS_HASH,
        org_id=org_id,
        actor_id="user_admin",
        action="organization.created",
        target_type="organization",
        target_id=org_id,
        details={"tier": "enterprise"},
    )
    block_1 = {
        "id": 1,
        "org_id": org_id,
        "actor_id": "user_admin",
        "action": "organization.created",
        "target_type": "organization",
        "target_id": org_id,
        "details": {"tier": "enterprise"},
        "prev_hash": GENESIS_HASH,
        "entry_hash": hash_1,
    }

    # Block 2
    hash_2 = compute_entry_hash(
        prev_hash=hash_1,
        org_id=org_id,
        actor_id="user_admin",
        action="policy.created",
        target_type="policy_rule",
        target_id="pol_01",
        details={"mode": "block"},
    )
    block_2 = {
        "id": 2,
        "org_id": org_id,
        "actor_id": "user_admin",
        "action": "policy.created",
        "target_type": "policy_rule",
        "target_id": "pol_01",
        "details": {"mode": "block"},
        "prev_hash": hash_1,
        "entry_hash": hash_2,
    }

    # Block 3
    hash_3 = compute_entry_hash(
        prev_hash=hash_2,
        org_id=org_id,
        actor_id="user_secops",
        action="sso.enabled",
        target_type="sso_connection",
        target_id="okta",
        details={"enforce": True},
    )
    block_3 = {
        "id": 3,
        "org_id": org_id,
        "actor_id": "user_secops",
        "action": "sso.enabled",
        "target_type": "sso_connection",
        "target_id": "okta",
        "details": {"enforce": True},
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


def test_tampered_content_detected_and_pinpoints_corrupted_row():
    org_id = "org_bank"
    hash_1 = compute_entry_hash(GENESIS_HASH, org_id, "user_1", "key.created", "api_key", "k1", {})
    block_1 = {"id": 1, "org_id": org_id, "actor_id": "user_1", "action": "key.created", "target_type": "api_key", "target_id": "k1", "details": {}, "prev_hash": GENESIS_HASH, "entry_hash": hash_1}

    hash_2 = compute_entry_hash(hash_1, org_id, "user_1", "quota.updated", "quota", "q1", {"limit": 1000})
    block_2 = {"id": 2, "org_id": org_id, "actor_id": "user_1", "action": "quota.updated", "target_type": "quota", "target_id": "q1", "details": {"limit": 1000}, "prev_hash": hash_1, "entry_hash": hash_2}

    # Malicious actor modified block 2 action in place without updating hash
    tampered_block_2 = dict(block_2)
    tampered_block_2["action"] = "quota.deleted_all"

    hash_3 = compute_entry_hash(hash_2, org_id, "user_1", "user.blocked", "user", "u1", {})
    block_3 = {"id": 3, "org_id": org_id, "actor_id": "user_1", "action": "user.blocked", "target_type": "user", "target_id": "u1", "details": {}, "prev_hash": hash_2, "entry_hash": hash_3}

    corrupted_chain = [block_1, tampered_block_2, block_3]
    result = verify_audit_log_chain(corrupted_chain)

    assert result["is_valid"] is False
    assert result["broken_entry_id"] == 2
    assert result["chain_status"] == "tampered"
    assert "Cryptographic digest mismatch at entry #2" in result["reason"]


def test_broken_prev_hash_link_detected():
    org_id = "org_fintech"
    hash_1 = compute_entry_hash(GENESIS_HASH, org_id, "admin", "org.init", "org", "o1", {})
    block_1 = {"id": 1, "org_id": org_id, "actor_id": "admin", "action": "org.init", "target_type": "org", "target_id": "o1", "details": {}, "prev_hash": GENESIS_HASH, "entry_hash": hash_1}

    # Block 2 has corrupted prev_hash pointing to invalid random hash
    fake_prev = "a" * 64
    hash_2 = compute_entry_hash(fake_prev, org_id, "admin", "key.revoked", "key", "k1", {})
    block_2 = {"id": 2, "org_id": org_id, "actor_id": "admin", "action": "key.revoked", "target_type": "key", "target_id": "k1", "details": {}, "prev_hash": fake_prev, "entry_hash": hash_2}

    broken_chain = [block_1, block_2]
    result = verify_audit_log_chain(broken_chain)

    assert result["is_valid"] is False
    assert result["broken_entry_id"] == 2
    assert result["chain_status"] == "tampered"
    assert "Broken chain link at entry #2" in result["reason"]
