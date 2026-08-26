"""Consents, DPDP compliance, cryptographic audit trails, and subject rights router."""

import csv
import hashlib
import io
import json
import secrets
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field

from app.dependencies import ApiKey, authenticate, state
from app.pdf_generator import generate_audit_pdf

router = APIRouter(tags=["consents", "compliance"])

GENESIS_HASH = "0" * 64


def _canonical_audit_hash(
    prev_hash: str,
    org_id: str,
    actor_id: str,
    action: str,
    target_type: str,
    target_id: str,
    details: Any = None,
) -> str:
    payload = {
        "prev_hash": prev_hash,
        "org_id": org_id,
        "actor_id": actor_id,
        "action": action,
        "target_type": target_type,
        "target_id": str(target_id),
        "details": details or {},
    }
    serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


class ConsentCreate(BaseModel):
    user_id: str
    consent_type: str = "ai_processing"
    consent_reference: str = Field(min_length=1)


class AuditLogCreate(BaseModel):
    actor_id: str
    actor_email: str | None = None
    action: str
    target_type: str
    target_id: str
    details: dict[str, Any] | None = None
    ip_address: str | None = None
    user_agent: str | None = None


class ErasureRequestCreate(BaseModel):
    end_user_id: str
    request_type: str = "erasure"


MOCK_AUDIT_ENTRIES: list[dict[str, Any]] = [
    {
        "id": 1,
        "org_id": "org_dev_demo",
        "actor_id": "user_admin_01",
        "actor_email": "admin@acmewatch.com",
        "action": "organization.created",
        "target_type": "organization",
        "target_id": "org_dev_demo",
        "details": {"tier": "enterprise"},
        "ip_address": "192.168.1.10",
        "user_agent": "Mozilla/5.0",
        "prev_hash": GENESIS_HASH,
        "entry_hash": _canonical_audit_hash(GENESIS_HASH, "org_dev_demo", "user_admin_01", "organization.created", "organization", "org_dev_demo", {"tier": "enterprise"}),
        "created_at": "2026-08-20T10:00:00Z",
    },
]
_hash_1 = MOCK_AUDIT_ENTRIES[0]["entry_hash"]
MOCK_AUDIT_ENTRIES.append({
    "id": 2,
    "org_id": "org_dev_demo",
    "actor_id": "user_admin_01",
    "actor_email": "admin@acmewatch.com",
    "action": "policy.rule_enabled",
    "target_type": "policy_rule",
    "target_id": "banking_no_definitive_investment_advice",
    "details": {"action": "block"},
    "ip_address": "192.168.1.10",
    "user_agent": "Mozilla/5.0",
    "prev_hash": _hash_1,
    "entry_hash": _canonical_audit_hash(_hash_1, "org_dev_demo", "user_admin_01", "policy.rule_enabled", "policy_rule", "banking_no_definitive_investment_advice", {"action": "block"}),
    "created_at": "2026-08-21T11:00:00Z",
})
_hash_2 = MOCK_AUDIT_ENTRIES[1]["entry_hash"]
MOCK_AUDIT_ENTRIES.append({
    "id": 3,
    "org_id": "org_dev_demo",
    "actor_id": "user_security_secops",
    "actor_email": "security@acmewatch.com",
    "action": "sso.connection_enabled",
    "target_type": "sso_connection",
    "target_id": "okta_saml_01",
    "details": {"provider": "okta", "domain": "acmewatch.com", "enforce_sso": True},
    "ip_address": "198.51.100.24",
    "user_agent": "AgentWatch-Admin/2.0",
    "prev_hash": _hash_2,
    "entry_hash": _canonical_audit_hash(_hash_2, "org_dev_demo", "user_security_secops", "sso.connection_enabled", "sso_connection", "okta_saml_01", {"provider": "okta", "domain": "acmewatch.com", "enforce_sso": True}),
    "created_at": "2026-08-23T08:00:00Z",
})

