"""Cost-Efficiency, Evaluation Overhead, and Business Outcome Analytics Router."""

import logging
from typing import Any

from fastapi import APIRouter, Depends, Query

from app.dependencies import ApiKey, authenticate, state

logger = logging.getLogger(__name__)

router = APIRouter(tags=["analytics"])


MOCK_AGENT_COST_BREAKDOWNS: list[dict[str, Any]] = [
    {
        "agent_id": "refund_approval_agent",
        "agent_name": "Refund Approval Agent",
        "role": "Financial Transactions",
        "original_llm_cost": 14.20,
        "eval_judge_cost": 8.50,
        "consistency_check_cost": 9.40,
        "total_sessions": 320,
        "successful_outcomes": 298,
    },
    {
        "agent_id": "customer_support_bot",
        "agent_name": "Customer Support Bot",
        "role": "Customer Inquiries",
        "original_llm_cost": 42.80,
        "eval_judge_cost": 6.20,
        "consistency_check_cost": 0.0,
        "total_sessions": 1450,
        "successful_outcomes": 1290,
    },
    {
        "agent_id": "market_researcher",
        "agent_name": "Market Researcher",
        "role": "Knowledge Discovery",
        "original_llm_cost": 28.50,
        "eval_judge_cost": 18.20,
        "consistency_check_cost": 4.10,
        "total_sessions": 210,
        "successful_outcomes": 182,
    },
    {
        "agent_id": "code_reviewer",
        "agent_name": "Code Reviewer Agent",
        "role": "Static Analysis & PRs",
        "original_llm_cost": 19.40,
        "eval_judge_cost": 3.10,
        "consistency_check_cost": 0.0,
        "total_sessions": 480,
        "successful_outcomes": 445,
    },
    {
        "agent_id": "diagnosis_assistant",
        "agent_name": "Medical Triage Assistant",
        "role": "Clinical Symptom Check",
        "original_llm_cost": 11.30,
        "eval_judge_cost": 9.80,
        "consistency_check_cost": 7.60,
        "total_sessions": 180,
        "successful_outcomes": 165,
    },
    {
        "agent_id": "sql_analyst",
        "agent_name": "SQL Data Analyst",
        "role": "Query Generator",
        "original_llm_cost": 16.50,
        "eval_judge_cost": 2.20,
        "consistency_check_cost": 0.0,
        "total_sessions": 390,
        "successful_outcomes": 320,
    },
]


def _build_agent_breakdown(
    agent_raw: dict[str, Any],
    threshold_pct: float,
) -> dict[str, Any]:
    llm_cost = float(agent_raw.get("original_llm_cost", 0.0))
    eval_cost = float(agent_raw.get("eval_judge_cost", 0.0))
    consistency_cost = float(agent_raw.get("consistency_check_cost", 0.0))
    total_cost = round(llm_cost + eval_cost + consistency_cost, 4)

    overhead_cost = eval_cost + consistency_cost
    overhead_pct = round((overhead_cost / max(0.0001, total_cost)) * 100, 1)
    is_tuning_candidate = overhead_pct > threshold_pct

    sessions = int(agent_raw.get("total_sessions", 0))
    successful = int(agent_raw.get("successful_outcomes", 0))
    success_rate = round((successful / max(1, sessions)) * 100, 1)
    cost_per_success = round(total_cost / max(1, successful), 4)

    recommendation = None
    if is_tuning_candidate:
        if consistency_cost > eval_cost:
            recommendation = (
                f"Eval & consistency overhead is {overhead_pct}% (exceeds {threshold_pct}% threshold). "
                f"Consistency checks account for ${consistency_cost:.2f}. Consider reserving consistency mode "
                f"only for critical escalation turns or reducing temperature sample count."
            )
        else:
            recommendation = (
                f"Eval & judge overhead is {overhead_pct}% (exceeds {threshold_pct}% threshold). "
                f"Judge calls account for ${eval_cost:.2f}. Consider reducing eval sampling rate "
                f"from 100% to a lower rate (e.g. 10-20%) on low-risk paths."
            )

    return {
        "agent_id": agent_raw["agent_id"],
        "agent_name": agent_raw.get("agent_name", agent_raw["agent_id"]),
        "role": agent_raw.get("role", "General Agent"),
        "original_llm_cost": round(llm_cost, 4),
        "eval_judge_cost": round(eval_cost, 4),
        "consistency_check_cost": round(consistency_cost, 4),
        "total_cost": total_cost,
        "eval_overhead_cost": round(overhead_cost, 4),
        "eval_overhead_pct": overhead_pct,
        "is_tuning_candidate": is_tuning_candidate,
        "tuning_recommendation": recommendation,
        "total_sessions": sessions,
        "successful_outcomes": successful,
        "success_rate_pct": success_rate,
        "cost_per_successful_outcome": cost_per_success,
    }


