"""Policy templates, tool permissions, and output compliance guardrails router."""

import json
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.dependencies import ApiKey, authenticate, state

router = APIRouter(tags=["policies"])


class ToolPolicyRequest(BaseModel):
    agent_id: str = Field(min_length=1, max_length=255)
    blocked_tool_names: list[str] = Field(default_factory=list)


class PolicyTemplateCreate(BaseModel):
    industry: str
    name: str
    description: str | None = None
    rules: list[dict[str, Any]] = Field(default_factory=list)
    is_active: bool = True


class PolicyScanRequest(BaseModel):
    text: str
    industry: str | None = None


DEFAULT_TEMPLATES = [
    {
        "id": 1,
        "org_id": "development",
        "industry": "banking",
        "name": "Banking & Financial Services Compliance",
        "description": "Enforces mandatory interest rate quote disclaimers and blocks definitive investment advice or guaranteed return claims.",
        "is_active": True,
        "rules": [
            {
                "id": "bnk_01",
                "name": "banking_interest_rate_disclaimer",
                "pattern_type": "disclaimer_required",
                "trigger_pattern": r"\b\d+(?:\.\d+)?%\s*(?:APR|interest|p\.a\.|annual|per annum)\b",
                "required_disclaimer": r"(subject to (terms|status|approval)|indicative only|terms and conditions apply|variable rate|rates may vary)",
                "action": "block",
                "message": "Regulatory violation: Interest rate quotes must include an explicit disclaimer (e.g. 'subject to terms and conditions').",
            },
            {
                "id": "bnk_02",
                "name": "banking_no_definitive_investment_advice",
                "pattern_type": "regex",
                "pattern": r"\b(guaranteed\s+returns?|you\s+(must|should definitely)\s+(buy|invest in|short|sell)\b|risk-free\s+profit|100%\s+safe\s+investment)\b",
                "action": "block",
                "message": "Regulatory violation: AI agents are strictly prohibited from giving definitive investment advice or guaranteed return claims.",
            },
        ],
    },
    {
        "id": 2,
        "org_id": "development",
        "industry": "healthcare",
        "name": "Healthcare & Clinical Safety Guard",
        "description": "Prohibits definitive diagnostic conclusions and requires doctor consultation disclaimers on symptom responses.",
        "is_active": True,
        "rules": [
            {
                "id": "med_01",
                "name": "healthcare_no_definitive_diagnosis",
                "pattern_type": "regex",
                "pattern": r"\b(you\s+(definitely\s+have|are\s+diagnosed\s+with)|this\s+is\s+a\s+confirmed\s+case\s+of|you\s+suffer\s+from\s+[a-z\s]+disease)\b",
                "action": "block",
                "message": "Medical compliance violation: AI cannot provide definitive medical diagnoses.",
            },
            {
                "id": "med_02",
                "name": "healthcare_symptom_disclaimer_required",
                "pattern_type": "disclaimer_required",
                "trigger_pattern": r"\b(symptoms?|pain|fever|infection|treatment|dosage|medication|swelling|headache|rash)\b",
                "required_disclaimer": r"(consult\s+(a\s+)?(doctor|physician|healthcare\s+professional|medical\s+expert)|seek\s+medical\s+advice)",
                "action": "flag",
                "message": "Medical compliance advisory: Symptom-related responses must include a doctor consultation disclaimer.",
            },
        ],
    },
]


@router.get("/v1/policies/tools")
async def get_tool_policies(agent_id: str | None = None, api_key: ApiKey = Depends(authenticate)) -> dict[str, Any]:
    """Return blocked tool names for the given agent and organization."""
    blocked: set[str] = set()
    if state.postgres is not None:
        rows = await state.postgres.fetch(
            "SELECT blocked_tool_names FROM policy_rules WHERE org_id = $1 AND (agent_id = $2 OR agent_id = '*')",
            api_key.org_id,
            agent_id or "*",
        )
        for row in rows:
            if row["blocked_tool_names"]:
                blocked.update(row["blocked_tool_names"])
    return {
        "org_id": api_key.org_id,
        "agent_id": agent_id or "*",
        "blocked_tool_names": sorted(list(blocked)),
    }


