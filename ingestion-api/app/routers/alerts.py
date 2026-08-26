"""Alert rules and notification webhook management router."""

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.dependencies import ApiKey, authenticate, state

router = APIRouter(tags=["alerts"])


class AlertRuleRequest(BaseModel):
    condition_type: str = Field(pattern="^(error_rate_spike|cost_spike|latency_spike|unauthorized_tool_call)$")
    threshold: float
    webhook_url: str
    window_minutes: int = 15


@router.get("/v1/alerts/rules")
async def list_alert_rules(api_key: ApiKey = Depends(authenticate)) -> list[dict[str, Any]]:
    """List configured alert rules for the active organization."""
    if state.postgres is None:
        return []
    rows = await state.postgres.fetch(
        """
        SELECT id, org_id, condition_type, threshold, webhook_url, window_minutes, is_enabled, last_triggered_at, created_at
        FROM alert_rules
        WHERE org_id = $1
        ORDER BY created_at DESC
        """,
        api_key.org_id,
    )
    return [dict(r) for r in rows]


@router.post("/v1/alerts/rules")
async def create_alert_rule(req: AlertRuleRequest, api_key: ApiKey = Depends(authenticate)) -> dict[str, Any]:
    """Create a new alert rule for Slack webhook notifications on threshold breach."""
    if state.postgres is not None:
        rec = await state.postgres.fetchrow(
            """
            INSERT INTO alert_rules (org_id, condition_type, threshold, webhook_url, window_minutes)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, org_id, condition_type, threshold, webhook_url, window_minutes, is_enabled, created_at
            """,
            api_key.org_id,
            req.condition_type,
            req.threshold,
            req.webhook_url,
            req.window_minutes,
        )
        return dict(rec)
    return {"status": "ok"}


@router.delete("/v1/alerts/rules/{rule_id}")
async def delete_alert_rule(rule_id: int, api_key: ApiKey = Depends(authenticate)) -> dict[str, str]:
    """Delete an alert rule."""
    if state.postgres is not None:
        await state.postgres.execute("DELETE FROM alert_rules WHERE id = $1 AND org_id = $2", rule_id, api_key.org_id)
    return {"status": "deleted"}