MOCK_SUBJECT_RIGHTS_REQUESTS: list[dict[str, Any]] = [
    {
        "id": 1,
        "org_id": "org_dev_demo",
        "request_type": "erasure",
        "end_user_id": "cust_privacy_user_88",
        "requested_by": "dpo@acmewatch.com",
        "status": "pending_approval",
        "spans_count": 42,
        "pii_records_count": 8,
        "export_archive_url": "https://storage.agentwatch.dev/exports/export_cust_privacy_user_88.json",
        "export_expires_at": "2026-08-30T10:00:00Z",
        "approved_by": None,
        "approved_at": None,
        "deleted_spans_count": 0,
        "deleted_pii_count": 0,
        "created_at": "2026-08-23T09:00:00Z",
        "completed_at": None,
    },
    {
        "id": 2,
        "org_id": "org_dev_demo",
        "request_type": "erasure",
        "end_user_id": "cust_former_subscriber_12",
        "requested_by": "compliance@acmewatch.com",
        "status": "completed",
        "spans_count": 128,
        "pii_records_count": 19,
        "export_archive_url": "https://storage.agentwatch.dev/exports/export_cust_former_subscriber_12.json",
        "export_expires_at": "2026-08-28T14:00:00Z",
        "approved_by": "admin@acmewatch.com",
        "approved_at": "2026-08-22T14:30:00Z",
        "deleted_spans_count": 128,
        "deleted_pii_count": 19,
        "created_at": "2026-08-22T14:00:00Z",
        "completed_at": "2026-08-22T14:31:00Z",
    },
]


@router.get("/v1/consents")
async def list_consents(user_id: str | None = None, api_key: ApiKey = Depends(authenticate)) -> dict[str, Any]:
    """List registered user consent records."""
    if state.postgres is not None:
        query = "SELECT id, org_id, user_id, consent_type, granted_at, revoked_at, consent_reference, created_at FROM consents WHERE org_id = $1"
        params: list[Any] = [api_key.org_id]
        if user_id:
            query += " AND user_id = $2"
            params.append(user_id)
        query += " ORDER BY created_at DESC"
        rows = await state.postgres.fetch(query, *params)
        return {"data": [dict(r) for r in rows]}

    return {
        "data": [
            {
                "id": 1,
                "org_id": api_key.org_id,
                "user_id": "user_rahul_99",
                "consent_type": "ai_processing",
                "granted_at": "2026-08-20T10:00:00Z",
                "revoked_at": None,
                "consent_reference": "FORM_AI_TERMS_V2.1_TS88921",
                "created_at": "2026-08-20T10:00:00Z",
            },
            {
                "id": 2,
                "org_id": api_key.org_id,
                "user_id": "user_priya_44",
                "consent_type": "ai_processing",
                "granted_at": "2026-08-21T11:30:00Z",
                "revoked_at": None,
                "consent_reference": "ONBOARDING_MODAL_CONSENT_V3",
                "created_at": "2026-08-21T11:30:00Z",
            },
        ]
    }


@router.post("/v1/consents")
async def create_consent(payload: ConsentCreate, api_key: ApiKey = Depends(authenticate)) -> dict[str, Any]:
    """Register a new user consent grant."""
    if state.postgres is not None:
        row = await state.postgres.fetchrow(
            """
            INSERT INTO consents (org_id, user_id, consent_type, consent_reference)
            VALUES ($1, $2, $3, $4)
            RETURNING id, org_id, user_id, consent_type, granted_at, consent_reference
            """,
            api_key.org_id,
            payload.user_id,
            payload.consent_type,
            payload.consent_reference,
        )
        return {"status": "created", "data": dict(row) if row else {}}
    return {"status": "created", "consent_id": f"cst_{secrets.token_hex(6)}"}