@router.post("/v1/policies/tools")
async def set_tool_policy(req: ToolPolicyRequest, api_key: ApiKey = Depends(authenticate)) -> dict[str, Any]:
    """Upsert blocked tools policy rule for an agent."""
    if state.postgres is not None:
        await state.postgres.execute(
            """
            INSERT INTO policy_rules (org_id, agent_id, blocked_tool_names, updated_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (org_id, agent_id)
            DO UPDATE SET blocked_tool_names = EXCLUDED.blocked_tool_names, updated_at = NOW()
            """,
            api_key.org_id,
            req.agent_id,
            req.blocked_tool_names,
        )
        await state.postgres.execute(
            "INSERT INTO audit_log (org_id, api_key_hash, action, span_id, details) VALUES ($1, $2, 'policy_updated', NULL, $3::jsonb)",
            api_key.org_id,
            api_key.key_hash,
            json.dumps({"agent_id": req.agent_id, "blocked_tool_names": req.blocked_tool_names}),
        )
    return {"status": "ok", "org_id": api_key.org_id, "agent_id": req.agent_id, "blocked_tool_names": req.blocked_tool_names}


@router.get("/v1/policies/templates")
async def list_policy_templates(api_key: ApiKey = Depends(authenticate)) -> dict[str, Any]:
    """List available and active industry policy templates."""
    if state.postgres is not None:
        rows = await state.postgres.fetch(
            "SELECT id, org_id, industry, name, description, rules, is_active, created_at, updated_at FROM policy_templates WHERE org_id = $1 ORDER BY created_at ASC",
            api_key.org_id,
        )
        if rows:
            return {"data": [dict(r) for r in rows]}

    return {"data": DEFAULT_TEMPLATES}


@router.post("/v1/policies/templates")
async def create_policy_template(payload: PolicyTemplateCreate, api_key: ApiKey = Depends(authenticate)) -> dict[str, Any]:
    """Create or update a policy template."""
    if state.postgres is not None:
        row = await state.postgres.fetchrow(
            """
            INSERT INTO policy_templates (org_id, industry, name, description, rules, is_active)
            VALUES ($1, $2, $3, $4, $5::jsonb, $6)
            RETURNING id, org_id, industry, name, description, rules, is_active
            """,
            api_key.org_id,
            payload.industry,
            payload.name,
            payload.description,
            json.dumps(payload.rules),
            payload.is_active,
        )
        return {"status": "created", "data": dict(row) if row else {}}
    return {"status": "created", "id": 99}


@router.post("/v1/policies/templates/{template_id}/toggle")
async def toggle_policy_template(template_id: int, api_key: ApiKey = Depends(authenticate)) -> dict[str, Any]:
    """Toggle a policy template active/inactive."""
    if state.postgres is not None:
        await state.postgres.execute(
            "UPDATE policy_templates SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 AND org_id = $2",
            template_id,
            api_key.org_id,
        )
    return {"status": "toggled"}


@router.get("/v1/policies/violations")
async def list_policy_violations(limit: int = 50, api_key: ApiKey = Depends(authenticate)) -> dict[str, Any]:
    """List historical output policy violations."""
    if state.postgres is not None:
        rows = await state.postgres.fetch(
            "SELECT id, org_id, agent_id, trace_id, span_id, rule_name, action_taken, matched_text, message, output_snippet, detected_at FROM output_policy_violations WHERE org_id = $1 ORDER BY detected_at DESC LIMIT $2",
            api_key.org_id,
            limit,
        )
        return {"data": [dict(r) for r in rows]}

    return {
        "data": [
            {
                "id": 1,
                "org_id": api_key.org_id,
                "agent_id": "loan_advisor_bot",
                "trace_id": "tr_pol_101a",
                "span_id": "sp_pol_01",
                "rule_name": "banking_interest_rate_disclaimer",
                "action_taken": "blocked",
                "matched_text": "8.5% APR",
                "message": "Interest rate quotes must include an explicit disclaimer.",
                "output_snippet": "We can offer you a personal loan at 8.5% APR immediately.",
                "detected_at": "2026-08-23T09:10:00Z",
            },
            {
                "id": 2,
                "org_id": api_key.org_id,
                "agent_id": "health_assistant",
                "trace_id": "tr_pol_202b",
                "span_id": "sp_pol_02",
                "rule_name": "healthcare_no_definitive_diagnosis",
                "action_taken": "blocked",
                "matched_text": "you definitely have",
                "message": "AI cannot provide definitive medical diagnoses.",
                "output_snippet": "Based on your headache and fever, you definitely have acute sinusitis.",
                "detected_at": "2026-08-23T08:20:00Z",
            },
        ]
    }


@router.post("/v1/policies/scan")
async def scan_policy_endpoint(payload: PolicyScanRequest, api_key: ApiKey = Depends(authenticate)) -> dict[str, Any]:
    """Test policy scanner on demand against active rules."""
    from worker.output_policy import scan_output

    res = scan_output(payload.text)
    return {
        "is_blocked": res.is_blocked,
        "violations": [
            {
                "rule_id": v.rule_id,
                "rule_name": v.rule_name,
                "action": v.action,
                "matched_text": v.matched_text,
                "message": v.message,
            }
            for v in res.violations
        ],
    }
