"""Auto-instrumentation for OpenAI Python SDK (Sync and Async)."""

import functools
import inspect
import logging
from typing import Any

from ..tracing import _SpanScope, _safe

logger = logging.getLogger("agentwatch.instrumentation.openai")

_ORIGINAL_SYNC_CREATE = None
_ORIGINAL_ASYNC_CREATE = None


def _wrap_sync_create(original_fn: Any) -> Any:
    @functools.wraps(original_fn)
    def wrapped(*args: Any, **kwargs: Any) -> Any:
        model = kwargs.get("model", "openai.chat")
        messages = kwargs.get("messages", [])
        with _SpanScope(f"openai.chat.{model}", "llm_call", input_data={"messages": _safe(messages), "params": {k: _safe(v) for k, v in kwargs.items() if k != "messages"}}) as scope:
            response = original_fn(*args, **kwargs)
            scope.record_response(response)
            return response
    return wrapped


def _wrap_async_create(original_fn: Any) -> Any:
    @functools.wraps(original_fn)
    async def wrapped(*args: Any, **kwargs: Any) -> Any:
        model = kwargs.get("model", "openai.chat")
        messages = kwargs.get("messages", [])
        with _SpanScope(f"openai.chat.{model}", "llm_call", input_data={"messages": _safe(messages), "params": {k: _safe(v) for k, v in kwargs.items() if k != "messages"}}) as scope:
            response = await original_fn(*args, **kwargs)
            scope.record_response(response)
            return response
    return wrapped


def patch_openai(client: Any = None) -> None:
    """Auto-instrument OpenAI client or global openai module."""
    global _ORIGINAL_SYNC_CREATE, _ORIGINAL_ASYNC_CREATE
    try:
        if client is not None:
            # Instrument specific client instance
            if hasattr(client, "chat") and hasattr(client.chat, "completions"):
                target = client.chat.completions
                if not getattr(target.create, "_is_agentwatch_instrumented", False):
                    original = target.create
                    if inspect.iscoroutinefunction(original):
                        target.create = _wrap_async_create(original)
                    else:
                        target.create = _wrap_sync_create(original)
                    target.create._is_agentwatch_instrumented = True
                    logger.debug("Instrumented OpenAI client instance")
            return

        # Global module instrumentation
        import openai
        if hasattr(openai, "resources") and hasattr(openai.resources, "chat"):
            chat_completions = openai.resources.chat.completions.Completions
            if not getattr(chat_completions.create, "_is_agentwatch_instrumented", False):
                _ORIGINAL_SYNC_CREATE = chat_completions.create
                chat_completions.create = _wrap_sync_create(chat_completions.create)
                chat_completions.create._is_agentwatch_instrumented = True

            async_chat_completions = openai.resources.chat.completions.AsyncCompletions
            if not getattr(async_chat_completions.create, "_is_agentwatch_instrumented", False):
                _ORIGINAL_ASYNC_CREATE = async_chat_completions.create
                async_chat_completions.create = _wrap_async_create(async_chat_completions.create)
                async_chat_completions.create._is_agentwatch_instrumented = True

            logger.info("Successfully auto-instrumented OpenAI SDK")
    except ImportError:
        logger.debug("OpenAI SDK is not installed; skipping OpenAI auto-instrumentation")
    except Exception as exc:
        logger.warning("Failed to auto-instrument OpenAI: %s", exc)


def unpatch_openai() -> None:
    """Restore original uninstrumented OpenAI methods."""
    global _ORIGINAL_SYNC_CREATE, _ORIGINAL_ASYNC_CREATE
    try:
        import openai
        if _ORIGINAL_SYNC_CREATE is not None and hasattr(openai, "resources"):
            openai.resources.chat.completions.Completions.create = _ORIGINAL_SYNC_CREATE
            _ORIGINAL_SYNC_CREATE = None
        if _ORIGINAL_ASYNC_CREATE is not None and hasattr(openai, "resources"):
            openai.resources.chat.completions.AsyncCompletions.create = _ORIGINAL_ASYNC_CREATE
            _ORIGINAL_ASYNC_CREATE = None
    except Exception:
        pass
