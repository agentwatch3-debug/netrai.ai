"""Decorators and context managers for AgentWatch spans."""

import contextvars
import functools
import inspect
import secrets
import time
from contextlib import ContextDecorator
from datetime import UTC, datetime
from typing import Any, Callable, ParamSpec, TypeVar
from uuid import uuid4

from .config import get_config
from .exceptions import InjectionDetected, OutputPolicyViolation, PolicyViolation
from .exporter import exporter
from .injection_detector import detect_prompt_injection
from .output_policy import scan_output_policy
from .policy import policy_cache
from .pricing import estimate_cost

P = ParamSpec("P")
R = TypeVar("R")
current_trace_id: contextvars.ContextVar[str | None] = contextvars.ContextVar("agentwatch_trace_id", default=None)
current_span_id: contextvars.ContextVar[str | None] = contextvars.ContextVar("agentwatch_span_id", default=None)
current_agent_id: contextvars.ContextVar[str | None] = contextvars.ContextVar("agentwatch_agent_id", default=None)
current_session_id: contextvars.ContextVar[str | None] = contextvars.ContextVar("agentwatch_session_id", default=None)
current_user_id: contextvars.ContextVar[str | None] = contextvars.ContextVar("agentwatch_user_id", default=None)
current_end_user_id: contextvars.ContextVar[str | None] = contextvars.ContextVar("agentwatch_end_user_id", default=None)
current_consent_id: contextvars.ContextVar[str | None] = contextvars.ContextVar("agentwatch_consent_id", default=None)


def _safe(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, (list, tuple)):
        return [_safe(item) for item in value]
    if isinstance(value, dict):
        return {str(key): _safe(item) for key, item in value.items()}
    if hasattr(value, "model_dump"):
        return _safe(value.model_dump())
    return repr(value)[:10_000]


def _extract_llm(response: Any) -> tuple[str | None, int | None, int | None]:
    usage = getattr(response, "usage", None)
    model = getattr(response, "model", None)
    prompt = getattr(usage, "prompt_tokens", None) or getattr(usage, "input_tokens", None)
    completion = getattr(usage, "completion_tokens", None) or getattr(usage, "output_tokens", None)
    return model, prompt, completion


