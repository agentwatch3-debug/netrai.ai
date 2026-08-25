"""LiteLLM proxy and library auto-instrumentation callback for AgentWatch."""

import logging
from typing import Any

from ..exporter import exporter
from ..pricing import estimate_cost
from ..tracing import _safe

logger = logging.getLogger("agentwatch.instrumentation.litellm")


def _litellm_success_callback(kwargs: Any, completion_response: Any, start_time: Any, end_time: Any) -> None:
    try:
        model = kwargs.get("model") or getattr(completion_response, "model", None)
        usage = getattr(completion_response, "usage", None) or kwargs.get("response_cost", None) or {}
        prompt_tokens = getattr(usage, "prompt_tokens", None) if hasattr(usage, "prompt_tokens") else usage.get("prompt_tokens")
        completion_tokens = getattr(usage, "completion_tokens", None) if hasattr(usage, "completion_tokens") else usage.get("completion_tokens")

        latency_ms = None
        if start_time and end_time:
            latency_ms = round((end_time - start_time).total_seconds() * 1000)

        import secrets
        from datetime import UTC, datetime

        span_id = secrets.token_hex(8)
        trace_id = kwargs.get("litellm_trace_id") or secrets.token_hex(16)

        exporter.enqueue({
            "trace_id": trace_id,
            "span_id": span_id,
            "parent_span_id": None,
            "agent_id": kwargs.get("user") or "litellm",
            "org_id": "default",
            "name": f"litellm.{model or 'call'}",
            "span_type": "llm_call",
            "input": _safe(kwargs.get("messages") or kwargs.get("input")),
            "output": _safe(completion_response),
            "model": model,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "cost_usd": estimate_cost(model, prompt_tokens, completion_tokens),
            "latency_ms": latency_ms or 0,
            "status": "success",
            "error_message": None,
            "started_at": start_time.isoformat() if hasattr(start_time, "isoformat") else datetime.now(UTC).isoformat(),
            "ended_at": end_time.isoformat() if hasattr(end_time, "isoformat") else datetime.now(UTC).isoformat(),
            "metadata": {"litellm_call_id": kwargs.get("litellm_call_id")},
        })
    except Exception as exc:
        logger.debug("LiteLLM success callback error: %s", exc)


def patch_litellm() -> None:
    """Register AgentWatch success and failure callbacks with LiteLLM."""
    try:
        import litellm
        if _litellm_success_callback not in litellm.success_callback:
            litellm.success_callback.append(_litellm_success_callback)
            logger.info("Successfully registered AgentWatch LiteLLM callback")
    except ImportError:
        logger.debug("LiteLLM is not installed; skipping LiteLLM auto-instrumentation")
    except Exception as exc:
        logger.warning("Failed to instrument LiteLLM: %s", exc)