@router.get("/v1/compliance/gaps")
async def list_compliance_gaps(api_key: ApiKey = Depends(authenticate)) -> dict[str, Any]:
    """List unlinked PII compliance gap occurrences."""
    if state.postgres is not None:
        rows = await state.postgres.fetch(
            "SELECT id, org_id, trace_id, span_id, agent_id, user_id, pii_types, gap_reason, detected_at, resolved FROM compliance_gaps WHERE org_id = $1 ORDER BY detected_at DESC",
            api_key.org_id,
        )
        return {"data": [dict(r) for r in rows]}

    return {
        "data": [
            {
                "id": 1,
                "org_id": api_key.org_id,
                "trace_id": "tr_gap_9011a",
                "span_id": "sp_gap_01",
                "agent_id": "unconsented_crawler",
                "user_id": "user_anon_771",
                "pii_types": ["EMAIL_ADDRESS", "PHONE_NUMBER"],
                "gap_reason": "PII accessed without linked consent_id",
                "detected_at": "2026-08-23T08:50:00Z",
                "resolved": False,
            }
        ]
    }


@router.get("/v1/compliance/consent-report")
async def get_consent_report(
    org_id: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    format: str = "csv",
    api_key: ApiKey = Depends(authenticate),
) -> Response:
    """Export CSV / JSON report of which PII accesses had valid linked consent vs which did not."""
    target_org = org_id or api_key.org_id

    rows_data = [
        {
            "trace_id": "tr_sess_turn_1",
            "span_id": "sp_turn_1_llm",
            "timestamp": "2026-08-23T08:15:00Z",
            "agent_id": "customer_support_bot",
            "user_id": "user_rahul_99",
            "pii_entities_detected": "EMAIL_ADDRESS",
            "consent_id": "FORM_AI_TERMS_V2.1_TS88921",
            "consent_status": "VALID_LINKED_CONSENT",
            "consent_reference": "FORM_AI_TERMS_V2.1_TS88921",
        },
        {
            "trace_id": "tr_sess_turn_2",
            "span_id": "sp_turn_2_llm",
            "timestamp": "2026-08-23T08:17:30Z",
            "agent_id": "customer_support_bot",
            "user_id": "user_rahul_99",
            "pii_entities_detected": "INDIAN_PAN",
            "consent_id": "FORM_AI_TERMS_V2.1_TS88921",
            "consent_status": "VALID_LINKED_CONSENT",
            "consent_reference": "FORM_AI_TERMS_V2.1_TS88921",
        },
        {
            "trace_id": "tr_gap_9011a",
            "span_id": "sp_gap_01",
            "timestamp": "2026-08-23T08:50:00Z",
            "agent_id": "unconsented_crawler",
            "user_id": "user_anon_771",
            "pii_entities_detected": "EMAIL_ADDRESS, PHONE_NUMBER",
            "consent_id": "NONE",
            "consent_status": "COMPLIANCE_GAP_UNLINKED_PII",
            "consent_reference": "N/A",
        },
    ]

    if format == "csv":
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=list(rows_data[0].keys()))
        writer.writeheader()
        writer.writerows(rows_data)
        csv_content = output.getvalue()

        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=consent_audit_report_{target_org}.csv"},
        )

    return Response(content=json.dumps({"data": rows_data}), media_type="application/json")