@router.get("/v1/analytics/cost-breakdown")
async def get_cost_breakdown(
    time_window: str = Query("24h", pattern="^(24h|7d|30d)$"),
    overhead_threshold_pct: float = Query(40.0, ge=0.0, le=100.0),
    agent_id: str | None = None,
    api_key: ApiKey = Depends(authenticate),
) -> dict[str, Any]:
    """Retrieve per-agent cost breakdown distinguishing base LLM cost, eval overhead,

    and consistency-check multiplier costs, along with cost-per-successful-outcome metrics.
    """
    agents_data: list[dict[str, Any]] = []

    # Attempt ClickHouse + Postgres live aggregation if database backends are configured
    if state.clickhouse is not None:
        try:
            window_clause = {
                "24h": "INTERVAL 24 HOUR",
                "7d": "INTERVAL 7 DAY",
                "30d": "INTERVAL 30 DAY",
            }.get(time_window, "INTERVAL 24 HOUR")

            # 1. Base agent costs and consistency checks from Clickhouse spans
            span_query = f"""
                SELECT
                    agent_id,
                    sum(ifNull(cost_usd, 0)) AS total_span_cost,
                    sum(if(JSONExtractBool(metadata, 'consistency_check') = 1, ifNull(cost_usd, 0), 0)) AS consistency_span_cost,
                    count(distinct session_id) AS sessions_count,
                    count(distinct if(
                        JSONExtractBool(metadata, 'ticket_resolved') = 1
                        OR JSONExtractBool(metadata, 'goal_achieved') = 1
                        OR JSONExtractBool(metadata, 'outcome_success') = 1
                        OR status = 'success',
                        session_id,
                        NULL
                    )) AS success_sessions_count
                FROM spans
                WHERE org_id = {{org_id:String}}
                  AND started_at >= now() - {window_clause}
                GROUP BY agent_id
            """
            span_rows = state.clickhouse.query(span_query, parameters={"org_id": api_key.org_id}).result_rows

            # 2. Judge evaluation costs from Postgres scores table if available
            eval_cost_map: dict[str, float] = {}
            if state.postgres is not None:
                try:
                    score_rows = await state.postgres.fetch(
                        """
                        SELECT COALESCE(s.agent_id, 'orchestrator_agent') as agent_id, SUM(sc.cost_usd_eval) as eval_cost
                        FROM scores sc
                        LEFT JOIN (
                            -- fallback grouping
                            SELECT 'orchestrator_agent' as agent_id
                        ) s ON TRUE
                        WHERE sc.org_id = $1
                        GROUP BY s.agent_id
                        """,
                        api_key.org_id,
                    )
                    for sr in score_rows:
                        eval_cost_map[sr["agent_id"]] = float(sr["eval_cost"] or 0.0)
                except Exception:
                    pass

            if span_rows:
                for r in span_rows:
                    aid = str(r[0])
                    if agent_id and aid != agent_id:
                        continue
                    total_span_cost = float(r[1])
                    consistency_span_cost = float(r[2])
                    # Consistency overhead is approximately (N-1)/N of total consistency span cost
                    consistency_cost = consistency_span_cost * 0.66 if consistency_span_cost > 0 else 0.0
                    original_llm = max(0.0, total_span_cost - consistency_cost)
                    eval_judge = eval_cost_map.get(aid, 0.0)

                    agents_data.append(_build_agent_breakdown({
                        "agent_id": aid,
                        "agent_name": aid.replace("_", " ").title(),
                        "role": "Agent Service",
                        "original_llm_cost": original_llm,
                        "eval_judge_cost": eval_judge,
                        "consistency_check_cost": consistency_cost,
                        "total_sessions": int(r[3]),
                        "successful_outcomes": int(r[4]),
                    }, overhead_threshold_pct))

        except Exception as exc:
            logger.warning("Failed querying Clickhouse cost breakdown: %s", exc)

    if not agents_data:
        raw_list = MOCK_AGENT_COST_BREAKDOWNS
        if agent_id:
            raw_list = [a for a in raw_list if a["agent_id"] == agent_id]
        agents_data = [_build_agent_breakdown(a, overhead_threshold_pct) for a in raw_list]

    # Calculate Organization Aggregate Metrics
    total_cost = round(sum(a["total_cost"] for a in agents_data), 4)
    total_llm = round(sum(a["original_llm_cost"] for a in agents_data), 4)
    total_eval = round(sum(a["eval_judge_cost"] for a in agents_data), 4)
    total_consistency = round(sum(a["consistency_check_cost"] for a in agents_data), 4)
    total_overhead = round(total_eval + total_consistency, 4)
    avg_overhead_pct = round((total_overhead / max(0.0001, total_cost)) * 100, 1)

    total_sessions = sum(a["total_sessions"] for a in agents_data)
    total_successful = sum(a["successful_outcomes"] for a in agents_data)
    org_success_rate = round((total_successful / max(1, total_sessions)) * 100, 1)
    org_cost_per_success = round(total_cost / max(1, total_successful), 4)
    tuning_candidates = [a for a in agents_data if a["is_tuning_candidate"]]

    return {
        "time_window": time_window,
        "overhead_threshold_pct": overhead_threshold_pct,
        "summary": {
            "total_cost": total_cost,
            "total_original_llm_cost": total_llm,
            "total_eval_judge_cost": total_eval,
            "total_consistency_check_cost": total_consistency,
            "total_eval_overhead_cost": total_overhead,
            "avg_eval_overhead_pct": avg_overhead_pct,
            "total_sessions": total_sessions,
            "total_successful_outcomes": total_successful,
            "org_success_rate_pct": org_success_rate,
            "org_cost_per_successful_outcome": org_cost_per_success,
            "tuning_candidates_count": len(tuning_candidates),
        },
        "agents": agents_data,
        "tuning_candidates": tuning_candidates,
    }
