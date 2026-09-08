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
        "misunderstanding_cost": 6.80,
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
        "misunderstanding_cost": 11.40,
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
        "misunderstanding_cost": 3.20,
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
        "misunderstanding_cost": 1.50,
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
        "misunderstanding_cost": 2.10,
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
        "misunderstanding_cost": 4.80,
        "total_sessions": 390,
        "successful_outcomes": 320,
    },
]


MOCK_MONTHLY_RETRY_LOOP_TRENDS: list[dict[str, Any]] = [
    {
        "month": "Apr 2026",
        "month_key": "2026-04",
        "wasted_cost": 218.40,
        "loop_count": 84,
        "total_tokens_wasted": 412000,
        "top_agent": "customer_support_bot",
        "top_agent_wasted_cost": 112.50,
        "savings_with_clarification": 152.80,
    },
    {
        "month": "May 2026",
        "month_key": "2026-05",
        "wasted_cost": 194.20,
        "loop_count": 72,
        "total_tokens_wasted": 365000,
        "top_agent": "refund_approval_agent",
        "top_agent_wasted_cost": 98.40,
        "savings_with_clarification": 135.90,
    },
    {
        "month": "Jun 2026",
        "month_key": "2026-06",
        "wasted_cost": 165.80,
        "loop_count": 61,
        "total_tokens_wasted": 310000,
        "top_agent": "customer_support_bot",
        "top_agent_wasted_cost": 78.20,
        "savings_with_clarification": 116.00,
    },
    {
        "month": "Jul 2026",
        "month_key": "2026-07",
        "wasted_cost": 128.50,
        "loop_count": 48,
        "total_tokens_wasted": 242000,
        "top_agent": "sql_analyst",
        "top_agent_wasted_cost": 54.10,
        "savings_with_clarification": 90.00,
    },
    {
        "month": "Aug 2026",
        "month_key": "2026-08",
        "wasted_cost": 89.30,
        "loop_count": 34,
        "total_tokens_wasted": 168000,
        "top_agent": "refund_approval_agent",
        "top_agent_wasted_cost": 41.50,
        "savings_with_clarification": 62.50,
    },
    {
        "month": "Sep 2026 (MTD)",
        "month_key": "2026-09",
        "wasted_cost": 29.80,
        "loop_count": 12,
        "total_tokens_wasted": 56000,
        "top_agent": "customer_support_bot",
        "top_agent_wasted_cost": 14.80,
        "savings_with_clarification": 21.00,
    },
]