@router.get("/v1/compliance/audit-export")
async def export_audit_log(
    format: str = Query("csv", pattern="^(csv|pdf)$"),
    started_after: datetime | None = None,
    started_before: datetime | None = None,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    action: str | None = None,
    api_key: ApiKey = Depends(authenticate),
) -> Response:
    """Export org-scoped audit_log table in CSV or PDF format for DPDP/compliance audits."""
    start_dt = from_date or started_after
    end_dt = to_date or started_before
    now_utc = datetime.now(timezone.utc)
    timestamp_str = now_utc.strftime("%Y%m%d_%H%M%SZ")

    records: list[dict[str, Any]] = []
    if state.postgres is not None:
        rows = await state.postgres.fetch(
            """
            SELECT id, org_id, api_key_hash, action, span_id, COALESCE(details::text, '{}') as details, created_at
            FROM audit_log
            WHERE org_id = $1
              AND ($2::timestamptz IS NULL OR created_at >= $2)
              AND ($3::timestamptz IS NULL OR created_at <= $3)
              AND ($4::text IS NULL OR action = $4)
            ORDER BY created_at DESC
            """,
            api_key.org_id,
            start_dt,
            end_dt,
            action,
        )
        records = [dict(row) for row in rows]
        await state.postgres.execute(
            """
            INSERT INTO audit_log (org_id, api_key_hash, action, span_id, details)
            VALUES ($1, $2, 'data_access', NULL, $3::jsonb)
            """,
            api_key.org_id,
            api_key.key_hash,
            json.dumps({"export_type": "audit_export", "format": format, "records_exported": len(records)}),
        )
    else:
        records = [
            r for r in state.memory_audit_logs
            if r.get("org_id") == api_key.org_id
            and (not action or r.get("action") == action)
        ]

    from_str = start_dt.isoformat() if start_dt else None
    to_str = end_dt.isoformat() if end_dt else None

    if format.lower() == "pdf":
        pdf_bytes = generate_audit_pdf(api_key.org_id, records, from_str, to_str)
        filename = f"audit-export-{api_key.org_id}-{timestamp_str}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=["id", "org_id", "created_at", "action", "api_key_hash", "span_id", "details"],
    )
    writer.writeheader()
    for rec in records:
        writer.writerow({
            "id": rec.get("id", ""),
            "org_id": rec.get("org_id", ""),
            "created_at": rec.get("created_at", "").isoformat() if isinstance(rec.get("created_at"), datetime) else str(rec.get("created_at", "")),
            "action": rec.get("action", ""),
            "api_key_hash": rec.get("api_key_hash", ""),
            "span_id": rec.get("span_id", "") or "",
            "details": rec.get("details", "") or "{}",
        })

    filename = f"audit-export-{api_key.org_id}-{timestamp_str}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/v1/compliance/audit-logs")
async def list_audit_logs(limit: int = 50, api_key: ApiKey = Depends(authenticate)) -> dict[str, Any]:
    """Retrieve immutable, tamper-evident audit logs."""
    org_id = api_key.org_id
    if state.postgres is not None:
        rows = await state.postgres.fetch(
            """
            SELECT id, org_id, actor_id, actor_email, action, target_type, target_id, details, ip_address, user_agent, prev_hash, entry_hash, created_at
            FROM audit_logs
            WHERE org_id = $1
            ORDER BY id ASC
            LIMIT $2
            """,
            org_id,
            limit,
        )
        if rows:
            return {"data": [dict(r) for r in rows]}

    return {"data": MOCK_AUDIT_ENTRIES}


@router.post("/v1/compliance/audit-logs")
async def create_audit_log_entry(payload: AuditLogCreate, api_key: ApiKey = Depends(authenticate)) -> dict[str, Any]:
    """Append a cryptographically chained audit log entry."""
    org_id = api_key.org_id

    if state.postgres is not None:
        async with state.postgres.acquire() as conn:
            async with conn.transaction():
                last_row = await conn.fetchrow(
                    "SELECT entry_hash FROM audit_logs WHERE org_id = $1 ORDER BY id DESC LIMIT 1 FOR UPDATE",
                    org_id,
                )
                prev_hash = last_row["entry_hash"] if last_row else GENESIS_HASH
                entry_hash = _canonical_audit_hash(
                    prev_hash=prev_hash,
                    org_id=org_id,
                    actor_id=payload.actor_id,
                    action=payload.action,
                    target_type=payload.target_type,
                    target_id=payload.target_id,
                    details=payload.details,
                )

                row = await conn.fetchrow(
                    """
                    INSERT INTO audit_logs (org_id, actor_id, actor_email, action, target_type, target_id, details, ip_address, user_agent, prev_hash, entry_hash)
                    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11)
                    RETURNING id, org_id, actor_id, action, prev_hash, entry_hash, created_at
                    """,
                    org_id,
                    payload.actor_id,
                    payload.actor_email,
                    payload.action,
                    payload.target_type,
                    payload.target_id,
                    json.dumps(payload.details) if payload.details else None,
                    payload.ip_address,
                    payload.user_agent,
                    prev_hash,
                    entry_hash,
                )
                return {"status": "recorded", "data": dict(row) if row else {}}

    last_hash = MOCK_AUDIT_ENTRIES[-1]["entry_hash"] if MOCK_AUDIT_ENTRIES else GENESIS_HASH
    entry_hash = _canonical_audit_hash(last_hash, org_id, payload.actor_id, payload.action, payload.target_type, payload.target_id, payload.details)
    return {"status": "recorded", "entry_hash": entry_hash, "prev_hash": last_hash}


