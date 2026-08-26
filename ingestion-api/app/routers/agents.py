"""Multi-agent hierarchy topology graph and relationship traces router."""

import logging
from typing import Any

from fastapi import APIRouter, Depends

from app.dependencies import ApiKey, authenticate, state

logger = logging.getLogger(__name__)

router = APIRouter(tags=["agents"])


@router.get("/v1/agents/graph")
async def get_multi_agent_graph(time_window: str = "24h", api_key: ApiKey = Depends(authenticate)) -> dict[str, Any]:
    """Aggregate multi-agent hierarchy graph with directed edges and error metrics."""
    if state.clickhouse is not None:
        try:
            edge_query = """
            SELECT
                parent_agent_id AS source,
                agent_id AS target,
                count(*) AS call_count,
                round(avg(latency_ms), 1) AS avg_latency_ms,
                countIf(status = 'error') AS error_count,
                round(sum(cost_usd), 4) AS total_cost_usd
            FROM spans
            WHERE org_id = {org_id:String}
              AND isNotNull(parent_agent_id)
              AND parent_agent_id != ''
              AND parent_agent_id != agent_id
              AND started_at >= now() - INTERVAL 24 HOUR
            GROUP BY source, target
            """
            edge_rows = state.clickhouse.query(edge_query, parameters={"org_id": api_key.org_id}).result_rows

            node_query = """
            SELECT
                agent_id,
                count(*) AS total_calls,
                round(avg(latency_ms), 1) AS avg_latency_ms,
                countIf(status = 'error') AS error_count,
                round(sum(cost_usd), 4) AS total_cost_usd
            FROM spans
            WHERE org_id = {org_id:String}
              AND started_at >= now() - INTERVAL 24 HOUR
            GROUP BY agent_id
            """
            node_rows = state.clickhouse.query(node_query, parameters={"org_id": api_key.org_id}).result_rows

            if node_rows:
                nodes = []
                for r in node_rows:
                    total_c = r[1]
                    err_c = r[3]
                    err_rate = (err_c / total_c) if total_c > 0 else 0.0
                    nodes.append({
                        "id": r[0],
                        "label": r[0],
                        "total_calls": total_c,
                        "avg_latency_ms": r[2],
                        "error_count": err_c,
                        "error_rate": round(err_rate * 100, 2),
                        "total_cost_usd": r[4],
                        "status_color": "rose" if err_rate > 0.05 else "amber" if err_rate > 0.01 else "emerald",
                    })

                edges = [
                    {
                        "id": f"{e[0]}->{e[1]}",
                        "source": e[0],
                        "target": e[1],
                        "call_count": e[2],
                        "avg_latency_ms": e[3],
                        "error_count": e[4],
                        "stroke_width": min(max(2, e[2] // 10), 8),
                    }
                    for e in edge_rows
                ]
                return {"nodes": nodes, "edges": edges}
        except Exception as e:
            logger.warning("Clickhouse multi-agent graph query failed: %s", e)

    mock_nodes = [
        {"id": "orchestrator_agent", "label": "Orchestrator Agent", "role": "Coordinator", "total_calls": 3420, "avg_latency_ms": 680, "error_count": 8, "error_rate": 0.23, "total_cost_usd": 12.45, "status_color": "emerald"},
        {"id": "research_subagent", "label": "Research Subagent", "role": "Fact Finder", "total_calls": 1820, "avg_latency_ms": 1150, "error_count": 12, "error_rate": 0.65, "total_cost_usd": 8.90, "status_color": "emerald"},
        {"id": "code_reviewer", "label": "Code Reviewer", "role": "Static Analysis", "total_calls": 940, "avg_latency_ms": 920, "error_count": 4, "error_rate": 0.42, "total_cost_usd": 4.15, "status_color": "emerald"},
        {"id": "sql_analyst", "label": "SQL Data Analyst", "role": "Query Generator", "total_calls": 650, "avg_latency_ms": 1420, "error_count": 48, "error_rate": 7.38, "total_cost_usd": 6.80, "status_color": "rose"},
        {"id": "compliance_guard", "label": "Compliance Guard", "role": "Perimeter Auditor", "total_calls": 1240, "avg_latency_ms": 310, "error_count": 1, "error_rate": 0.08, "total_cost_usd": 1.95, "status_color": "emerald"},
    ]

    mock_edges = [
        {"id": "orchestrator->research", "source": "orchestrator_agent", "target": "research_subagent", "call_count": 1820, "avg_latency_ms": 1150, "error_count": 12, "stroke_width": 5},
        {"id": "orchestrator->code_reviewer", "source": "orchestrator_agent", "target": "code_reviewer", "call_count": 940, "avg_latency_ms": 920, "error_count": 4, "stroke_width": 3},
        {"id": "orchestrator->sql_analyst", "source": "orchestrator_agent", "target": "sql_analyst", "call_count": 650, "avg_latency_ms": 1420, "error_count": 48, "stroke_width": 2},
        {"id": "research->compliance_guard", "source": "research_subagent", "target": "compliance_guard", "call_count": 1240, "avg_latency_ms": 310, "error_count": 1, "stroke_width": 4},
    ]

    return {"nodes": mock_nodes, "edges": mock_edges}


@router.get("/v1/agents/relationship-traces")
async def get_relationship_traces(
    source: str,
    target: str,
    limit: int = 20,
    api_key: ApiKey = Depends(authenticate),
) -> dict[str, Any]:
    """Get traces representing calls from source agent to target agent."""
    if state.clickhouse is not None:
        try:
            query = """
            SELECT trace_id, span_id, name, latency_ms, cost_usd, status, error_message, started_at
            FROM spans
            WHERE org_id = {org_id:String}
              AND parent_agent_id = {source:String}
              AND agent_id = {target:String}
            ORDER BY started_at DESC
            LIMIT {limit:UInt32}
            """
            rows = state.clickhouse.query(query, parameters={"org_id": api_key.org_id, "source": source, "target": target, "limit": limit}).result_rows
            return {
                "source": source,
                "target": target,
                "data": [
                    {
                        "trace_id": r[0],
                        "span_id": r[1],
                        "name": r[2],
                        "latency_ms": r[3],
                        "cost_usd": r[4],
                        "status": r[5],
                        "error_message": r[6],
                        "started_at": str(r[7]),
                    }
                    for r in rows
                ],
            }
        except Exception as e:
            logger.warning("Relationship traces query failed: %s", e)

    return {
        "source": source,
        "target": target,
        "data": [
            {
                "trace_id": "tr_mag_01a",
                "span_id": "sp_del_01",
                "name": f"{source} -> {target}",
                "latency_ms": 1120,
                "cost_usd": 0.0084,
                "status": "success",
                "error_message": None,
                "started_at": "2026-08-23T09:20:00Z",
            },
            {
                "trace_id": "tr_mag_02b",
                "span_id": "sp_del_02",
                "name": f"{source} -> {target}",
                "latency_ms": 1340,
                "cost_usd": 0.0112,
                "status": "error" if "sql" in target else "success",
                "error_message": "Postgres connection timeout on analytical replica" if "sql" in target else None,
                "started_at": "2026-08-23T09:14:00Z",
            },
        ],
    }
