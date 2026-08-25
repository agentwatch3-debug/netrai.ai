"""Razorpay subscription billing, webhook processing, and plan metering."""

import hashlib
import hmac
import os
import secrets
from typing import Any

import httpx

PLANS: dict[str, dict[str, Any]] = {
    "free": {
        "tier": "free",
        "name": "Free",
        "price_inr": 0,
        "amount_paise": 0,
        "spans_limit": 50_000,
        "retention_days": 7,
        "seats": 1,
        "alert_rules": False,
        "custom_unmask": False,
        "plan_id": "plan_free",
    },
    "pro": {
        "tier": "pro",
        "name": "Pro",
        "price_inr": 1_999,
        "amount_paise": 199_900,
        "spans_limit": 1_000_000,
        "retention_days": 30,
        "seats": 5,
        "alert_rules": True,
        "custom_unmask": False,
        "plan_id": os.getenv("RAZORPAY_PRO_PLAN_ID", "plan_pro_agentwatch"),
    },
    "team": {
        "tier": "team",
        "name": "Team",
        "price_inr": 9_999,
        "amount_paise": 999_900,
        "spans_limit": 10_000_000,
        "retention_days": 90,
        "seats": 20,
        "alert_rules": True,
        "custom_unmask": True,
        "plan_id": os.getenv("RAZORPAY_TEAM_PLAN_ID", "plan_team_agentwatch"),
    },
}


def verify_razorpay_signature(body_bytes: bytes, signature: str, secret: str) -> bool:
    """Verify HMAC SHA-256 webhook signature from Razorpay."""
    if not secret:
        return True
    expected = hmac.new(secret.encode(), body_bytes, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


async def create_subscription(
    plan_tier: str,
    org_id: str,
    customer_email: str | None = None,
    customer_name: str | None = None,
) -> dict[str, Any]:
    """Create a recurring Razorpay subscription for Pro or Team plans."""
    if plan_tier not in PLANS or plan_tier == "free":
        raise ValueError(f"Invalid subscription plan: {plan_tier}")

    plan_config = PLANS[plan_tier]
    key_id = os.getenv("RAZORPAY_KEY_ID", "rzp_test_agentwatch")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET")

    # If live Razorpay API keys are configured, call the Razorpay Subscriptions API
    if key_secret and key_id != "rzp_test_agentwatch":
        async with httpx.AsyncClient(timeout=10.0) as client:
            payload = {
                "plan_id": plan_config["plan_id"],
                "total_count": 12,  # 12 monthly billing cycles
                "quantity": 1,
                "customer_notify": 1,
                "notes": {"org_id": org_id, "tier": plan_tier},
            }
            resp = await client.post(
                "https://api.razorpay.com/v1/subscriptions",
                json=payload,
                auth=(key_id, key_secret),
            )
            if resp.status_code in (200, 201):
                data = resp.json()
                return {
                    "subscription_id": data["id"],
                    "short_url": data.get("short_url"),
                    "key_id": key_id,
                    "plan": plan_tier,
                    "amount": plan_config["amount_paise"],
                    "currency": "INR",
                    "name": f"AgentWatch {plan_config['name']} Plan",
                }

    # Development / Sandbox / Test Mode fallback
    sub_id = f"sub_test_{secrets.token_hex(8)}"
    return {
        "subscription_id": sub_id,
        "short_url": f"https://rzp.io/i/{sub_id}",
        "key_id": key_id,
        "plan": plan_tier,
        "amount": plan_config["amount_paise"],
        "currency": "INR",
        "name": f"AgentWatch {plan_config['name']} Plan",
    }