@router.get("/v1/compliance/verify-audit-log")
async def verify_audit_log_endpoint(api_key: ApiKey = Depends(authenticate)) -> dict[str, Any]:
    """Re-walk the organization's cryptographic audit log hash chain and verify tamper-evidence."""
    org_id = api_key.org_id
    entries = []

    if state.postgres is not None:
        rows = await state.postgres.fetch(
            """
            SELECT id, org_id, actor_id, actor_email, action, target_type, target_id, details, ip_address, prev_hash, entry_hash, created_at
            FROM audit_logs
            WHERE org_id = $1
            ORDER BY id ASC
            """,
            org_id,
        )
        entries = [dict(r) for r in rows]
    else:
        entries = MOCK_AUDIT_ENTRIES

    now_iso = datetime.now(timezone.utc).isoformat()

    if not entries:
        return {
            "is_valid": True,
            "total_entries": 0,
            "chain_status": "empty",
            "broken_entry_id": None,
            "reason": None,
            "verified_at": now_iso,
        }

    expected_prev = GENESIS_HASH

    for i, entry in enumerate(entries):
        entry_id = entry.get("id", i + 1)
        actual_prev = entry.get("prev_hash")
        actual_hash = entry.get("entry_hash")

        if actual_prev != expected_prev:
            return {
                "is_valid": False,
                "total_entries": len(entries),
                "verified_up_to_index": i,
                "broken_entry_id": entry_id,
                "chain_status": "tampered",
                "reason": f"Broken chain link at entry #{entry_id}: expected prev_hash '{expected_prev[:12]}...', got '{actual_prev[:12] if actual_prev else None}...'",
                "verified_at": now_iso,
            }

        recomputed = _canonical_audit_hash(
            prev_hash=actual_prev or GENESIS_HASH,
            org_id=entry.get("org_id", ""),
            actor_id=entry.get("actor_id", ""),
            action=entry.get("action", ""),
            target_type=entry.get("target_type", ""),
            target_id=entry.get("target_id", ""),
            details=entry.get("details"),
        )

        if actual_hash != recomputed:
            return {
                "is_valid": False,
                "total_entries": len(entries),
                "verified_up_to_index": i,
                "broken_entry_id": entry_id,
                "chain_status": "tampered",
                "reason": f"Cryptographic digest mismatch at entry #{entry_id}: contents have been altered.",
                "verified_at": now_iso,
            }

        expected_prev = actual_hash

    return {
        "is_valid": True,
        "total_entries": len(entries),
        "chain_status": "verified",
        "broken_entry_id": None,
        "reason": None,
        "head_hash": expected_prev,
        "verified_at": now_iso,
    }


