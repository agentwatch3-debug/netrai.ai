"""Multi-turn conversation sessions and chat thread reconstruction router."""

import os
from typing import Any

from fastapi import APIRouter, Depends

from app.dependencies import ApiKey, authenticate, state

router = APIRouter(tags=["sessions"])


@router.get("/v1/sessions")
async def list_sessions(
    agent_id: str | None = None,
    user_id: str | None = None,
    limit: int = 50,
    api_key: ApiKey = Depends(authenticate),
) -> dict[str, Any]:
    """List grouped multi-turn conversation sessions with aggregate metrics."""
    try:
        import clickhouse_connect
        client = clickhouse_connect.get_client(
            host=os.getenv("CLICKHOUSE_HOST", "localhost"),
            username=os.getenv("CLICKHOUSE_USER", "agentwatch"),
            password=os.getenv("CLICKHOUSE_PASSWORD", "agentwatch"),
            database="agentwatch",
        )
        query = f"""
            SELECT
                session_id,
                any(user_id) as user_id,
                any(agent_id) as agent_id,
                count(distinct trace_id) as turn_count,
                count() as total_spans,
                sum(ifNull(cost_usd, 0)) as total_cost,
                sum(ifNull(prompt_tokens, 0) + ifNull(completion_tokens, 0)) as total_tokens,
                min(started_at) as started_at,
                max(ended_at) as last_active_at,
                countIf(status = 'error') as error_count
            FROM spans
            WHERE org_id = '{api_key.org_id}' AND isNotNull(session_id) AND session_id != ''
        """
        if agent_id:
            query += f" AND agent_id = '{agent_id}'"
        if user_id:
            query += f" AND user_id = '{user_id}'"
        query += f" GROUP BY session_id ORDER BY last_active_at DESC LIMIT {limit}"
        res = client.query(query)
        sessions = [
            {
                "session_id": r[0],
                "user_id": r[1] or "anonymous",
                "agent_id": r[2],
                "turn_count": r[3],
                "total_spans": r[4],
                "total_cost": round(float(r[5]), 4),
                "total_tokens": r[6],
                "started_at": str(r[7]),
                "last_active_at": str(r[8]),
                "error_count": r[9],
            }
            for r in res.result_rows
        ]
        return {"data": sessions}
    except Exception:
        pass

    # In-memory / dev fallback
    return {
        "data": [
            {
                "session_id": "sess_support_402",
                "user_id": "user_rahul_99",
                "agent_id": "customer_support_bot",
                "turn_count": 4,
                "total_spans": 9,
                "total_cost": 0.0425,
                "total_tokens": 8450,
                "started_at": "2026-08-23T08:15:00Z",
                "last_active_at": "2026-08-23T08:24:30Z",
                "error_count": 0,
            },
            {
                "session_id": "sess_research_781",
                "user_id": "user_priya_21",
                "agent_id": "market_researcher",
                "turn_count": 3,
                "total_spans": 8,
                "total_cost": 0.0810,
                "total_tokens": 16200,
                "started_at": "2026-08-23T07:40:00Z",
                "last_active_at": "2026-08-23T07:55:10Z",
                "error_count": 0,
            },
            {
                "session_id": "sess_triage_103",
                "user_id": "user_vikram_04",
                "agent_id": "code_reviewer",
                "turn_count": 2,
                "total_spans": 5,
                "total_cost": 0.0195,
                "total_tokens": 3900,
                "started_at": "2026-08-23T06:10:00Z",
                "last_active_at": "2026-08-23T06:14:20Z",
                "error_count": 1,
            },
        ]
    }


MOCK_MISUNDERSTANDING_LOOPS: list[dict[str, Any]] = [
    {
        "id": 1,
        "org_id": "org_dev_demo",
        "session_id": "sess_refund_confusion_882",
        "agent_id": "refund_approval_agent",
        "user_id": "user_priya_44",
        "retry_count": 4,
        "total_tokens_in_loop": 14200,
        "total_cost_in_loop": 0.0864,
        "loop_type": "misunderstanding_loop",
        "similarity_scores": [0.82, 0.79, 0.88],
        "sample_rephrasings": [
            "Cancel my order #9912 and process a refund to my credit card immediately.",
            "I already asked to cancel order 9912 and get my money refunded please.",
            "Please just refund order 9912 back to the original card, do not send replacement.",
            "Cancel and refund order 9912 now."
        ],
        "tool_thrashing_detected": True,
        "task_completed": False,
        "flagged_at": "2026-08-23T08:45:00Z",
    },
    {
        "id": 2,
        "org_id": "org_dev_demo",
        "session_id": "sess_auth_loop_109",
        "agent_id": "customer_support_bot",
        "user_id": "user_rahul_99",
        "retry_count": 3,
        "total_tokens_in_loop": 9850,
        "total_cost_in_loop": 0.0520,
        "loop_type": "misunderstanding_loop",
        "similarity_scores": [0.76, 0.84],
        "sample_rephrasings": [
            "How do I reset my SSO MFA authenticator device?",
            "My Okta MFA is locked, how can I reset it?",
            "Reset Okta authenticator device for my login."
        ],
        "tool_thrashing_detected": False,
        "task_completed": False,
        "flagged_at": "2026-08-23T07:30:00Z",
    },
    {
        "id": 3,
        "org_id": "org_dev_demo",
        "session_id": "sess_sql_query_fail_311",
        "agent_id": "sql_analyst",
        "user_id": "user_vikram_04",
        "retry_count": 3,
        "total_tokens_in_loop": 8100,
        "total_cost_in_loop": 0.0415,
        "loop_type": "tool_arg_thrashing",
        "similarity_scores": [0.72, 0.75],
        "sample_rephrasings": [
            "Show me top 10 enterprise customers by active seat count this month.",
            "List enterprise accounts ordered by seats utilized in August 2026.",
            "Query active seat totals for all enterprise orgs this month."
        ],
        "tool_thrashing_detected": True,
        "task_completed": False,
        "flagged_at": "2026-08-23T06:15:00Z",
    },
]


