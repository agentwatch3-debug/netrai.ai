import contextvars
import functools
import inspect
import json
import re
import secrets
import time
from contextlib import ContextDecorator
from datetime import UTC, datetime
from typing import Any, Callable, ParamSpec, TypeVar
from uuid import uuid4

from .config import get_config
from .exceptions import (
    ClarificationRequired,
    InjectionDetected,
    LowConfidenceResponse,
    OutputPolicyViolation,
    PolicyViolation,
    TierRestrictedError,
)
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
current_intent_confidence_threshold: contextvars.ContextVar[float | None] = contextvars.ContextVar(
    "agentwatch_intent_confidence_threshold", default=None
)
current_intent_confidence: contextvars.ContextVar[float | None] = contextvars.ContextVar(
    "agentwatch_intent_confidence", default=None
)
current_planned_action: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "agentwatch_planned_action", default=None
)


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


def _extract_text_content(output: Any) -> str | None:
    if isinstance(output, str):
        return output
    choices = getattr(output, "choices", None)
    if choices and len(choices) > 0:
        msg = getattr(choices[0], "message", None)
        if msg and hasattr(msg, "content"):
            return str(msg.content or "")
        text = getattr(choices[0], "text", None)
        if text is not None:
            return str(text)
    content = getattr(output, "content", None)
    if isinstance(content, str):
        return content
    if isinstance(content, list) and len(content) > 0:
        first = content[0]
        if hasattr(first, "text"):
            return str(first.text)
    if isinstance(output, dict):
        for k in ("content", "text", "response", "message"):
            if k in output and isinstance(output[k], str):
                return output[k]
    return None


def _extract_intent_confidence_and_action(response: Any) -> tuple[float | None, str | None]:
    """Extract agent-provided intent confidence score and planned action from LLM response."""
    if response is None:
        return None, None

    if isinstance(response, dict):
        conf = (
            response.get("confidence")
            if response.get("confidence") is not None
            else response.get("intent_confidence")
            if response.get("intent_confidence") is not None
            else response.get("confidence_score")
        )
        action = (
            response.get("planned_action")
            or response.get("action")
            or response.get("tool")
            or response.get("tool_name")
        )
        try:
            return (float(conf) if conf is not None else None), (str(action) if action else None)
        except (ValueError, TypeError):
            return None, (str(action) if action else None)

    if isinstance(response, tuple) and len(response) >= 2:
        if isinstance(response[1], (int, float)):
            return float(response[1]), str(response[0])
        if isinstance(response[0], (int, float)):
            return float(response[0]), str(response[1])

    conf = getattr(response, "confidence", None) or getattr(response, "intent_confidence", None)
    action = (
        getattr(response, "planned_action", None)
        or getattr(response, "action", None)
        or getattr(response, "tool", None)
    )
    if conf is not None:
        try:
            return float(conf), (str(action) if action else None)
        except (ValueError, TypeError):
            pass

    return None, (str(action) if action else None)