class _SpanScope(ContextDecorator):
    def __init__(
        self,
        name: str,
        span_type: str,
        *,
        agent_id: str | None = None,
        parent_agent_id: str | None = None,
        org_id: str | None = None,
        session_id: str | None = None,
        user_id: str | None = None,
        end_user_id: str | None = None,
        consent_id: str | None = None,
        injection_risk_score: float | None = None,
        injection_flags: list[str] | None = None,
        input_data: Any = None,
    ) -> None:
        self.name, self.span_type, self.agent_id, self.parent_agent_id = name, span_type, agent_id, parent_agent_id
        self.org_id, self.session_id, self.user_id, self.end_user_id = org_id, session_id, user_id, end_user_id
        self.consent_id = consent_id
        self.injection_risk_score = injection_risk_score
        self.injection_flags = injection_flags or []
        self.input_data = input_data
        self.trace_id: str | None = None
        self.span_id: str | None = None
        self._trace_token: contextvars.Token[str | None] | None = None
        self._span_token: contextvars.Token[str | None] | None = None
        self._agent_token: contextvars.Token[str | None] | None = None
        self._user_token: contextvars.Token[str | None] | None = None
        self._end_user_token: contextvars.Token[str | None] | None = None
        self._session_token: contextvars.Token[str | None] | None = None
        self._consent_token: contextvars.Token[str | None] | None = None
        self._started: datetime | None = None
        self._start_time = 0.0
        self._finished = False

    def __enter__(self) -> "_SpanScope":
        config = get_config()
        self.trace_id = current_trace_id.get() or uuid4().hex
        self.span_id = secrets.token_hex(8)
        self.parent_span_id = current_span_id.get()
        active_parent_agent = current_agent_id.get()
        if self.span_type == "agent_call":
            if not self.parent_agent_id and active_parent_agent and (self.agent_id or self.name) != active_parent_agent:
                self.parent_agent_id = active_parent_agent
        else:
            self.parent_agent_id = None

        self._trace_token = current_trace_id.set(self.trace_id)
        self._span_token = current_span_id.set(self.span_id)
        if self.agent_id:
            self._agent_token = current_agent_id.set(self.agent_id)
        if self.user_id:
            self._user_token = current_user_id.set(self.user_id)
        if self.end_user_id:
            self._end_user_token = current_end_user_id.set(self.end_user_id)
        if self.session_id:
            self._session_token = current_session_id.set(self.session_id)
        if self.consent_id:
            self._consent_token = current_consent_id.set(self.consent_id)
        self._started = datetime.now(UTC)
        self._start_time = time.perf_counter()
        return self

    def finish(self, *, output: Any = None, error: BaseException | None = None, model: str | None = None, prompt_tokens: int | None = None, completion_tokens: int | None = None) -> None:
        if self._finished:
            return
        assert self._started is not None and self.trace_id and self.span_id
        ended = datetime.now(UTC)
        err_msg = f"{type(error).__name__}: {error}" if error else None
        exporter.enqueue({
            "trace_id": self.trace_id,
            "span_id": self.span_id,
            "parent_span_id": self.parent_span_id,
            "agent_id": self.agent_id or current_agent_id.get() or get_config().org_id,
            "parent_agent_id": self.parent_agent_id,
            "org_id": self.org_id or get_config().org_id,
            "session_id": self.session_id or current_session_id.get(),
            "user_id": self.user_id or current_user_id.get(),
            "end_user_id": self.end_user_id or current_end_user_id.get(),
            "consent_id": self.consent_id or current_consent_id.get(),
            "name": self.name,
            "span_type": self.span_type,
            "input": _safe(self.input_data),
            "output": _safe(output),
            "model": model,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "cost_usd": estimate_cost(model, prompt_tokens, completion_tokens),
            "latency_ms": round((time.perf_counter() - self._start_time) * 1000),
            "injection_risk_score": self.injection_risk_score,
            "injection_flags": self.injection_flags,
            "status": "error" if error else "success",
            "error_message": err_msg[:8_192] if err_msg else None,
            "started_at": self._started.isoformat(),
            "ended_at": ended.isoformat(),
            "metadata": {},
        })
        self._finished = True

    def record_response(self, response: Any) -> None:
        """Record a provider response and validate against regulatory output policies."""
        model, prompt, completion = _extract_llm(response)
        scan = scan_output_policy(response)
        if scan.is_blocked:
            viol = scan.violations[0]
            exc = OutputPolicyViolation(f"Output Policy Violation [{viol.rule_name}]: {viol.message} (Matched: '{viol.matched_text}')")
            self.finish(output=response, error=exc, model=model, prompt_tokens=prompt, completion_tokens=completion)
            raise exc
        self.finish(output=response, model=model, prompt_tokens=prompt, completion_tokens=completion)

    def score(self, score_name: str, value: float, reasoning: str | None = None, comment: str | None = None, evaluator_type: str = "human") -> bool:
        """Submit an evaluation or feedback score attached to this active span."""
        from .evals import score as submit_score
        if not self.span_id:
            return False
        return submit_score(
            span_id=self.span_id,
            score_name=score_name,
            value=value,
            reasoning=reasoning,
            comment=comment,
            trace_id=self.trace_id,
            evaluator_type=evaluator_type,
        )

    def __exit__(self, exc_type: Any, exc: BaseException | None, _: Any) -> bool:
        self.finish(error=exc)
        assert self._span_token is not None and self._trace_token is not None
        if self._agent_token is not None:
            current_agent_id.reset(self._agent_token)
        if self._user_token is not None:
            current_user_id.reset(self._user_token)
        if self._end_user_token is not None:
            current_end_user_id.reset(self._end_user_token)
        if self._session_token is not None:
            current_session_id.reset(self._session_token)
        if self._consent_token is not None:
            current_consent_id.reset(self._consent_token)
        current_span_id.reset(self._span_token)
        current_trace_id.reset(self._trace_token)
        return False


class TraceLLM(_SpanScope):
    def __init__(self, name: str | None = None, policy_mode: str = "block", **kwargs: Any) -> None:
        super().__init__(name or "llm.call", "llm_call", **kwargs)
        self.policy_mode = policy_mode

    def check_input_guard(self) -> None:
        """Perform pre-execution prompt injection analysis before calling LLM."""
        if self.input_data is not None:
            res = detect_prompt_injection(self.input_data)
            self.injection_risk_score = res.risk_score
            self.injection_flags = res.flags
            if res.is_injection and self.policy_mode == "block":
                exc = InjectionDetected(f"Prompt injection attempt detected (risk score: {res.risk_score}): {res.flags}")
                self.finish(error=exc)
                raise exc

    def check_output_guard(self, response: Any, model: str | None, prompt: int | None, completion: int | None) -> None:
        """Perform post-call output policy compliance verification."""
        scan = scan_output_policy(response)
        if scan.is_blocked:
            viol = scan.violations[0]
            exc = OutputPolicyViolation(f"Output Policy Violation [{viol.rule_name}]: {viol.message} (Matched: '{viol.matched_text}')")
            self.finish(output=response, error=exc, model=model, prompt_tokens=prompt, completion_tokens=completion)
            raise exc
        self.finish(output=response, model=model, prompt_tokens=prompt, completion_tokens=completion)

    def __enter__(self) -> "TraceLLM":
        super().__enter__()
        self.check_input_guard()
        return self

    def __call__(self, func: Callable[P, R]) -> Callable[P, R]:
        def scope_for_call(args: Any, kwargs: Any) -> "TraceLLM":
            return TraceLLM(self.name, agent_id=self.agent_id, org_id=self.org_id, policy_mode=self.policy_mode, input_data={"args": _safe(args), "kwargs": _safe(kwargs)})
        if inspect.iscoroutinefunction(func):
            @functools.wraps(func)
            async def async_wrapped(*args: P.args, **kwargs: P.kwargs) -> R:
                scope = scope_for_call(args, kwargs)
                scope.__enter__()
                try:
                    response = await func(*args, **kwargs)
                except BaseException as exc:
                    scope.__exit__(type(exc), exc, exc.__traceback__)
                    raise
                model, prompt, completion = _extract_llm(response)
                scope.check_output_guard(response, model, prompt, completion)
                scope.__exit__(None, None, None)
                return response
            return async_wrapped
        @functools.wraps(func)
        def wrapped(*args: P.args, **kwargs: P.kwargs) -> R:
            scope = scope_for_call(args, kwargs)
            scope.__enter__()
            try:
                response = func(*args, **kwargs)
            except BaseException as exc:
                scope.__exit__(type(exc), exc, exc.__traceback__)
                raise
            model, prompt, completion = _extract_llm(response)
            scope.check_output_guard(response, model, prompt, completion)
            scope.__exit__(None, None, None)
            return response
        return wrapped