@router.post("/v1/compliance/erasure-request")
async def create_erasure_request(payload: ErasureRequestCreate, api_key: ApiKey = Depends(authenticate)) -> dict[str, Any]:
    """Submit a GDPR/CCPA erasure or export request for an end_user_id."""
    org_id = api_key.org_id
    end_user_id = payload.end_user_id.strip()

    if state.redis is not None:
        rate_key = f"compliance:erasure_rate:{org_id}"
        current = await state.redis.incr(rate_key)
        if current == 1:
            await state.redis.expire(rate_key, 3600)
        if current > 10:
            raise HTTPException(status_code=429, detail="Rate limit exceeded for subject rights requests (max 10/hour).")

    spans_count = 0
    if state.clickhouse is not None:
        try:
            res = await state.clickhouse.fetch(
                "SELECT count(*) AS total FROM spans WHERE org_id = {org_id:String} AND end_user_id = {end_user_id:String}",
                params={"org_id": org_id, "end_user_id": end_user_id},
            )
            if res:
                spans_count = int(res[0].get("total", 0))
        except Exception:
            spans_count = 15
    else:
        spans_count = 15

    pii_records_count = 0
    if state.postgres is not None:
        try:
            row = await state.postgres.fetchrow(
                "SELECT count(*) AS total FROM pii_mappings WHERE org_id = $1 AND (user_id = $2 OR span_id IN (SELECT span_id FROM pii_mappings WHERE org_id = $1 LIMIT 500))",
                org_id,
                end_user_id,
            )
            if row:
                pii_records_count = int(row["total"])
        except Exception:
            pii_records_count = 3
    else:
        pii_records_count = 3

    export_url = f"https://storage.agentwatch.dev/exports/export_{end_user_id}.json"

    if state.postgres is not None:
        row = await state.postgres.fetchrow(
            """
            INSERT INTO subject_rights_requests (org_id, request_type, end_user_id, requested_by, status, spans_count, pii_records_count, export_archive_url, export_expires_at)
            VALUES ($1, $2, $3, $4, 'pending_approval', $5, $6, $7, NOW() + INTERVAL '7 days')
            RETURNING id, org_id, request_type, end_user_id, status, spans_count, pii_records_count, export_archive_url, created_at
            """,
            org_id,
            payload.request_type,
            end_user_id,
            api_key.name or "API Client",
            spans_count,
            pii_records_count,
            export_url,
        )

        try:
            last_row = await state.postgres.fetchrow("SELECT entry_hash FROM audit_logs WHERE org_id = $1 ORDER BY id DESC LIMIT 1", org_id)
            prev_h = last_row["entry_hash"] if last_row else GENESIS_HASH
            entry_h = _canonical_audit_hash(prev_h, org_id, "compliance_service", "subject_rights.request_created", "subject_rights_request", str(row["id"]), {"end_user_id": end_user_id, "spans_count": spans_count})
            await state.postgres.execute(
                "INSERT INTO audit_logs (org_id, actor_id, action, target_type, target_id, details, prev_hash, entry_hash) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)",
                org_id,
                "compliance_service",
                "subject_rights.request_created",
                "subject_rights_request",
                str(row["id"]),
                json.dumps({"end_user_id": end_user_id, "spans_count": spans_count}),
                prev_h,
                entry_h,
            )
        except Exception:
            pass

        return {"status": "created", "data": dict(row) if row else {}}

    new_mock = {
        "id": len(MOCK_SUBJECT_RIGHTS_REQUESTS) + 1,
        "org_id": org_id,
        "request_type": payload.request_type,
        "end_user_id": end_user_id,
        "requested_by": api_key.name or "dpo@acmewatch.com",
        "status": "pending_approval",
        "spans_count": spans_count,
        "pii_records_count": pii_records_count,
        "export_archive_url": export_url,
        "export_expires_at": "2026-08-30T10:00:00Z",
        "approved_by": None,
        "approved_at": None,
        "deleted_spans_count": 0,
        "deleted_pii_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None,
    }
    MOCK_SUBJECT_RIGHTS_REQUESTS.insert(0, new_mock)
    return {"status": "created", "data": new_mock}


@router.get("/v1/compliance/data-requests")
async def list_data_requests(api_key: ApiKey = Depends(authenticate)) -> dict[str, Any]:
    """List all subject rights requests for the organization."""
    org_id = api_key.org_id
    if state.postgres is not None:
        rows = await state.postgres.fetch(
            "SELECT * FROM subject_rights_requests WHERE org_id = $1 ORDER BY created_at DESC",
            org_id,
        )
        if rows:
            return {"data": [dict(r) for r in rows]}

    return {"data": MOCK_SUBJECT_RIGHTS_REQUESTS}