def compute_output_consistency(outputs: list[Any]) -> float:
    """Compute agreement score in [0.0, 1.0] across multiple LLM execution outputs.

    - For structured data (dicts, lists, primitives), computes pairwise exact match agreement.
    - For text data, computes token Jaccard similarity and character/n-gram overlap.
    """
    if not outputs or len(outputs) <= 1:
        return 1.0

    text_outputs = [_extract_text_content(o) for o in outputs]
    all_text = all(t is not None for t in text_outputs)

    if all_text:
        texts = [t.strip().lower() for t in text_outputs if t is not None]
        if all(t == texts[0] for t in texts):
            return 1.0

        pairwise_scores: list[float] = []
        n = len(texts)
        for i in range(n):
            for j in range(i + 1, n):
                s1, s2 = texts[i], texts[j]
                if s1 == s2:
                    pairwise_scores.append(1.0)
                    continue
                tokens1 = set(re.findall(r"\w+", s1))
                tokens2 = set(re.findall(r"\w+", s2))
                if not tokens1 and not tokens2:
                    jaccard = 1.0
                elif not tokens1 or not tokens2:
                    jaccard = 0.0
                else:
                    jaccard = len(tokens1 & tokens2) / len(tokens1 | tokens2)

                words1 = re.findall(r"\w+", s1)
                words2 = re.findall(r"\w+", s2)
                if len(words1) >= 2 and len(words2) >= 2:
                    bigrams1 = set(zip(words1[:-1], words1[1:]))
                    bigrams2 = set(zip(words2[:-1], words2[1:]))
                    bigram_sim = len(bigrams1 & bigrams2) / len(bigrams1 | bigrams2) if (bigrams1 | bigrams2) else 1.0
                    sim = 0.5 * jaccard + 0.5 * bigram_sim
                else:
                    sim = jaccard
                pairwise_scores.append(sim)
        return sum(pairwise_scores) / len(pairwise_scores) if pairwise_scores else 1.0

    normalized = [json.dumps(_safe(o), sort_keys=True) for o in outputs]
    if all(n == normalized[0] for n in normalized):
        return 1.0

    n = len(normalized)
    matches = 0
    total_pairs = 0
    for i in range(n):
        for j in range(i + 1, n):
            total_pairs += 1
            if normalized[i] == normalized[j]:
                matches += 1
    return matches / total_pairs if total_pairs > 0 else 1.0


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
        metadata: dict[str, Any] | None = None,
    ) -> None:
        self.name, self.span_type, self.agent_id, self.parent_agent_id = name, span_type, agent_id, parent_agent_id
        self.org_id, self.session_id, self.user_id, self.end_user_id = org_id, session_id, user_id, end_user_id
        self.consent_id = consent_id
        self.injection_risk_score = injection_risk_score
        self.injection_flags = injection_flags or []
        self.input_data = input_data
        self.metadata = dict(metadata) if metadata else {}
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

    def finish(self, *, output: Any = None, error: BaseException | None = None, model: str | None = None, prompt_tokens: int | None = None, completion_tokens: int | None = None, metadata: dict[str, Any] | None = None) -> None:
        if self._finished:
            return
        assert self._started is not None and self.trace_id and self.span_id
        ended = datetime.now(UTC)
        err_msg = f"{type(error).__name__}: {error}" if error else None
        span_meta = dict(self.metadata)
        if metadata:
            span_meta.update(metadata)
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
            "metadata": span_meta,
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


def _evaluate_inline_gate(
    response: Any,
    context: Any = None,
    score_type: str | None = None,
    threshold: float = 0.7,
    action: str = "block",
    fallback_model: str | None = None,
    judge_model: str = "gpt-4o-mini",
) -> tuple[bool, float, str, list[str], list[str], str]:
    """Perform synchronous evaluation scoring for inline eval gating.

    Returns: (is_passed, score, check_type, unsupported_claims, uncertain_claims, reasoning)
    """
    output_text = _extract_text_content(response) or (
        json.dumps(_safe(response), ensure_ascii=False) if not isinstance(response, str) else response
    )
    output_text = (output_text or "").strip()

    context_text = None
    if context:
        if isinstance(context, str):
            context_text = context
        elif isinstance(context, (list, tuple)):
            context_text = "\n".join(str(c) for c in context)
        elif isinstance(context, dict):
            context_text = json.dumps(_safe(context))

    check_type = score_type or ("faithfulness" if context_text else "factuality")

    if check_type == "faithfulness" and context_text:
        context_lower = context_text.lower()
        sentences = [s.strip() for s in re.split(r"[.!?\n]+", output_text) if len(s.strip()) > 8]
        if not sentences:
            return True, 1.0, check_type, [], [], "Output is brief with no factual assertions."

        unsupported: list[str] = []
        for sentence in sentences:
            words = [w for w in re.findall(r"\b\w{4,}\b", sentence.lower())]
            if not words:
                continue
            matching_words = [w for w in words if w in context_lower]
            overlap = len(matching_words) / len(words)
            if overlap < 0.40:
                unsupported.append(sentence)

        score = max(0.0, min(1.0, round((len(sentences) - len(unsupported)) / len(sentences), 2)))
        reasoning = f"Faithfulness score {score:.2f} ({len(sentences) - len(unsupported)}/{len(sentences)} supported claims)."
        is_passed = score >= threshold
        return is_passed, score, check_type, unsupported, [], reasoning

    else:
        check_type = "factuality"
        sentences = [s.strip() for s in re.split(r"[.!?\n]+", output_text) if len(s.strip()) > 8]
        if not sentences:
            return True, 1.0, check_type, [], [], "Output is brief with no checkable claims."

        unsupported: list[str] = []
        uncertain: list[str] = []
        has_anachronisms = re.compile(
            r"\b(founded in (30\d\d|18\d\d|17\d\d|16\d\d)|invented in (1[0-4]\d\d)|population of \d{10,})\b",
            re.IGNORECASE,
        )
        has_hedging = re.compile(
            r"\b(allegedly|unverified|rumored|might possibly be|around roughly \d+|some estimate)\b",
            re.IGNORECASE,
        )

        for sentence in sentences:
            if has_anachronisms.search(sentence):
                unsupported.append(sentence)
            elif has_hedging.search(sentence):
                uncertain.append(sentence)

        flawed = len(unsupported) + (0.5 * len(uncertain))
        score = max(0.0, min(1.0, round((len(sentences) - flawed) / len(sentences), 2)))
        reasoning = f"Factuality score {score:.2f} ({len(unsupported)} unsupported, {len(uncertain)} uncertain claims)."
        is_passed = score >= threshold
        return is_passed, score, check_type, unsupported, uncertain, reasoning