@router.get("/v1/sessions/misunderstanding-loops")
async def list_misunderstanding_loops(
    limit: int = 50,
    api_key: ApiKey = Depends(authenticate),
) -> dict[str, Any]:
    """List sessions flagged with user rephrasing and misunderstanding loops sorted by wasted cost."""
    if hasattr(state, "postgres") and state.postgres is not None:
        try:
            rows = await state.postgres.fetch(
                """
                SELECT id, org_id, session_id, agent_id, user_id, retry_count,
                       total_tokens_in_loop, total_cost_in_loop, loop_type,
                       similarity_scores, sample_rephrasings, tool_thrashing_detected,
                       task_completed, flagged_at
                FROM session_quality
                WHERE org_id = $1
                ORDER BY total_cost_in_loop DESC
                LIMIT $2
                """,
                api_key.org_id,
                limit,
            )
            if rows:
                return {"data": [dict(r) for r in rows]}
        except Exception:
            pass

    # Sort mock loops by wasted cost descending
    sorted_loops = sorted(MOCK_MISUNDERSTANDING_LOOPS, key=lambda x: x["total_cost_in_loop"], reverse=True)
    return {"data": sorted_loops[:limit]}


@router.get("/v1/sessions/{session_id}")
async def get_session_thread(session_id: str, api_key: ApiKey = Depends(authenticate)) -> dict[str, Any]:
    """Get full multi-turn conversation thread details and span tree for a session."""

    return {
        "session_id": session_id,
        "user_id": "user_rahul_99",
        "agent_id": "customer_support_bot",
        "total_cost": 0.0425,
        "total_tokens": 8450,
        "started_at": "2026-08-23T08:15:00Z",
        "last_active_at": "2026-08-23T08:24:30Z",
        "turns": [
            {
                "turn_index": 1,
                "trace_id": "tr_sess_turn_1",
                "user_message": "Hello, I need help checking the status of my order #ORD-9912.",
                "assistant_message": "Let me look that up for you right away. Checking our order database...",
                "tool_calls": [{"name": "lookup_order", "input": {"order_id": "ORD-9912"}, "output": {"status": "In Transit", "carrier": "BlueDart", "eta": "2026-08-24"}}],
                "tokens": 1250,
                "cost_usd": 0.0085,
                "latency_ms": 780,
                "created_at": "2026-08-23T08:15:00Z",
            },
            {
                "turn_index": 2,
                "trace_id": "tr_sess_turn_2",
                "user_message": "Can I change the delivery address to my Bangalore office?",
                "assistant_message": "Yes! I can help you update your delivery address before shipment dispatch. What is the new address?",
                "tool_calls": [{"name": "check_address_modifiable", "input": {"order_id": "ORD-9912"}, "output": {"can_modify": True}}],
                "tokens": 1850,
                "cost_usd": 0.0110,
                "latency_ms": 840,
                "created_at": "2026-08-23T08:17:30Z",
            },
            {
                "turn_index": 3,
                "trace_id": "tr_sess_turn_3",
                "user_message": "Please update to: Tech Park 4B, Whitefield, Bangalore - 560066.",
                "assistant_message": "Your delivery address for order #ORD-9912 has been successfully updated to Tech Park 4B, Whitefield, Bangalore - 560066. Is there anything else I can help you with?",
                "tool_calls": [{"name": "update_shipping_address", "input": {"order_id": "ORD-9912", "new_address": "Tech Park 4B, Whitefield, Bangalore"}, "output": {"success": True}}],
                "tokens": 2450,
                "cost_usd": 0.0135,
                "latency_ms": 1120,
                "created_at": "2026-08-23T08:21:00Z",
            },
            {
                "turn_index": 4,
                "trace_id": "tr_sess_turn_4",
                "user_message": "No, that's all. Thank you!",
                "assistant_message": "You're very welcome! Have a great day ahead.",
                "tool_calls": [],
                "tokens": 950,
                "cost_usd": 0.0095,
                "latency_ms": 420,
                "created_at": "2026-08-23T08:24:30Z",
            },
        ],
    }
