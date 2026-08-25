"""Client-side scoring and evaluation helper for AgentWatch."""

import logging
from typing import Any

import httpx

from .config import get_config

logger = logging.getLogger("agentwatch.evals")


def score(
    span_id: str,
    score_name: str,
    value: float,
    reasoning: str | None = None,
    comment: str | None = None,
    trace_id: str | None = None,
    evaluator_type: str = "human",
    metadata: dict[str, Any] | None = None,
) -> bool:
    """Submit an evaluation or feedback score for a span."""
    config = get_config()
    if not config.api_key or not config.endpoint:
        logger.debug("AgentWatch API key or endpoint not configured; skipping score submission")
        return False

    payload = {
        "span_id": span_id,
        "trace_id": trace_id or "",
        "score_name": score_name,
        "score_value": float(value),
        "reasoning": reasoning or comment,
        "evaluator_type": evaluator_type,
        "metadata": metadata or {},
    }

    try:
        with httpx.Client(timeout=3.0) as client:
            resp = client.post(
                f"{config.endpoint.rstrip('/')}/v1/evals/scores",
                json=payload,
                headers={"X-AgentWatch-Key": config.api_key},
            )
            return resp.status_code in (200, 201)
    except Exception as exc:
        logger.warning("Failed to submit score '%s' for span %s: %s", score_name, span_id, exc)
        return False