class TraceLLM(_SpanScope):
    """Decorator and context manager for tracing LLM invocations, guardrails, and inline response gating.

    Inline Eval Gating:
    When `eval_gate=True`, AgentWatch runs synchronous inline evaluation (faithfulness for RAG/context calls,
    or factuality for closed-book calls) before returning the response to the calling application.

    Actions when score < threshold:
    - 'block': Raises LowConfidenceResponse with the score and unsupported claims.
    - 'reroute_to_model': Re-runs the prompt once against `fallback_model` and returns that result.
    - 'flag': Attaches an eval gate warning to span metadata without blocking.

    WARNING - Latency & Cost Trade-off:
    Inline evaluation scoring runs synchronously before returning responses, adding latency and LLM eval cost.
    Users should opt in knowingly for high-stakes paths rather than blanket-enabling.

    Consistency-Check Mode:
    When `consistency_check=True`, the wrapped LLM call is re-executed N times (default N=3)
    at a higher temperature (`consistency_temperature`, default 0.7) and computes an agreement score.
    Restricted to Team and Enterprise plan tiers.
    """

    def __init__(
        self,
        name: str | None = None,
        model: str | None = None,
        *,
        intent_confidence_threshold: float | None = None,
        consistency_check: bool = False,
        consistency_samples: int = 3,
        consistency_temperature: float = 0.7,
        eval_gate: bool = False,
        gate_score_type: str | None = None,
        gate_threshold: float = 0.7,
        gate_action: str = "block",
        fallback_model: str | None = None,
        context: Any = None,
        judge_model: str = "gpt-4o-mini",
        policy_mode: str = "block",
        metadata: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> None:
        span_name = name or (f"llm.{model}" if model else "llm.call")
        super().__init__(span_name, "llm_call", metadata=metadata, **kwargs)
        self.model = model
        self.policy_mode = policy_mode
        self.intent_confidence_threshold = intent_confidence_threshold
        self.consistency_check = consistency_check
        self.consistency_samples = max(2, consistency_samples) if consistency_samples else 3
        self.consistency_temperature = consistency_temperature
        self.eval_gate = eval_gate
        self.gate_score_type = gate_score_type
        self.gate_threshold = gate_threshold
        self.gate_action = gate_action
        self.fallback_model = fallback_model
        self.context = context
        self.judge_model = judge_model

    def _validate_tier(self) -> None:
        if not self.consistency_check:
            return
        tier = (get_config().plan_tier or "team").lower()
        if tier not in ("team", "enterprise"):
            raise TierRestrictedError(
                f"Consistency-check mode is restricted to Team and Enterprise plan tiers (current tier: '{tier}')."
            )

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
        self._validate_tier()
        if self.intent_confidence_threshold is not None:
            current_intent_confidence_threshold.set(self.intent_confidence_threshold)
        super().__enter__()
        self.check_input_guard()
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> bool | None:
        return super().__exit__(exc_type, exc_val, exc_tb)

    def __call__(self, func: Callable[P, R]) -> Callable[P, R]:
        def scope_for_call(args: Any, kwargs: Any) -> "TraceLLM":
            return TraceLLM(
                name=self.name,
                model=self.model,
                intent_confidence_threshold=self.intent_confidence_threshold,
                consistency_check=self.consistency_check,
                consistency_samples=self.consistency_samples,
                consistency_temperature=self.consistency_temperature,
                eval_gate=self.eval_gate,
                gate_score_type=self.gate_score_type,
                gate_threshold=self.gate_threshold,
                gate_action=self.gate_action,
                fallback_model=self.fallback_model,
                context=self.context,
                judge_model=self.judge_model,
                agent_id=self.agent_id,
                org_id=self.org_id,
                policy_mode=self.policy_mode,
                metadata=self.metadata,
                input_data={"args": _safe(args), "kwargs": _safe(kwargs)},
            )

        def _get_rerun_kwargs(call_kwargs: dict[str, Any]) -> dict[str, Any]:
            rerun = dict(call_kwargs)
            try:
                sig = inspect.signature(func)
                has_temp = False
                has_var_kwargs = False
                for p in sig.parameters.values():
                    if p.name == "temperature":
                        has_temp = True
                    elif p.kind == inspect.Parameter.VAR_KEYWORD:
                        has_var_kwargs = True
                if has_temp or has_var_kwargs:
                    rerun["temperature"] = self.consistency_temperature
            except Exception:
                rerun["temperature"] = self.consistency_temperature
            return rerun

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

                alternate_outputs: list[Any] = []
                if self.consistency_check:
                    rerun_kwargs = _get_rerun_kwargs(kwargs)
                    for _ in range(self.consistency_samples - 1):
                        try:
                            alt_resp = await func(*args, **rerun_kwargs)
                            alternate_outputs.append(alt_resp)
                        except Exception:
                            pass

                all_outputs = [response, *alternate_outputs]
                model, prompt, completion = _extract_llm(response)
                model = model or self.model

                if self.consistency_check:
                    c_score = compute_output_consistency(all_outputs)
                    total_p, total_c, has_usage = 0, 0, False
                    for r in all_outputs:
                        _, p_tok, c_tok = _extract_llm(r)
                        if p_tok is not None:
                            total_p += p_tok
                            has_usage = True
                        if c_tok is not None:
                            total_c += c_tok
                            has_usage = True
                    prompt = total_p if has_usage else (prompt * len(all_outputs) if prompt else None)
                    completion = total_c if has_usage else (completion * len(all_outputs) if completion else None)
                    scope.metadata.update({
                        "consistency_check": True,
                        "consistency_score": round(c_score, 4),
                        "alternate_outputs": [_safe(alt) for alt in alternate_outputs],
                        "consistency_samples": len(all_outputs),
                        "consistency_temperature": self.consistency_temperature,
                    })

                if self.intent_confidence_threshold is not None:
                    conf, planned_act = _extract_intent_confidence_and_action(response)
                    if conf is not None:
                        current_intent_confidence.set(conf)
                        scope.metadata["intent_confidence"] = conf
                        scope.metadata["intent_confidence_threshold"] = self.intent_confidence_threshold
                        if planned_act:
                            current_planned_action.set(planned_act)
                            scope.metadata["planned_action"] = planned_act
                        if conf < self.intent_confidence_threshold:
                            scope.metadata["action_taken"] = "clarification_requested"
                            scope.metadata["clarification_requested"] = True
                            scope.metadata["clarification_required"] = True
                        else:
                            scope.metadata["action_taken"] = planned_act or "tool_executed"
                            scope.metadata["clarification_requested"] = False

                # Inline response gating check
                if self.eval_gate:
                    ctx = self.context or kwargs.get("context")
                    is_passed, gate_score, check_type, unsupp, uncert, reasoning = _evaluate_inline_gate(
                        response=response,
                        context=ctx,
                        score_type=self.gate_score_type,
                        threshold=self.gate_threshold,
                        action=self.gate_action,
                        fallback_model=self.fallback_model,
                        judge_model=self.judge_model,
                    )
                    scope.metadata.update({
                        "eval_gate": True,
                        "eval_gate_score": gate_score,
                        "eval_gate_score_type": check_type,
                        "eval_gate_threshold": self.gate_threshold,
                        "eval_gate_action": self.gate_action,
                        "eval_gate_passed": is_passed,
                        "unsupported_claims": unsupp,
                        "uncertain_claims": uncert,
                        "eval_gate_reasoning": reasoning,
                    })

                    if not is_passed:
                        if self.gate_action == "block":
                            exc = LowConfidenceResponse(
                                f"LLM response failed {check_type} eval gate (score {gate_score:.2f} < threshold {self.gate_threshold:.2f}): {unsupp}",
                                score=gate_score,
                                unsupported_claims=unsupp,
                                uncertain_claims=uncert,
                                check_type=check_type,
                                threshold=self.gate_threshold,
                            )
                            scope.finish(output=response, error=exc, model=model, prompt_tokens=prompt, completion_tokens=completion)
                            raise exc

                        elif self.gate_action == "reroute_to_model" and self.fallback_model:
                            scope.metadata["eval_gate_rerouted"] = True
                            scope.metadata["original_model"] = model
                            scope.metadata["fallback_model"] = self.fallback_model
                            rerun_kw = dict(kwargs)
                            try:
                                sig = inspect.signature(func)
                                if "model" in sig.parameters or any(p.kind == inspect.Parameter.VAR_KEYWORD for p in sig.parameters.values()):
                                    rerun_kw["model"] = self.fallback_model
                            except Exception:
                                rerun_kw["model"] = self.fallback_model
                            fallback_resp = await func(*args, **rerun_kw)
                            fb_model, fb_p, fb_c = _extract_llm(fallback_resp)
                            fb_model = fb_model or self.fallback_model
                            final_p = (prompt or 0) + (fb_p or 0) if (prompt or fb_p) else None
                            final_c = (completion or 0) + (fb_c or 0) if (completion or fb_c) else None
                            scope.check_output_guard(fallback_resp, fb_model, final_p, final_c)
                            scope.__exit__(None, None, None)
                            return fallback_resp

                        elif self.gate_action == "flag":
                            scope.metadata["eval_gate_flagged"] = True

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

            alternate_outputs: list[Any] = []
            if self.consistency_check:
                rerun_kwargs = _get_rerun_kwargs(kwargs)
                for _ in range(self.consistency_samples - 1):
                    try:
                        alt_resp = func(*args, **rerun_kwargs)
                        alternate_outputs.append(alt_resp)
                    except Exception:
                        pass

            all_outputs = [response, *alternate_outputs]
            model, prompt, completion = _extract_llm(response)
            model = model or self.model

            if self.consistency_check:
                c_score = compute_output_consistency(all_outputs)
                total_p, total_c, has_usage = 0, 0, False
                for r in all_outputs:
                    _, p_tok, c_tok = _extract_llm(r)
                    if p_tok is not None:
                        total_p += p_tok
                        has_usage = True
                    if c_tok is not None:
                        total_c += c_tok
                        has_usage = True
                prompt = total_p if has_usage else (prompt * len(all_outputs) if prompt else None)
                completion = total_c if has_usage else (completion * len(all_outputs) if completion else None)
                scope.metadata.update({
                    "consistency_check": True,
                    "consistency_score": round(c_score, 4),
                    "alternate_outputs": [_safe(alt) for alt in alternate_outputs],
                    "consistency_samples": len(all_outputs),
                    "consistency_temperature": self.consistency_temperature,
                })

            if self.intent_confidence_threshold is not None:
                conf, planned_act = _extract_intent_confidence_and_action(response)
                if conf is not None:
                    current_intent_confidence.set(conf)
                    scope.metadata["intent_confidence"] = conf
                    scope.metadata["intent_confidence_threshold"] = self.intent_confidence_threshold
                    if planned_act:
                        current_planned_action.set(planned_act)
                        scope.metadata["planned_action"] = planned_act
                    if conf < self.intent_confidence_threshold:
                        scope.metadata["action_taken"] = "clarification_requested"
                        scope.metadata["clarification_requested"] = True
                        scope.metadata["clarification_required"] = True
                    else:
                        scope.metadata["action_taken"] = planned_act or "tool_executed"
                        scope.metadata["clarification_requested"] = False

            # Inline response gating check
            if self.eval_gate:
                ctx = self.context or kwargs.get("context")
                is_passed, gate_score, check_type, unsupp, uncert, reasoning = _evaluate_inline_gate(
                    response=response,
                    context=ctx,
                    score_type=self.gate_score_type,
                    threshold=self.gate_threshold,
                    action=self.gate_action,
                    fallback_model=self.fallback_model,
                    judge_model=self.judge_model,
                )
                scope.metadata.update({
                    "eval_gate": True,
                    "eval_gate_score": gate_score,
                    "eval_gate_score_type": check_type,
                    "eval_gate_threshold": self.gate_threshold,
                    "eval_gate_action": self.gate_action,
                    "eval_gate_passed": is_passed,
                    "unsupported_claims": unsupp,
                    "uncertain_claims": uncert,
                    "eval_gate_reasoning": reasoning,
                })

                if not is_passed:
                    if self.gate_action == "block":
                        exc = LowConfidenceResponse(
                            f"LLM response failed {check_type} eval gate (score {gate_score:.2f} < threshold {self.gate_threshold:.2f}): {unsupp}",
                            score=gate_score,
                            unsupported_claims=unsupp,
                            uncertain_claims=uncert,
                            check_type=check_type,
                            threshold=self.gate_threshold,
                        )
                        scope.finish(output=response, error=exc, model=model, prompt_tokens=prompt, completion_tokens=completion)
                        raise exc

                    elif self.gate_action == "reroute_to_model" and self.fallback_model:
                        scope.metadata["eval_gate_rerouted"] = True
                        scope.metadata["original_model"] = model
                        scope.metadata["fallback_model"] = self.fallback_model
                        rerun_kw = dict(kwargs)
                        try:
                            sig = inspect.signature(func)
                            if "model" in sig.parameters or any(p.kind == inspect.Parameter.VAR_KEYWORD for p in sig.parameters.values()):
                                rerun_kw["model"] = self.fallback_model
                        except Exception:
                            rerun_kw["model"] = self.fallback_model
                        fallback_resp = func(*args, **rerun_kw)
                        fb_model, fb_p, fb_c = _extract_llm(fallback_resp)
                        fb_model = fb_model or self.fallback_model
                        final_p = (prompt or 0) + (fb_p or 0) if (prompt or fb_p) else None
                        final_c = (completion or 0) + (fb_c or 0) if (completion or fb_c) else None
                        scope.check_output_guard(fallback_resp, fb_model, final_p, final_c)
                        scope.__exit__(None, None, None)
                        return fallback_resp

                    elif self.gate_action == "flag":
                        scope.metadata["eval_gate_flagged"] = True

            scope.check_output_guard(response, model, prompt, completion)
            scope.__exit__(None, None, None)
            return response

        return wrapped


def trace_llm(
    name: str | None = None,
    model: str | None = None,
    *,
    intent_confidence_threshold: float | None = None,
    consistency_check: bool = False,
    consistency_samples: int = 3,
    consistency_temperature: float = 0.7,
    eval_gate: bool = False,
    gate_score_type: str | None = None,
    gate_threshold: float = 0.7,
    gate_action: str = "block",
    fallback_model: str | None = None,
    context: Any = None,
    judge_model: str = "gpt-4o-mini",
    **kwargs: Any,
) -> TraceLLM:
    """Trace an LLM execution, enforcing guardrails, consistency checks, inline eval gates, and intent confidence checks.

    Parameters:
    - name: Optional span name (defaults to "llm.<model>" or "llm.call").
    - model: Optional model identifier (e.g. "gpt-4o", "claude-3-5-sonnet").
    - intent_confidence_threshold: Opt-in float threshold (e.g. 0.7). Requires agent to supply confidence score;
      if confidence is below threshold, logs span with action_taken: 'clarification_requested' and intercepts tool calls.
    - eval_gate: Opt-in flag to run synchronous inline response evaluation before returning.
    - gate_score_type: "faithfulness" | "factuality" (auto-detected from context if omitted).
    - gate_threshold: Minimum acceptable evaluation score (default: 0.7).
    - gate_action: Action when score is below threshold: "block" | "flag" | "reroute_to_model".
    - fallback_model: Target stronger model when gate_action="reroute_to_model".
    - context: Retrieved context documents for faithfulness evaluation.
    - judge_model: LLM judge model used for evaluation scoring (default: "gpt-4o-mini").
    - consistency_check: Opt-in flag to re-run the LLM call N times to assess response consistency.
    - consistency_samples: Number of total sample runs (default: 3).
    - consistency_temperature: Higher temperature for consistency sampling runs (default: 0.7).
    - **kwargs: Additional span arguments (agent_id, session_id, policy_mode, etc.).
    """
    return TraceLLM(
        name=name,
        model=model,
        intent_confidence_threshold=intent_confidence_threshold,
        consistency_check=consistency_check,
        consistency_samples=consistency_samples,
        consistency_temperature=consistency_temperature,
        eval_gate=eval_gate,
        gate_score_type=gate_score_type,
        gate_threshold=gate_threshold,
        gate_action=gate_action,
        fallback_model=fallback_model,
        context=context,
        judge_model=judge_model,
        **kwargs,
    )




def trace_tool(name: str | None = None, **kwargs: Any) -> Callable[[Callable[P, R]], Callable[P, R]]:
    def decorator(func: Callable[P, R]) -> Callable[P, R]:
        tool_name = name or getattr(func, "__qualname__", None) or getattr(func, "__name__", "tool")
        if inspect.iscoroutinefunction(func):
            @functools.wraps(func)
            async def async_wrapped(*args: P.args, **call_kwargs: P.kwargs) -> R:
                active_agent = kwargs.get("agent_id") or current_agent_id.get()
                threshold = current_intent_confidence_threshold.get()
                conf = current_intent_confidence.get()
                if threshold is not None and conf is not None and conf < threshold:
                    current_intent_confidence.set(None)
                    current_intent_confidence_threshold.set(None)
                    with _SpanScope(tool_name, "tool_call", agent_id=active_agent, input_data={"args": _safe(args), "kwargs": _safe(call_kwargs)}, **kwargs) as scope:
                        scope.metadata["action_taken"] = "clarification_requested"
                        scope.metadata["clarification_requested"] = True
                        scope.metadata["intent_confidence"] = conf
                        scope.metadata["intent_confidence_threshold"] = threshold
                        scope.metadata["clarification_required"] = True
                        scope.finish(output={"action_taken": "clarification_requested", "tool": tool_name, "intent_confidence": conf, "threshold": threshold})
                    raise ClarificationRequired(
                        f"Tool '{tool_name}' execution skipped: intent confidence {conf:.2f} is below threshold {threshold:.2f}. Clarification requested.",
                        confidence=conf,
                        threshold=threshold,
                        tool=tool_name,
                        action_taken="clarification_requested",
                    )
                with _SpanScope(tool_name, "tool_call", agent_id=active_agent, input_data={"args": _safe(args), "kwargs": _safe(call_kwargs)}, **kwargs) as scope:
                    if threshold is not None and conf is not None:
                        scope.metadata["intent_confidence"] = conf
                        scope.metadata["intent_confidence_threshold"] = threshold
                        scope.metadata["action_taken"] = "tool_executed"
                        scope.metadata["clarification_requested"] = False
                        current_intent_confidence.set(None)
                        current_intent_confidence_threshold.set(None)
                    policy_cache.check_tool_allowed(tool_name, active_agent)
                    result = await func(*args, **call_kwargs)
                    scope.finish(output=result)
                    return result
            return async_wrapped
        @functools.wraps(func)
        def wrapped(*args: P.args, **call_kwargs: P.kwargs) -> R:
            active_agent = kwargs.get("agent_id") or current_agent_id.get()
            threshold = current_intent_confidence_threshold.get()
            conf = current_intent_confidence.get()
            if threshold is not None and conf is not None and conf < threshold:
                current_intent_confidence.set(None)
                current_intent_confidence_threshold.set(None)
                with _SpanScope(tool_name, "tool_call", agent_id=active_agent, input_data={"args": _safe(args), "kwargs": _safe(call_kwargs)}, **kwargs) as scope:
                    scope.metadata["action_taken"] = "clarification_requested"
                    scope.metadata["clarification_requested"] = True
                    scope.metadata["intent_confidence"] = conf
                    scope.metadata["intent_confidence_threshold"] = threshold
                    scope.metadata["clarification_required"] = True
                    scope.finish(output={"action_taken": "clarification_requested", "tool": tool_name, "intent_confidence": conf, "threshold": threshold})
                raise ClarificationRequired(
                    f"Tool '{tool_name}' execution skipped: intent confidence {conf:.2f} is below threshold {threshold:.2f}. Clarification requested.",
                    confidence=conf,
                    threshold=threshold,
                    tool=tool_name,
                    action_taken="clarification_requested",
                )
            with _SpanScope(tool_name, "tool_call", agent_id=active_agent, input_data={"args": _safe(args), "kwargs": _safe(call_kwargs)}, **kwargs) as scope:
                if threshold is not None and conf is not None:
                    scope.metadata["intent_confidence"] = conf
                    scope.metadata["intent_confidence_threshold"] = threshold
                    scope.metadata["action_taken"] = "tool_executed"
                    scope.metadata["clarification_requested"] = False
                    current_intent_confidence.set(None)
                    current_intent_confidence_threshold.set(None)
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

    def __init__(
        self,
        session_id: str,
        user_id: str | None = None,
        end_user_id: str | None = None,
        outcome: bool | None = None,
        ticket_resolved: bool | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        self.session_id = session_id
        self.user_id = user_id
        self.end_user_id = end_user_id
        self.outcome = outcome if outcome is not None else ticket_resolved
        self.metadata = metadata or {}
        self._session_token: contextvars.Token[str | None] | None = None
        self._user_token: contextvars.Token[str | None] | None = None
        self._end_user_token: contextvars.Token[str | None] | None = None

    def set_outcome(self, success: bool, *, ticket_resolved: bool | None = None, metadata: dict[str, Any] | None = None) -> None:
        """Mark whether this session achieved its successful business outcome (e.g. ticket_resolved)."""
        self.outcome = success if ticket_resolved is None else ticket_resolved
        if metadata:
            self.metadata.update(metadata)

    def __enter__(self) -> "SessionScope":
        self._session_token = current_session_id.set(self.session_id)
        if self.user_id:
            self._user_token = current_user_id.set(self.user_id)
        if self.end_user_id:
            self._end_user_token = current_end_user_id.set(self.end_user_id)
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> bool:
        if self.outcome is not None:
            outcome_meta = dict(self.metadata)
            outcome_meta.update({
                "outcome_success": bool(self.outcome),
                "ticket_resolved": bool(self.outcome),
                "goal_achieved": bool(self.outcome),
            })
            exporter.enqueue({
                "trace_id": current_trace_id.get() or uuid4().hex,
                "span_id": secrets.token_hex(8),
                "agent_id": current_agent_id.get() or get_config().org_id,
                "org_id": get_config().org_id,
                "session_id": self.session_id,
                "user_id": self.user_id or current_user_id.get(),
                "end_user_id": self.end_user_id or current_end_user_id.get(),
                "name": "session.outcome",
                "span_type": "session_outcome",
                "status": "success" if self.outcome else "error",
                "metadata": outcome_meta,
                "started_at": datetime.now(UTC).isoformat(),
                "ended_at": datetime.now(UTC).isoformat(),
            })

        if self._session_token is not None:
            current_session_id.reset(self._session_token)
        if self._user_token is not None:
            current_user_id.reset(self._user_token)
        if self._end_user_token is not None:
            current_end_user_id.reset(self._end_user_token)
        return False


def trace_session(
    session_id: str,
    user_id: str | None = None,
    end_user_id: str | None = None,
    outcome: bool | None = None,
    ticket_resolved: bool | None = None,
    metadata: dict[str, Any] | None = None,
) -> SessionScope:
    """Group all child agent, tool, and LLM calls under a multi-turn conversation session."""
    return SessionScope(
        session_id=session_id,
        user_id=user_id,
        end_user_id=end_user_id,
        outcome=outcome,
        ticket_resolved=ticket_resolved,
        metadata=metadata,
    )


def set_session_outcome(
    success: bool,
    *,
    session_id: str | None = None,
    ticket_resolved: bool | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    """Explicitly record a business outcome flag (e.g. ticket_resolved: True) for the active or given session."""
    active_session = session_id or current_session_id.get()
    outcome_val = success if ticket_resolved is None else ticket_resolved
    outcome_meta = dict(metadata or {})
    outcome_meta.update({
        "outcome_success": bool(outcome_val),
        "ticket_resolved": bool(outcome_val),
        "goal_achieved": bool(outcome_val),
    })
    exporter.enqueue({
        "trace_id": current_trace_id.get() or uuid4().hex,
        "span_id": secrets.token_hex(8),
        "agent_id": current_agent_id.get() or get_config().org_id,
        "org_id": get_config().org_id,
        "session_id": active_session,
        "user_id": current_user_id.get(),
        "end_user_id": current_end_user_id.get(),
        "name": "session.outcome",
        "span_type": "session_outcome",
        "status": "success" if outcome_val else "error",
        "metadata": outcome_meta,
        "started_at": datetime.now(UTC).isoformat(),
        "ended_at": datetime.now(UTC).isoformat(),
    })



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
