import hashlib
import hmac
import pytest
from app.billing import PLANS, verify_razorpay_signature, create_subscription


def test_plans_configuration():
    assert "free" in PLANS
    assert "pro" in PLANS
    assert "team" in PLANS

    assert PLANS["pro"]["price_inr"] == 1999
    assert PLANS["pro"]["amount_paise"] == 199900
    assert PLANS["pro"]["retention_days"] == 30
    assert PLANS["pro"]["spans_limit"] == 1_000_000

    assert PLANS["team"]["price_inr"] == 9999
    assert PLANS["team"]["amount_paise"] == 999900
    assert PLANS["team"]["retention_days"] == 90
    assert PLANS["team"]["spans_limit"] == 10_000_000


def test_verify_razorpay_signature():
    secret = "test_webhook_secret_123"
    body = b'{"event":"subscription.charged","payload":{}}'
    expected_sig = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()

    assert verify_razorpay_signature(body, expected_sig, secret) is True
    assert verify_razorpay_signature(body, "invalid_sig", secret) is False


@pytest.mark.asyncio
async def test_create_subscription_mock_mode():
    res = await create_subscription("pro", "org_123")
    assert res["plan"] == "pro"
    assert res["amount"] == 199900
    assert res["currency"] == "INR"
    assert res["subscription_id"].startswith("sub_test_")
