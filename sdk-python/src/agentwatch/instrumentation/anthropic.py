"""Auto-instrumentation for Anthropic Python SDK (Sync and Async)."""

import functools
import inspect
import logging
from typing import Any

from ..tracing import _SpanScope, _safe

logger = logging.getLogger("agentwatch.instrumentation.anthropic")

_ORIGINAL_SYNC_CREATE = None
_ORIGINAL_ASYNC_CREATE = None


def _wrap_sync_create(original_fn: Any) -> Any:
    @functools.wraps(original_fn)
    def wrapped(*args: Any, **kwargs: Any) -> Any:
        model = kwargs.get("model", "claude")
        messages = kwargs.get("messages", [])
        system = kwargs.get("system", "")
        with _SpanScope(f"anthropic.messages.{model}", "llm_call", input_data={"messages": _safe(messages), "system": _safe(system), "params": {k: _safe(v) for k, v in kwargs.items() if k not in ("messages", "system")}}) as scope:
            response = original_fn(*args, **kwargs)
            scope.record_response(response)
            return response
    return wrapped


def _wrap_async_create(original_fn: Any) -> Any:
    @functools.wraps(original_fn)
    async def wrapped(*args: Any, **kwargs: Any) -> Any:
        model = kwargs.get("model", "claude")
        messages = kwargs.get("messages", [])
        system = kwargs.get("system", "")
        with _SpanScope(f"anthropic.messages.{model}", "llm_call", input_data={"messages": _safe(messages), "system": _safe(system), "params": {k: _safe(v) for k, v in kwargs.items() if k not in ("messages", "system")}}) as scope:
            response = await original_fn(*args, **kwargs)
            scope.record_response(response)
            return response
    return wrapped


def patch_anthropic(client: Any = None) -> None:
    """Auto-instrument Anthropic client or global anthropic module."""
    global _ORIGINAL_SYNC_CREATE, _ORIGINAL_ASYNC_CREATE
    try:
        if client is not None:
            if hasattr(client, "messages"):
                target = client.messages
                if not getattr(target.create, "_is_agentwatch_instrumented", False):
                    original = target.create
                    if inspect.iscoroutinefunction(original):
                        target.create = _wrap_async_create(original)
                    else:
                        target.create = _wrap_sync_create(original)
                    target.create._is_agentwatch_instrumented = True
                    logger.debug("Instrumented Anthropic client instance")
            return

        import anthropic
        if hasattr(anthropic, "resources") and hasattr(anthropic.resources, "messages"):
            messages = anthropic.resources.messages.Messages
            if not getattr(messages.create, "_is_agentwatch_instrumented", False):
                _ORIGINAL_SYNC_CREATE = messages.create
                messages.create = _wrap_sync_create(messages.create)
                messages.create._is_agentwatch_instrumented = True

            async_messages = anthropic.resources.messages.AsyncMessages
            if not getattr(async_messages.create, "_is_agentwatch_instrumented", False):
                _ORIGINAL_ASYNC_CREATE = async_messages.create
                async_messages.create = _wrap_async_create(async_messages.create)
                async_messages.create._is_agentwatch_instrumented = True

            logger.info("Successfully auto-instrumented Anthropic SDK")
    except ImportError:
        logger.debug("Anthropic SDK is not installed; skipping Anthropic auto-instrumentation")
    except Exception as exc:
        logger.warning("Failed to auto-instrument Anthropic: %s", exc)


def unpatch_anthropic() -> None:
    """Restore original uninstrumented Anthropic methods."""
    global _ORIGINAL_SYNC_CREATE, _ORIGINAL_ASYNC_CREATE
    try:
        import anthropic
        if _ORIGINAL_SYNC_CREATE is not None and hasattr(anthropic, "resources"):
            anthropic.resources.messages.Messages.create = _ORIGINAL_SYNC_CREATE
            _ORIGINAL_SYNC_CREATE = None
        if _ORIGINAL_ASYNC_CREATE is not None and hasattr(anthropic, "resources"):
            anthropic.resources.messages.AsyncMessages.create = _ORIGINAL_ASYNC_CREATE
            _ORIGINAL_ASYNC_CREATE = None
    except Exception:
        pass
