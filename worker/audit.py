"""Tamper-Evident SHA-256 Audit Log Chaining and Verification Engine."""

import hashlib
import json
from typing import Any

GENESIS_HASH = "0" * 64


def canonical_serialize(
    prev_hash: str,
    org_id: str,
    actor_id: str,
    action: str,
    target_type: str,
    target_id: str,
    details: Any = None,
    created_at: str | None = None,
) -> bytes:
    """Deterministically serialize audit log fields to UTF-8 bytes for SHA-256 hashing."""
    payload = {
        "prev_hash": prev_hash,
        "org_id": org_id,
        "actor_id": actor_id,
        "action": action,
        "target_type": target_type,
        "target_id": str(target_id),
        "details": details or {},
    }
    if created_at:
        payload["created_at"] = str(created_at)

    serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return serialized.encode("utf-8")


def compute_entry_hash(
    prev_hash: str,
    org_id: str,
    actor_id: str,
    action: str,
    target_type: str,
    target_id: str,
    details: Any = None,
    created_at: str | None = None,
) -> str:
    """Compute SHA-256 hash over previous hash and canonical entry fields."""
    data = canonical_serialize(
        prev_hash=prev_hash,
        org_id=org_id,
        actor_id=actor_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=details,
        created_at=created_at,
    )
    return hashlib.sha256(data).hexdigest()


def verify_audit_log_chain(entries: list[dict[str, Any]]) -> dict[str, Any]:
    """Re-walk the cryptographic hash chain for an organization and verify integrity.

    Returns status dict indicating pass/fail, total verified count, and any broken entry index/ID.
    """
    if not entries:
        return {
            "is_valid": True,
            "total_entries": 0,
            "chain_status": "empty",
            "broken_entry_id": None,
            "reason": None,
        }

    expected_prev = GENESIS_HASH

    for i, entry in enumerate(entries):
        entry_id = entry.get("id", i + 1)
        actual_prev = entry.get("prev_hash")
        actual_hash = entry.get("entry_hash")

        # 1. Verify link continuity
        if actual_prev != expected_prev:
            return {
                "is_valid": False,
                "total_entries": len(entries),
                "verified_up_to_index": i,
                "broken_entry_id": entry_id,
                "chain_status": "tampered",
                "reason": f"Broken chain link at entry #{entry_id}: expected prev_hash '{expected_prev[:12]}...', got '{actual_prev[:12] if actual_prev else None}...'",
            }

        # 2. Verify cryptographic SHA-256 digest of the entry itself
        recomputed = compute_entry_hash(
            prev_hash=actual_prev or GENESIS_HASH,
            org_id=entry.get("org_id", ""),
            actor_id=entry.get("actor_id", ""),
            action=entry.get("action", ""),
            target_type=entry.get("target_type", ""),
            target_id=entry.get("target_id", ""),
            details=entry.get("details"),
            created_at=entry.get("created_at"),
        )

        if actual_hash != recomputed:
            return {
                "is_valid": False,
                "total_entries": len(entries),
                "verified_up_to_index": i,
                "broken_entry_id": entry_id,
                "chain_status": "tampered",
                "reason": f"Cryptographic digest mismatch at entry #{entry_id}: data content has been tampered with.",
            }

        expected_prev = actual_hash

    return {
        "is_valid": True,
        "total_entries": len(entries),
        "chain_status": "verified",
        "broken_entry_id": None,
        "reason": None,
        "head_hash": expected_prev,
    }