def trace_llm(name: str | None = None, **kwargs: Any) -> TraceLLM:
    return TraceLLM(name, **kwargs)


def trace_tool(name: str | None = None, **kwargs: Any) -> Callable[[Callable[P, R]], Callable[P, R]]:
    def decorator(func: Callable[P, R]) -> Callable[P, R]:
        tool_name = name or getattr(func, "__qualname__", None) or getattr(func, "__name__", "tool")
        if inspect.iscoroutinefunction(func):
            @functools.wraps(func)
            async def async_wrapped(*args: P.args, **call_kwargs: P.kwargs) -> R:
                active_agent = kwargs.get("agent_id") or current_agent_id.get()
                with _SpanScope(tool_name, "tool_call", agent_id=active_agent, input_data={"args": _safe(args), "kwargs": _safe(call_kwargs)}, **kwargs) as scope:
                    policy_cache.check_tool_allowed(tool_name, active_agent)
                    result = await func(*args, **call_kwargs)
                    scope.finish(output=result)
                    return result
            return async_wrapped
        @functools.wraps(func)
        def wrapped(*args: P.args, **call_kwargs: P.kwargs) -> R:
            active_agent = kwargs.get("agent_id") or current_agent_id.get()
            with _SpanScope(tool_name, "tool_call", agent_id=active_agent, input_data={"args": _safe(args), "kwargs": _safe(call_kwargs)}, **kwargs) as scope:
                policy_cache.check_tool_allowed(tool_name, active_agent)
                result = func(*args, **call_kwargs)
                scope.finish(output=result)
                return result
        return wrapped
    return decorator


def trace_agent(name: str, *, agent_id: str | None = None, parent_agent_id: str | None = None, org_id: str | None = None, session_id: str | None = None, user_id: str | None = None, end_user_id: str | None = None, input_data: Any = None) -> _SpanScope:
    return _SpanScope(name, "agent_call", agent_id=agent_id or name, parent_agent_id=parent_agent_id, org_id=org_id, session_id=session_id, user_id=user_id, end_user_id=end_user_id, input_data=input_data)


class SessionScope:
    """Context manager to group multi-turn agent turns and traces under a session, user, and end_user."""

    def __init__(self, session_id: str, user_id: str | None = None, end_user_id: str | None = None) -> None:
        self.session_id = session_id
        self.user_id = user_id
        self.end_user_id = end_user_id
        self._session_token: contextvars.Token[str | None] | None = None
        self._user_token: contextvars.Token[str | None] | None = None
        self._end_user_token: contextvars.Token[str | None] | None = None

    def __enter__(self) -> "SessionScope":
        self._session_token = current_session_id.set(self.session_id)
        if self.user_id:
            self._user_token = current_user_id.set(self.user_id)
        if self.end_user_id:
            self._end_user_token = current_end_user_id.set(self.end_user_id)
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> bool:
        if self._session_token is not None:
            current_session_id.reset(self._session_token)
        if self._user_token is not None:
            current_user_id.reset(self._user_token)
        if self._end_user_token is not None:
            current_end_user_id.reset(self._end_user_token)
        return False


def trace_session(session_id: str, user_id: str | None = None, end_user_id: str | None = None) -> SessionScope:
    """Group all child agent, tool, and LLM calls under a multi-turn conversation session."""
    return SessionScope(session_id=session_id, user_id=user_id, end_user_id=end_user_id)


class ConsentScope:
    """Context manager to link all child spans under an active user consent reference."""

    def __init__(self, consent_id: str | None) -> None:
        self.consent_id = consent_id
        self._token: contextvars.Token[str | None] | None = None

    def __enter__(self) -> "ConsentScope":
        self._token = current_consent_id.set(self.consent_id)
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> bool:
        if self._token is not None:
            current_consent_id.reset(self._token)
        return False


def set_consent_context(consent_id: str | None) -> ConsentScope:
    """Propagate user consent_id to all child spans created within this context."""
    return ConsentScope(consent_id=consent_id)