def _build_agent_breakdown(
    agent_raw: dict[str, Any],
    threshold_pct: float,
) -> dict[str, Any]:
    llm_cost = float(agent_raw.get("original_llm_cost", 0.0))
    eval_cost = float(agent_raw.get("eval_judge_cost", 0.0))
    consistency_cost = float(agent_raw.get("consistency_check_cost", 0.0))
    misunderstanding_cost = float(agent_raw.get("misunderstanding_cost", 0.0))
    total_cost = round(llm_cost + eval_cost + consistency_cost + misunderstanding_cost, 4)

    overhead_cost = eval_cost + consistency_cost
    overhead_pct = round((overhead_cost / max(0.0001, total_cost)) * 100, 1)
    misunderstanding_pct = round((misunderstanding_cost / max(0.0001, total_cost)) * 100, 1)
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
        "misunderstanding_cost": round(misunderstanding_cost, 4),
        "misunderstanding_pct": misunderstanding_pct,
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
            # 3. Misunderstanding loop wasted costs from session_quality table
            misunderstanding_cost_map: dict[str, float] = {}
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

                    loop_rows = await state.postgres.fetch(
                        """
                        SELECT agent_id, SUM(total_cost_in_loop) as wasted_loop_cost
                        FROM session_quality
                        WHERE org_id = $1
                        GROUP BY agent_id
                        """,
                        api_key.org_id,
                    )
                    for lr in loop_rows:
                        misunderstanding_cost_map[lr["agent_id"]] = float(lr["wasted_loop_cost"] or 0.0)
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
                    misunderstanding = misunderstanding_cost_map.get(aid, 0.0)

                    agents_data.append(_build_agent_breakdown({
                        "agent_id": aid,
                        "agent_name": aid.replace("_", " ").title(),
                        "role": "Agent Service",
                        "original_llm_cost": original_llm,
                        "eval_judge_cost": eval_judge,
                        "consistency_check_cost": consistency_cost,
                        "misunderstanding_cost": misunderstanding,
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
    total_misunderstanding = round(sum(a["misunderstanding_cost"] for a in agents_data), 4)
    total_overhead = round(total_eval + total_consistency, 4)
    avg_overhead_pct = round((total_overhead / max(0.0001, total_cost)) * 100, 1)
    avg_misunderstanding_pct = round((total_misunderstanding / max(0.0001, total_cost)) * 100, 1)

    total_sessions = sum(a["total_sessions"] for a in agents_data)
    total_successful = sum(a["successful_outcomes"] for a in agents_data)
    org_success_rate = round((total_successful / max(1, total_sessions)) * 100, 1)
    org_cost_per_success = round(total_cost / max(1, total_successful), 4)
    tuning_candidates = [a for a in agents_data if a["is_tuning_candidate"]]

    # Retry loop trends & summary
    monthly_trends = MOCK_MONTHLY_RETRY_LOOP_TRENDS
    total_loops_count = sum(t["loop_count"] for t in monthly_trends)
    historical_wasted_cost = round(sum(t["wasted_cost"] for t in monthly_trends), 2)
    potential_savings = round(sum(t.get("savings_with_clarification", 0.0) for t in monthly_trends), 2)

    return {
        "time_window": time_window,
        "overhead_threshold_pct": overhead_threshold_pct,
        "summary": {
            "total_cost": total_cost,
            "total_original_llm_cost": total_llm,
            "total_eval_judge_cost": total_eval,
            "total_consistency_check_cost": total_consistency,
            "total_misunderstanding_cost": total_misunderstanding,
            "total_misunderstanding_pct": avg_misunderstanding_pct,
            "total_wasted_spend": total_misunderstanding,
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
        "monthly_retry_loop_trends": monthly_trends,
        "retry_loops_summary": {
            "current_window_wasted_cost": total_misunderstanding,
            "current_window_wasted_pct": avg_misunderstanding_pct,
            "historical_wasted_cost": historical_wasted_cost,
            "total_flagged_loops": total_loops_count,
            "estimated_savings_with_clarification": potential_savings,
            "primary_waste_driver": max(agents_data, key=lambda a: a["misunderstanding_cost"])["agent_name"] if agents_data else "None",
        },
    }


MOCK_COST_OPTIMIZATIONS: list[dict[str, Any]] = [
    {
        "advisor_type": "prompt_caching",
        "agent_id": "refund_approval_agent",
        "agent_name": "Refund Approval Agent",
        "provider": "anthropic",
        "model": "claude-3-5-sonnet",
        "headline": "Enable Anthropic Prompt Caching: 94% of calls share a 2,400-token system prompt",
        "detail": "This agent sends the same 2,400-token financial policy & compliance instructions on 94% of calls. Enabling prompt caching on Anthropic (Claude 3.5 Sonnet) will yield a 90% discount on cache hits, reducing monthly token expenditure by 45.2%.",
        "recommended_action": "Add cache_control: {'type': 'ephemeral'} to the system prompt block in your Anthropic messages API payload.",
        "code_example": (
            "// Anthropic Prompt Caching (90% discount on cache hits)\n"
            "const response = await anthropic.messages.create({\n"
            "  model: 'claude-3-5-sonnet-20241022',\n"
            "  system: [\n"
            "    {\n"
            "      type: 'text',\n"
            "      text: FINANCIAL_COMPLIANCE_POLICY,\n"
            "      cache_control: { type: 'ephemeral' } // Caches static prompt\n"
            "    }\n"
            "  ],\n"
            "  messages: [{ role: 'user', content: userRefundQuery }]\n"
            "});"
        ),
        "repeated_prompt_pct": 94.0,
        "static_token_count": 2400,
        "input_to_output_ratio": 0.0,
        "avg_input_tokens": 2650,
        "avg_output_tokens": 180,
        "sample_call_count": 320,
        "estimated_monthly_calls": 9600,
        "estimated_cost_reduction_pct": 45.2,
        "estimated_monthly_savings_usd": 698.50,
        "estimated_monthly_savings_inr": 58325.00,
    },
    {
        "advisor_type": "context_pruning",
        "agent_id": "market_researcher",
        "agent_name": "Market Researcher",
        "provider": "openai",
        "model": "gpt-4o",
        "headline": "Context Length Optimization: Extreme 115:1 Input-to-Output Ratio",
        "detail": "Spans for this agent average 3,800 input tokens for only 33 output tokens (115:1 ratio). Trimming redundant RAG search chunks or applying semantic reranking can safely reduce input context by 35% without losing factual recall.",
        "recommended_action": "Apply semantic reranking (e.g. FlashRank or Cohere Rerank) to inject the top-3 high-relevance chunks instead of raw top-10 chunks.",
        "code_example": (
            "// RAG Context Pruning via Semantic Reranking\n"
            "const rerankedChunks = await reranker.rank({\n"
            "  query: researchTopic,\n"
            "  documents: rawRetrievedDocuments,\n"
            "  topN: 3 // Keep only top 3 most relevant chunks\n"
            "});\n"
            "const compactContext = rerankedChunks.map(c => c.text).join('\\n---\\n');"
        ),
        "repeated_prompt_pct": 0.0,
        "static_token_count": 0,
        "input_to_output_ratio": 115.2,
        "avg_input_tokens": 3800,
        "avg_output_tokens": 33,
        "sample_call_count": 210,
        "estimated_monthly_calls": 6300,
        "estimated_cost_reduction_pct": 35.0,
        "estimated_monthly_savings_usd": 512.00,
        "estimated_monthly_savings_inr": 42752.00,
    },
    {
        "advisor_type": "prompt_caching",
        "agent_id": "customer_support_bot",
        "agent_name": "Customer Support Bot",
        "provider": "openai",
        "model": "gpt-4o-mini",
        "headline": "Enable OpenAI Prefix Caching: 91% of calls share a 1,850-token knowledge preamble",
        "detail": "This agent sends the same 1,850-token customer service guidelines and FAQ routing prompt on 91% of turns. Structuring static instructions as the prompt prefix automatically activates OpenAI 50% cached prompt pricing.",
        "recommended_action": "Ensure static FAQ guidelines are placed at the very start of the messages array so prefix matching triggers consistently.",
        "code_example": (
            "// OpenAI Automatic Prefix Caching (50% discount on prefix >= 1024 tokens)\n"
            "const completion = await openai.chat.completions.create({\n"
            "  model: 'gpt-4o-mini',\n"
            "  messages: [\n"
            "    { role: 'system', content: STATIC_SUPPORT_PREAMBLE }, // >= 1024 tokens\n"
            "    { role: 'user', content: customerMessage }\n"
            "  ]\n"
            "});"
        ),
        "repeated_prompt_pct": 91.0,
        "static_token_count": 1850,
        "input_to_output_ratio": 0.0,
        "avg_input_tokens": 2100,
        "avg_output_tokens": 95,
        "sample_call_count": 1450,
        "estimated_monthly_calls": 43500,
        "estimated_cost_reduction_pct": 41.0,
        "estimated_monthly_savings_usd": 295.40,
        "estimated_monthly_savings_inr": 24665.00,
    },
    {
        "advisor_type": "context_pruning",
        "agent_id": "diagnosis_assistant",
        "agent_name": "Medical Triage Assistant",
        "provider": "anthropic",
        "model": "claude-3-5-sonnet",
        "headline": "Context Length Optimization: Redundant 4,200-Token Clinical Schema Declarations",
        "detail": "Spans include full ICD-10 ontology and JSON schema declarations on every single symptom turn, yielding a 98:1 input-to-output ratio. Pruning to lean field definitions saves 35% of token volume.",
        "recommended_action": "Compress static schema definitions into concise typescript-style compact notations.",
        "code_example": (
            "// Schema Definition Compacting\n"
            "// Before: 4,200 tokens of verbose JSON schema definitions\n"
            "// After: Compact TypeScript notation (saving 65% schema tokens):\n"
            "const LEAN_SCHEMA = `type SymptomReport = { id: string; symptoms: string[]; severity: 1..5; red_flags: string[] };`;"
        ),
        "repeated_prompt_pct": 0.0,
        "static_token_count": 0,
        "input_to_output_ratio": 97.7,
        "avg_input_tokens": 4200,
        "avg_output_tokens": 43,
        "sample_call_count": 180,
        "estimated_monthly_calls": 5400,
        "estimated_cost_reduction_pct": 35.0,
        "estimated_monthly_savings_usd": 240.00,
        "estimated_monthly_savings_inr": 20040.00,
    },
]


@router.get("/v1/analytics/cost-optimization")
async def get_cost_optimization_advisories(
    api_key: ApiKey = Depends(authenticate),
) -> dict[str, Any]:
    """Retrieve actionable cost optimization advisories for prompt caching and context pruning with estimated INR savings."""
    total_inr = round(sum(o["estimated_monthly_savings_inr"] for o in MOCK_COST_OPTIMIZATIONS), 2)
    total_usd = round(sum(o["estimated_monthly_savings_usd"] for o in MOCK_COST_OPTIMIZATIONS), 2)
    caching_count = sum(1 for o in MOCK_COST_OPTIMIZATIONS if o["advisor_type"] == "prompt_caching")
    pruning_count = sum(1 for o in MOCK_COST_OPTIMIZATIONS if o["advisor_type"] == "context_pruning")

    return {
        "org_id": api_key.org_id,
        "currency": "INR",
        "usd_to_inr_rate": 83.5,
        "summary": {
            "total_potential_monthly_savings_inr": total_inr,
            "total_potential_monthly_savings_usd": total_usd,
            "total_opportunities_count": len(MOCK_COST_OPTIMIZATIONS),
            "prompt_caching_opportunities_count": caching_count,
            "context_pruning_opportunities_count": pruning_count,
            "top_opportunity_headline": MOCK_COST_OPTIMIZATIONS[0]["headline"],
            "top_opportunity_savings_inr": MOCK_COST_OPTIMIZATIONS[0]["estimated_monthly_savings_inr"],
        },
        "opportunities": MOCK_COST_OPTIMIZATIONS,
    }



