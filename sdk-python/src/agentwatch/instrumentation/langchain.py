"""LangChain and LangGraph callback handler for AgentWatch."""

import logging
from typing import Any, Dict, List, Optional
from uuid import UUID

from ..policy import policy_cache
from ..tracing import _SpanScope, _safe

logger = logging.getLogger("agentwatch.instrumentation.langchain")

try:
    from langchain_core.callbacks.base import BaseCallbackHandler
except ImportError:
    class BaseCallbackHandler:  # type: ignore[no-redef]
        """Fallback callback base if langchain_core is not installed."""
        pass


class AgentWatchCallbackHandler(BaseCallbackHandler):
    """LangChain CallbackHandler that translates LangChain events into AgentWatch spans."""

    def __init__(self, agent_id: Optional[str] = None, org_id: Optional[str] = None) -> None:
        super().__init__()
        self.agent_id = agent_id
        self.org_id = org_id
        self._active_scopes: Dict[str, _SpanScope] = {}

    def on_llm_start(
        self,
        serialized: Dict[str, Any],
        prompts: List[str],
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> None:
        name = (serialized or {}).get("name") or (metadata or {}).get("ls_model_name") or "langchain.llm"
        scope = _SpanScope(
            name=name,
            span_type="llm_call",
            agent_id=self.agent_id,
            org_id=self.org_id,
            input_data={"prompts": _safe(prompts), "metadata": _safe(metadata)},
        )
        scope.__enter__()
        self._active_scopes[str(run_id)] = scope

    def on_llm_end(
        self,
        response: Any,
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        scope = self._active_scopes.pop(str(run_id), None)
        if not scope:
            return

        llm_output = getattr(response, "llm_output", None) or {}
        if isinstance(llm_output, dict):
            token_usage = llm_output.get("token_usage", {})
            model_name = llm_output.get("model_name")
        else:
            token_usage = getattr(llm_output, "token_usage", {})
            model_name = getattr(llm_output, "model_name", None)

        generations = getattr(response, "generations", [])
        output_text = [g[0].text for g in generations if g] if generations else str(response)

        if isinstance(token_usage, dict):
            prompt_tokens = token_usage.get("prompt_tokens") or token_usage.get("input_tokens")
            completion_tokens = token_usage.get("completion_tokens") or token_usage.get("output_tokens")
        else:
            prompt_tokens = getattr(token_usage, "prompt_tokens", None) or getattr(token_usage, "input_tokens", None)
            completion_tokens = getattr(token_usage, "completion_tokens", None) or getattr(token_usage, "output_tokens", None)

        scope.finish(
            output=_safe(output_text),
            model=model_name,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
        )
        scope.__exit__(None, None, None)

    def on_llm_error(
        self,
        error: BaseException,
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        scope = self._active_scopes.pop(str(run_id), None)
        if scope:
            scope.__exit__(type(error), error, error.__traceback__)

    def on_tool_start(
        self,
        serialized: Dict[str, Any],
        input_str: str,
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> None:
        tool_name = (serialized or {}).get("name") or "langchain.tool"
        # Pre-execution policy rule enforcement
        policy_cache.check_tool_allowed(tool_name, self.agent_id)

        scope = _SpanScope(
            name=tool_name,
            span_type="tool_call",
            agent_id=self.agent_id,
            org_id=self.org_id,
            input_data={"input": _safe(input_str)},
        )
        scope.__enter__()
        self._active_scopes[str(run_id)] = scope

    def on_tool_end(
        self,
        output: str,
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        scope = self._active_scopes.pop(str(run_id), None)
        if scope:
            scope.finish(output=_safe(output))
            scope.__exit__(None, None, None)

    def on_tool_error(
        self,
        error: BaseException,
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        scope = self._active_scopes.pop(str(run_id), None)
        if scope:
            scope.__exit__(type(error), error, error.__traceback__)

    def on_chain_start(
        self,
        serialized: Dict[str, Any],
        inputs: Dict[str, Any],
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> None:
        chain_name = (serialized or {}).get("name") or "langchain.chain"
        scope = _SpanScope(
            name=chain_name,
            span_type="agent_call",
            agent_id=self.agent_id,
            org_id=self.org_id,
            input_data=_safe(inputs),
        )
        scope.__enter__()
        self._active_scopes[str(run_id)] = scope

    def on_chain_end(
        self,
        outputs: Dict[str, Any],
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        scope = self._active_scopes.pop(str(run_id), None)
        if scope:
            scope.finish(output=_safe(outputs))
            scope.__exit__(None, None, None)

    def on_chain_error(
        self,
        error: BaseException,
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        scope = self._active_scopes.pop(str(run_id), None)
        if scope:
            scope.__exit__(type(error), error, error.__traceback__)
