"""Billing, subscription management, and Razorpay webhook router."""

import json
import os
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.billing import PLANS, create_subscription, verify_razorpay_signature
from app.dependencies import SPAN_BACKEND, ApiKey, authenticate, state

router = APIRouter(tags=["billing"])


class SubscribeRequest(BaseModel):
    plan: str = Field(pattern="^(pro|team)$")
    customer_email: str | None = None
    customer_name: str | None = None


@router.post("/v1/billing/subscribe")
async def subscribe_plan(req: SubscribeRequest, api_key: ApiKey = Depends(authenticate)) -> dict[str, Any]:
    """Create a Razorpay recurring subscription for the authenticated organization."""
    sub_data = await create_subscription(req.plan, api_key.org_id, req.customer_email, req.customer_name)
    if state.postgres is not None:
        await state.postgres.execute(
            """
            UPDATE orgs
            SET razorpay_subscription_id = $1, subscription_status = 'created'
            WHERE id::text = $2 OR clerk_org_id = $2
            """,
            sub_data["subscription_id"],
            api_key.org_id,
        )
        await state.postgres.execute(
            """
            INSERT INTO audit_log (org_id, api_key_hash, action, span_id, details)
            VALUES ($1, $2, 'subscription_created', NULL, $3::jsonb)
            """,
            api_key.org_id,
            api_key.key_hash,
            json.dumps({"plan": req.plan, "subscription_id": sub_data["subscription_id"]}),
        )
    return sub_data


@router.post("/v1/billing/webhooks/razorpay")
async def razorpay_webhook(request: Request) -> dict[str, str]:
    """Process incoming Razorpay webhook events to activate or cancel plan tiers."""
    body_bytes = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")
    if secret and not verify_razorpay_signature(body_bytes, signature, secret):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Razorpay signature")

    try:
        payload = json.loads(body_bytes.decode())
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON payload")

    event = payload.get("event")
    sub_entity = payload.get("payload", {}).get("subscription", {}).get("entity", {})
    sub_id = sub_entity.get("id")
    notes = sub_entity.get("notes", {})
    plan_tier = notes.get("tier", "pro")

    if event in ("subscription.charged", "subscription.activated"):
        plan_config = PLANS.get(plan_tier, PLANS["pro"])
        period_end = None
        if sub_entity.get("current_end"):
            period_end = datetime.fromtimestamp(sub_entity["current_end"], timezone.utc)

        if state.postgres is not None:
            await state.postgres.execute(
                """
                UPDATE orgs
                SET plan_tier = $1,
                    subscription_status = 'active',
                    retention_days = $2,
                    monthly_spans_limit = $3,
                    current_period_end = $4
                WHERE razorpay_subscription_id = $5 OR id::text = $6 OR clerk_org_id = $6
                """,
                plan_tier,
                plan_config["retention_days"],
                plan_config["spans_limit"],
                period_end,
                sub_id,
                notes.get("org_id", ""),
            )
            await state.postgres.execute(
                """
                INSERT INTO audit_log (org_id, api_key_hash, action, span_id, details)
                VALUES ($1, 'razorpay_webhook', 'subscription_charged', NULL, $2::jsonb)
                """,
                notes.get("org_id", "unknown"),
                json.dumps({"event": event, "sub_id": sub_id, "plan_tier": plan_tier}),
            )
    elif event in ("subscription.cancelled", "subscription.halted"):
        if state.postgres is not None:
            await state.postgres.execute(
                """
                UPDATE orgs
                SET plan_tier = 'free',
                    subscription_status = 'cancelled',
                    retention_days = 7,
                    monthly_spans_limit = 50000
                WHERE razorpay_subscription_id = $1 OR id::text = $2 OR clerk_org_id = $2
                """,
                sub_id,
                notes.get("org_id", ""),
            )
            await state.postgres.execute(
                """
                INSERT INTO audit_log (org_id, api_key_hash, action, span_id, details)
                VALUES ($1, 'razorpay_webhook', 'subscription_cancelled', NULL, $2::jsonb)
                """,
                notes.get("org_id", "unknown"),
                json.dumps({"event": event, "sub_id": sub_id}),
            )
    return {"status": "ok"}


@router.get("/v1/billing/usage")
async def get_billing_usage(api_key: ApiKey = Depends(authenticate)) -> dict[str, Any]:
    """Query current plan tier, monthly usage metering, and feature gates."""
    plan_tier = "free"
    subscription_status = "none"
    retention_days = 7
    spans_limit = 50_000
    period_end = None

    if state.postgres is not None:
        row = await state.postgres.fetchrow(
            """
            SELECT plan_tier, subscription_status, retention_days, monthly_spans_limit, current_period_end
            FROM orgs
            WHERE id::text = $1 OR clerk_org_id = $1
            """,
            api_key.org_id,
        )
        if row:
            plan_tier = row["plan_tier"] or "free"
            subscription_status = row["subscription_status"] or "none"
            retention_days = row["retention_days"] or 7
            spans_limit = row["monthly_spans_limit"] or 50_000
            period_end = row["current_period_end"].isoformat() if row["current_period_end"] else None

    # Count spans ingested in current month
    spans_used = 0
    if SPAN_BACKEND == "memory":
        spans_used = len([s for s in state.memory_spans if s.get("org_id") == api_key.org_id])
    else:
        try:
            import clickhouse_connect
            ch = clickhouse_connect.get_client(
                host=os.getenv("CLICKHOUSE_HOST", "localhost"),
                username=os.getenv("CLICKHOUSE_USER", "agentwatch"),
                password=os.getenv("CLICKHOUSE_PASSWORD", "agentwatch"),
                database="agentwatch",
            )
            result = ch.query(f"SELECT count() FROM spans WHERE org_id = '{api_key.org_id}' AND started_at >= toStartOfMonth(now())")
            spans_used = result.result_rows[0][0] if result.result_rows else 0
        except Exception:
            spans_used = 0

    plan_info = PLANS.get(plan_tier, PLANS["free"])
    return {
        "org_id": api_key.org_id,
        "plan_tier": plan_tier,
        "plan_name": plan_info["name"],
        "price_inr": plan_info["price_inr"],
        "subscription_status": subscription_status,
        "current_period_end": period_end,
        "spans_used": spans_used,
        "spans_limit": spans_limit,
        "usage_percentage": round((spans_used / spans_limit) * 100, 2) if spans_limit > 0 else 0,
        "retention_days": retention_days,
        "seats_limit": plan_info["seats"],
        "alert_rules_enabled": plan_info["alert_rules"],
        "unmasking_enabled": plan_info["custom_unmask"],
        "plans": list(PLANS.values()),
    }
