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


def create_audit_entry(
    prev_hash: str,
    org_id: str,
    actor_id: str,
    action: str,
    target_type: str,
    target_id: str,
    details: Any = None,
    actor_email: str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    created_at: str | None = None,
) -> dict[str, Any]:
    """Construct a cryptographically hashed audit entry dict."""
    entry_hash = compute_entry_hash(
        prev_hash=prev_hash,
        org_id=org_id,
        actor_id=actor_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=details,
        created_at=created_at,
    )
    return {
        "org_id": org_id,
        "actor_id": actor_id,
        "actor_email": actor_email,
        "action": action,
        "target_type": target_type,
        "target_id": str(target_id),
        "details": details or {},
        "ip_address": ip_address,
        "user_agent": user_agent,
        "prev_hash": prev_hash,
        "entry_hash": entry_hash,
        "created_at": created_at,
    }


def insert_chained_audit_log(
    db_url: str,
    org_id: str,
    actor_id: str,
    action: str,
    target_type: str,
    target_id: str,
    details: Any = None,
    actor_email: str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> dict[str, Any] | None:
    """Acquire lock on previous hash and insert an append-only, chained audit log entry."""
    try:
        import psycopg

        with psycopg.connect(db_url) as conn:
            with conn.cursor() as cursor:
                # Lock latest entry for org to guarantee linear chain continuity
                cursor.execute(
                    "SELECT entry_hash FROM audit_logs WHERE org_id = %s ORDER BY id DESC LIMIT 1 FOR UPDATE",
                    (org_id,),
                )
                row = cursor.fetchone()
                prev_hash = row[0] if row and row[0] else GENESIS_HASH

                entry_hash = compute_entry_hash(
                    prev_hash=prev_hash,
                    org_id=org_id,
                    actor_id=actor_id,
                    action=action,
                    target_type=target_type,
                    target_id=str(target_id),
                    details=details,
                )

                cursor.execute(
                    """
                    INSERT INTO audit_logs (
                        org_id, actor_id, actor_email, action, target_type, target_id,
                        details, ip_address, user_agent, prev_hash, entry_hash
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s, %s)
                    RETURNING id, org_id, actor_id, action, target_type, target_id, prev_hash, entry_hash, created_at
                    """,
                    (
                        org_id,
                        actor_id,
                        actor_email,
                        action,
                        target_type,
                        str(target_id),
                        json.dumps(details or {}),
                        ip_address,
                        user_agent,
                        prev_hash,
                        entry_hash,
                    ),
                )
                inserted = cursor.fetchone()
                if inserted:
                    return {
                        "id": inserted[0],
                        "org_id": inserted[1],
                        "actor_id": inserted[2],
                        "action": inserted[3],
                        "target_type": inserted[4],
                        "target_id": inserted[5],
                        "prev_hash": inserted[6],
                        "entry_hash": inserted[7],
                        "created_at": inserted[8].isoformat() if hasattr(inserted[8], "isoformat") else str(inserted[8]),
                    }
    except Exception as exc:
        import logging

        logging.getLogger("agentwatch.audit").debug("Failed to insert chained audit log: %s", exc)
        return None

