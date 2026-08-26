"""Evaluations, LLM judge scoring, and quality scorecards router."""

import json
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, status

from app.dependencies import ApiKey, authenticate, state
from app.evals import EvalConfigCreate, EvalScoreSubmission

router = APIRouter(tags=["evals"])


@router.post("/v1/evals/scores", status_code=status.HTTP_201_CREATED)
async def submit_eval_score(score: EvalScoreSubmission, api_key: ApiKey = Depends(authenticate)) -> dict[str, Any]:
    """Submit an automated, rule-based, or human evaluation score for a span."""
    trace_id = score.trace_id or ""
    if state.postgres is not None:
        row = await state.postgres.fetchrow(
            """
            INSERT INTO eval_scores (org_id, span_id, trace_id, score_name, score_value, reasoning, evaluator_type, evaluator_model, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
            RETURNING id, org_id, span_id, trace_id, score_name, score_value, reasoning, evaluator_type, evaluator_model, metadata, created_at
            """,
            api_key.org_id,
            score.span_id,
            trace_id,
            score.score_name,
            score.score_value,
            score.reasoning,
            score.evaluator_type,
            score.evaluator_model,
            json.dumps(score.metadata),
        )
        return dict(row)

    # In-memory dev fallback
    score_dict = score.model_dump()
    score_dict["id"] = len(state.memory_eval_scores) + 1
    score_dict["org_id"] = api_key.org_id
    score_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    state.memory_eval_scores.append(score_dict)
    return score_dict


@router.get("/v1/evals/scores")
async def list_eval_scores(
    span_id: str | None = None,
    trace_id: str | None = None,
    score_name: str | None = None,
    api_key: ApiKey = Depends(authenticate),
) -> list[dict[str, Any]]:
    """List evaluation scores filtered by span, trace, or score name."""
    if state.postgres is not None:
        rows = await state.postgres.fetch(
            """
            SELECT id, org_id, span_id, trace_id, score_name, score_value, reasoning, evaluator_type, evaluator_model, COALESCE(metadata::text, '{}') as metadata, created_at
            FROM eval_scores
            WHERE org_id = $1
              AND ($2::text IS NULL OR span_id = $2)
              AND ($3::text IS NULL OR trace_id = $3)
              AND ($4::text IS NULL OR score_name = $4)
            ORDER BY created_at DESC
            LIMIT 100
            """,
            api_key.org_id,
            span_id,
            trace_id,
            score_name,
        )
        return [dict(r) for r in rows]

    # In-memory fallback
    return [
        s for s in state.memory_eval_scores
        if s.get("org_id") == api_key.org_id
        and (not span_id or s.get("span_id") == span_id)
        and (not trace_id or s.get("trace_id") == trace_id)
        and (not score_name or s.get("score_name") == score_name)
    ]


@router.get("/v1/evals/summary")
async def get_evals_summary(api_key: ApiKey = Depends(authenticate)) -> dict[str, Any]:
    """Return aggregated evaluation metrics, pass rate, and score breakdowns."""
    if state.postgres is not None:
        stats = await state.postgres.fetch(
            """
            SELECT
                score_name,
                evaluator_type,
                COUNT(*) as total_count,
                AVG(score_value) as avg_score,
                COUNT(*) FILTER (WHERE score_value >= 0.7) as passed_count
            FROM eval_scores
            WHERE org_id = $1
            GROUP BY score_name, evaluator_type
            """,
            api_key.org_id,
        )
        total_evals = sum(r["total_count"] for r in stats)
        total_passed = sum(r["passed_count"] for r in stats)
        overall_pass_rate = round((total_passed / total_evals * 100), 1) if total_evals > 0 else 100.0

        breakdown = [
            {
                "score_name": r["score_name"],
                "evaluator_type": r["evaluator_type"],
                "total_count": r["total_count"],
                "avg_score": round(float(r["avg_score"] or 0), 2),
                "pass_rate": round((r["passed_count"] / r["total_count"] * 100), 1) if r["total_count"] > 0 else 0,
            }
            for r in stats
        ]
        return {
            "total_evaluations": total_evals,
            "overall_pass_rate": overall_pass_rate,
            "breakdown": breakdown,
        }

    # In-memory dev default
    return {
        "total_evaluations": len(state.memory_eval_scores),
        "overall_pass_rate": 94.2,
        "breakdown": [
            {"score_name": "hallucination", "evaluator_type": "automated", "total_count": 120, "avg_score": 0.96, "pass_rate": 96.0},
            {"score_name": "relevancy", "evaluator_type": "automated", "total_count": 120, "avg_score": 0.92, "pass_rate": 93.5},
            {"score_name": "tool_correctness", "evaluator_type": "rule", "total_count": 85, "avg_score": 0.98, "pass_rate": 98.0},
            {"score_name": "human_rating", "evaluator_type": "human", "total_count": 34, "avg_score": 0.88, "pass_rate": 89.0},
        ],
    }


@router.get("/v1/evals/configs")
async def list_eval_configs(api_key: ApiKey = Depends(authenticate)) -> list[dict[str, Any]]:
    """List configured automated evaluation rules."""
    if state.postgres is not None:
        rows = await state.postgres.fetch(
            """
            SELECT id, org_id, name, eval_type, target_agent_id, model, prompt_template, sampling_rate, is_active, created_at
            FROM eval_configs
            WHERE org_id = $1
            ORDER BY created_at DESC
            """,
            api_key.org_id,
        )
        return [dict(r) for r in rows]

    return state.memory_eval_configs


@router.post("/v1/evals/configs", status_code=status.HTTP_201_CREATED)
async def create_eval_config(cfg: EvalConfigCreate, api_key: ApiKey = Depends(authenticate)) -> dict[str, Any]:
    """Create an automated evaluation configuration."""
    if state.postgres is not None:
        row = await state.postgres.fetchrow(
            """
            INSERT INTO eval_configs (org_id, name, eval_type, target_agent_id, model, prompt_template, sampling_rate, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, org_id, name, eval_type, target_agent_id, model, prompt_template, sampling_rate, is_active, created_at
            """,
            api_key.org_id,
            cfg.name,
            cfg.eval_type,
            cfg.target_agent_id,
            cfg.model,
            cfg.prompt_template,
            cfg.sampling_rate,
            cfg.is_active,
        )
        return dict(row)

    cfg_dict = cfg.model_dump()
    cfg_dict["id"] = len(state.memory_eval_configs) + 1
    cfg_dict["org_id"] = api_key.org_id
    cfg_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    state.memory_eval_configs.append(cfg_dict)
    return cfg_dict


@router.delete("/v1/evals/configs/{config_id}")
async def delete_eval_config(config_id: int, api_key: ApiKey = Depends(authenticate)) -> dict[str, str]:
    """Delete an eval config."""
    if state.postgres is not None:
        await state.postgres.execute("DELETE FROM eval_configs WHERE id = $1 AND org_id = $2", config_id, api_key.org_id)
    return {"status": "deleted"}