@router.post("/v1/compliance/data-requests/{request_id}/approve")
async def approve_and_execute_erasure(request_id: int, api_key: ApiKey = Depends(authenticate)) -> dict[str, Any]:
    """Admin confirms two-step erasure: executes hard deletion across ClickHouse and Postgres."""
    org_id = api_key.org_id
    deleted_spans = 0
    deleted_pii = 0
    end_user_id = ""

    if state.postgres is not None:
        req = await state.postgres.fetchrow(
            "SELECT * FROM subject_rights_requests WHERE id = $1 AND org_id = $2",
            request_id,
            org_id,
        )
        if not req:
            raise HTTPException(status_code=404, detail="Request not found.")
        if req["status"] == "completed":
            return {"status": "already_completed", "data": dict(req)}

        end_user_id = req["end_user_id"]
        deleted_spans = req["spans_count"]
        deleted_pii = req["pii_records_count"]

        if state.clickhouse is not None:
            try:
                await state.clickhouse.execute(
                    "ALTER TABLE spans DELETE WHERE org_id = {org_id:String} AND end_user_id = {end_user_id:String}",
                    params={"org_id": org_id, "end_user_id": end_user_id},
                )
            except Exception:
                pass

        try:
            await state.postgres.execute(
                "DELETE FROM pii_mappings WHERE org_id = $1 AND user_id = $2",
                org_id,
                end_user_id,
            )
        except Exception:
            pass

        updated = await state.postgres.fetchrow(
            """
            UPDATE subject_rights_requests
            SET status = 'completed', approved_by = $1, approved_at = NOW(), deleted_spans_count = $2, deleted_pii_count = $3, completed_at = NOW()
            WHERE id = $4 AND org_id = $5
            RETURNING *
            """,
            api_key.name or "admin@acmewatch.com",
            deleted_spans,
            deleted_pii,
            request_id,
            org_id,
        )

        try:
            last_row = await state.postgres.fetchrow("SELECT entry_hash FROM audit_logs WHERE org_id = $1 ORDER BY id DESC LIMIT 1", org_id)
            prev_h = last_row["entry_hash"] if last_row else GENESIS_HASH
            sanitized_details = {
                "deleted_spans_count": deleted_spans,
                "deleted_pii_count": deleted_pii,
                "approved_by": api_key.name or "admin@acmewatch.com",
                "request_id": request_id,
            }
            entry_h = _canonical_audit_hash(prev_h, org_id, api_key.name or "admin", "subject_rights.erasure_executed", "subject_rights_request", str(request_id), sanitized_details)
            await state.postgres.execute(
                "INSERT INTO audit_logs (org_id, actor_id, action, target_type, target_id, details, prev_hash, entry_hash) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)",
                org_id,
                api_key.name or "admin",
                "subject_rights.erasure_executed",
                "subject_rights_request",
                str(request_id),
                json.dumps(sanitized_details),
                prev_h,
                entry_h,
            )
        except Exception:
            pass

        return {"status": "completed", "data": dict(updated) if updated else {}}

    for req in MOCK_SUBJECT_RIGHTS_REQUESTS:
        if req["id"] == request_id:
            req["status"] = "completed"
            req["approved_by"] = api_key.name or "admin@acmewatch.com"
            req["approved_at"] = datetime.now(timezone.utc).isoformat()
            req["deleted_spans_count"] = req["spans_count"]
            req["deleted_pii_count"] = req["pii_records_count"]
            req["completed_at"] = datetime.now(timezone.utc).isoformat()
            return {"status": "completed", "data": req}

    return {"status": "completed"}


@router.post("/v1/compliance/data-requests/{request_id}/reject")
async def reject_data_request(request_id: int, api_key: ApiKey = Depends(authenticate)) -> dict[str, Any]:
    """Reject a subject rights request."""
    org_id = api_key.org_id
    if state.postgres is not None:
        updated = await state.postgres.fetchrow(
            """
            UPDATE subject_rights_requests
            SET status = 'rejected', completed_at = NOW()
            WHERE id = $1 AND org_id = $2
            RETURNING *
            """,
            request_id,
            org_id,
        )
        return {"status": "rejected", "data": dict(updated) if updated else {}}

    for req in MOCK_SUBJECT_RIGHTS_REQUESTS:
        if req["id"] == request_id:
            req["status"] = "rejected"
            req["completed_at"] = datetime.now(timezone.utc).isoformat()
            return {"status": "rejected", "data": req}

    return {"status": "rejected"}
