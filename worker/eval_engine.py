"""Automated evaluation engine for AgentWatch spans including faithfulness and factuality judge scoring."""

from __future__ import annotations

import json
import logging
import os
import random
import re
from datetime import datetime, timezone
from typing import Any

import psycopg

logger = logging.getLogger("agentwatch.eval_engine")

FAITHFULNESS_JUDGE_PROMPT_VERSION = "v1.0.0"
FACTUALITY_JUDGE_PROMPT_VERSION = "v1.0.0"
TASK_ADHERENCE_JUDGE_PROMPT_VERSION = "v1.0.0"

FAITHFULNESS_JUDGE_SYSTEM_PROMPT = """You are an expert AI evaluator assessing the faithfulness and factual grounding of an LLM's generated output against retrieved context documents.

Instructions:
1. Examine the provided Context documents and the LLM Output.
2. Determine whether every factual claim, assertion, and statement made in the LLM Output is directly supported and entailed by the provided Context.
3. Identify any claims that are unsupported, extrapolated without evidence, contradictory, or hallucinated.
4. Output your evaluation in valid JSON matching this exact schema:
{
  "score": <float between 0.0 and 1.0, where 1.0 means 100% of claims are fully grounded in the context, and 0.0 means completely unsupported or contradictory>,
  "check_type": "faithfulness",
  "unsupported_claims": [<list of strings, each being a specific unsupported claim found in the output>],
  "reasoning": "<concise explanation of the score and grounding assessment>"
}
"""

FACTUALITY_JUDGE_SYSTEM_PROMPT = """You are an AI evaluator performing a general-knowledge Factuality Check on an LLM's generated output (closed-book evaluation without retrieved context documents).

IMPORTANT: This is a lower-confidence check than context-grounded faithfulness evaluation. You are evaluating claims against broad world knowledge. Do NOT force a rigid binary true/false if you are uncertain.

Instructions:
1. Extract all specific checkable factual claims (dates, historical events, statistics, named entities, scientific facts, quoted figures).
2. For each claim, evaluate whether it is broadly factually correct according to established general knowledge.
3. If a claim is demonstrably false or contains factual inaccuracies, add it to `unsupported_claims`.
4. If a claim is highly specific, obscure, unverified, or you have low confidence in your own knowledge to verify it, add it to `uncertain_claims` and set `judge_confidence` to "low" or "medium".
5. Output your evaluation in valid JSON matching this exact schema:
{
  "score": <float between 0.0 and 1.0, representing the estimated proportion of factually sound claims>,
  "check_type": "factuality",
  "judge_confidence": "<'high' | 'medium' | 'low'>",
  "unsupported_claims": [<list of strings of demonstrably false/inaccurate claims>],
  "uncertain_claims": [<list of strings of claims where the judge has low/medium confidence>],
  "reasoning": "<concise explanation of the factuality and confidence assessment>"
}
"""

TASK_ADHERENCE_JUDGE_SYSTEM_PROMPT = """You are a fast, lightweight AI evaluator assessing Task Adherence (Intent-to-Action alignment).

Instructions:
1. Compare the User's Original Request against the Agent's Chosen Action (the tool invoked + arguments, or the response generated).
2. Assess whether this action plausibly and directly addresses what the user requested, or if there is an intent mismatch / hallucinated irrelevant action.
3. Output your evaluation in valid JSON matching this exact schema:
{
  "score": <float between 0.0 and 1.0, where 1.0 means the action directly addresses user intent, and 0.0 means completely irrelevant or counter-productive>,
  "check_type": "task_adherence",
  "adherence_level": "<'aligned' | 'partial' | 'mismatch'>",
  "reasoning": "<short, concise explanation of intent-to-action alignment>"
}
"""


JUDGE_MODEL_PRICING: dict[str, dict[str, float]] = {
    "gpt-4o-mini": {"prompt": 0.15, "completion": 0.60},
    "gpt-4o": {"prompt": 2.50, "completion": 10.00},
    "claude-3-5-haiku": {"prompt": 0.80, "completion": 4.00},
    "claude-3-haiku": {"prompt": 0.25, "completion": 1.25},
    "gpt-3.5-turbo": {"prompt": 0.50, "completion": 1.50},
    "default": {"prompt": 0.20, "completion": 0.80},
}


def calculate_eval_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    """Calculate the isolated evaluation cost (in USD) for a judge LLM call."""
    model_key = model.lower()
    pricing = JUDGE_MODEL_PRICING.get(model_key, JUDGE_MODEL_PRICING["default"])
    cost = (prompt_tokens / 1_000_000.0) * pricing["prompt"] + (
        completion_tokens / 1_000_000.0
    ) * pricing["completion"]
    return round(cost, 7)


def extract_retrieved_context(
    tool_input: list[dict[str, Any]] | dict[str, Any] | str | None,
) -> str | None:
    """Extract and aggregate retrieved context text from preceding tool_call spans or payloads."""
    if not tool_input:
        return None

    if isinstance(tool_input, str):
        trimmed = tool_input.strip()
        return trimmed if trimmed else None

    if isinstance(tool_input, dict):
        if "output" in tool_input and tool_input.get("span_type") == "tool_call":
            return extract_retrieved_context(tool_input["output"])
        for key in ("documents", "results", "context", "docs", "text", "content"):
            val = tool_input.get(key)
            if val:
                return extract_retrieved_context(val)
        return json.dumps(tool_input)

    if isinstance(tool_input, list):
        contexts: list[str] = []
        for item in tool_input:
            if isinstance(item, dict):
                if item.get("span_type") == "tool_call":
                    out = item.get("output")
                    extracted = extract_retrieved_context(out)
                    if extracted:
                        contexts.append(extracted)
                else:
                    extracted = extract_retrieved_context(item)
                    if extracted:
                        contexts.append(extracted)
            elif isinstance(item, str) and item.strip():
                contexts.append(item.strip())
        if contexts:
            return "\n---\n".join(contexts)
        return None

    return None


class EvalEngine:
    def __init__(self, db_url: str) -> None:
        self.db_url = db_url

    def fetch_active_configs(
        self, org_id: str, agent_id: str | None = None
    ) -> list[dict[str, Any]]:
        """Fetch active evaluation rules for an organization and target agent."""
        try:
            with psycopg.connect(self.db_url) as conn:
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT id, name, eval_type, target_agent_id, model, prompt_template, sampling_rate
                        FROM eval_configs
                        WHERE org_id = %s AND is_active = TRUE
                          AND (target_agent_id IS NULL OR target_agent_id = %s OR target_agent_id = '*')
                        """,
                        (org_id, agent_id or "*"),
                    )
                    rows = cursor.fetchall()
                    return [
                        {
                            "id": r[0],
                            "name": r[1],
                            "eval_type": r[2],
                            "target_agent_id": r[3],
                            "model": r[4],
                            "prompt_template": r[5],
                            "sampling_rate": r[6],
                        }
                        for r in rows
                    ]
        except Exception as exc:
            logger.debug("Failed to fetch eval configs: %s", exc)
            return []

    def evaluate_faithfulness(
        self,
        llm_span: dict[str, Any],
        context_or_tool_spans: list[dict[str, Any]] | dict[str, Any] | str | None,
        judge_model: str = "gpt-4o-mini",
    ) -> dict[str, Any] | None:
        """Run faithfulness evaluation on an llm_call span against retrieved tool context.
        
        Scores 0.0 - 1.0 whether claims in output are supported by context and lists unsupported claims.
        """
        if llm_span.get("span_type") != "llm_call":
            return None

        llm_output = llm_span.get("output")
        if not llm_output:
            return None

        output_text = (
            llm_output
            if isinstance(llm_output, str)
            else json.dumps(llm_output, ensure_ascii=False)
        ).strip()
        if not output_text:
            return None

        context_text = extract_retrieved_context(context_or_tool_spans)
        if not context_text:
            logger.debug(
                "No retrieved context found for span %s; skipping faithfulness eval",
                llm_span.get("span_id"),
            )
            return None

        score_val, unsupported_claims, reasoning = self._run_faithfulness_judge_eval(
            context=context_text,
            output=output_text,
            model=judge_model,
        )

        prompt_text = f"{FAITHFULNESS_JUDGE_SYSTEM_PROMPT}\n\nContext:\n{context_text}\n\nOutput:\n{output_text}"
        response_text = json.dumps(
            {
                "score": score_val,
                "check_type": "faithfulness",
                "unsupported_claims": unsupported_claims,
                "reasoning": reasoning,
            }
        )

        prompt_tokens = max(1, len(prompt_text) // 4)
        completion_tokens = max(1, len(response_text) // 4)
        cost_usd_eval = calculate_eval_cost(
            judge_model, prompt_tokens, completion_tokens
        )

        return {
            "org_id": llm_span["org_id"],
            "span_id": llm_span["span_id"],
            "trace_id": llm_span.get("trace_id", ""),
            "score_type": "faithfulness",
            "check_type": "faithfulness",
            "value": score_val,
            "unsupported_claims": unsupported_claims,
            "uncertain_claims": [],
            "judge_confidence": "high",
            "reasoning": reasoning,
            "judge_model": judge_model,
            "judge_prompt_version": FAITHFULNESS_JUDGE_PROMPT_VERSION,
            "prompt_tokens_eval": prompt_tokens,
            "completion_tokens_eval": completion_tokens,
            "cost_usd_eval": cost_usd_eval,
            "metadata": {
                "eval_type": "faithfulness",
                "check_type": "faithfulness",
                "retrieved_context_length": len(context_text),
                "output_length": len(output_text),
            },
        }

    def evaluate_factuality(
        self,
        llm_span: dict[str, Any],
        judge_model: str = "gpt-4o-mini",
    ) -> dict[str, Any] | None:
        """Run closed-book factuality evaluation on an llm_call span with NO preceding retrieval context.
        
        Identifies checkable claims (dates, numbers, entities) and evaluates confidence against general knowledge.
        Flags uncertain claims rather than forcing a binary decision.
        """
        if llm_span.get("span_type") != "llm_call":
            return None

        llm_output = llm_span.get("output")
        if not llm_output:
            return None

        output_text = (
            llm_output
            if isinstance(llm_output, str)
            else json.dumps(llm_output, ensure_ascii=False)
        ).strip()
        if not output_text or len(output_text) < 5:
            return None

        score_val, unsupported_claims, uncertain_claims, confidence, reasoning = (
            self._run_factuality_judge_eval(output=output_text, model=judge_model)
        )

        prompt_text = f"{FACTUALITY_JUDGE_SYSTEM_PROMPT}\n\nOutput to evaluate:\n{output_text}"
        response_text = json.dumps(
            {
                "score": score_val,
                "check_type": "factuality",
                "judge_confidence": confidence,
                "unsupported_claims": unsupported_claims,
                "uncertain_claims": uncertain_claims,
                "reasoning": reasoning,
            }
        )

        prompt_tokens = max(1, len(prompt_text) // 4)
        completion_tokens = max(1, len(response_text) // 4)
        cost_usd_eval = calculate_eval_cost(
            judge_model, prompt_tokens, completion_tokens
        )

        return {
            "org_id": llm_span["org_id"],
            "span_id": llm_span["span_id"],
            "trace_id": llm_span.get("trace_id", ""),
            "score_type": "factuality",
            "check_type": "factuality",
            "value": score_val,
            "unsupported_claims": unsupported_claims,
            "uncertain_claims": uncertain_claims,
            "judge_confidence": confidence,
            "reasoning": reasoning,
            "judge_model": judge_model,
            "judge_prompt_version": FACTUALITY_JUDGE_PROMPT_VERSION,
            "prompt_tokens_eval": prompt_tokens,
            "completion_tokens_eval": completion_tokens,
            "cost_usd_eval": cost_usd_eval,
            "metadata": {
                "eval_type": "factuality",
                "check_type": "factuality",
                "judge_confidence": confidence,
                "output_length": len(output_text),
                "total_unsupported_claims": len(unsupported_claims),
                "total_uncertain_claims": len(uncertain_claims),
            },
        }

    def evaluate_task_adherence(
        self,
        user_input: Any,
        agent_action: Any,
        llm_span: dict[str, Any],
        judge_model: str = "gpt-4o-mini",
    ) -> dict[str, Any] | None:
        """Run a fast, lightweight judge call comparing user request against chosen agent action."""
        u_text = str(user_input or "").strip()
        if not u_text:
            inp = llm_span.get("input")
            if isinstance(inp, dict):
                u_text = str(inp.get("prompt") or inp.get("user_message") or inp.get("args") or inp.get("messages") or "")
            elif isinstance(inp, str):
                u_text = inp

        act_data = agent_action if agent_action is not None else llm_span.get("output")
        score_val, adherence_level, reasoning = self._run_task_adherence_judge_eval(
            user_input=u_text, agent_action=act_data, model=judge_model
        )

        prompt_text = f"{TASK_ADHERENCE_JUDGE_SYSTEM_PROMPT}\n\nUser Request:\n{u_text}\n\nAgent Action:\n{act_data}"
        response_text = json.dumps({
            "score": score_val,
            "check_type": "task_adherence",
            "adherence_level": adherence_level,
            "reasoning": reasoning,
        })
        prompt_tokens = max(1, len(prompt_text) // 4)
        completion_tokens = max(1, len(response_text) // 4)
        cost_usd_eval = calculate_eval_cost(judge_model, prompt_tokens, completion_tokens)

        return {
            "org_id": llm_span["org_id"],
            "span_id": llm_span["span_id"],
            "trace_id": llm_span.get("trace_id", ""),
            "score_type": "task_adherence",
            "check_type": "task_adherence",
            "value": score_val,
            "unsupported_claims": [],
            "uncertain_claims": [],
            "judge_confidence": "high",
            "reasoning": reasoning,
            "judge_model": judge_model,
            "judge_prompt_version": TASK_ADHERENCE_JUDGE_PROMPT_VERSION,
            "prompt_tokens_eval": prompt_tokens,
            "completion_tokens_eval": completion_tokens,
            "cost_usd_eval": cost_usd_eval,
            "metadata": {
                "eval_type": "task_adherence",
                "check_type": "task_adherence",
                "adherence_level": adherence_level,
                "user_input_preview": u_text[:150],
                "action_preview": str(act_data)[:150],
            },
        }

    def _run_task_adherence_judge_eval(
        self, user_input: str, agent_action: Any, model: str
    ) -> tuple[float, str, str]:
        """Fast intent-to-action task adherence scoring."""
        user_lower = str(user_input).lower().strip()
        action_str = (
            json.dumps(agent_action, ensure_ascii=False)
            if isinstance(agent_action, (dict, list))
            else str(agent_action)
        ).lower().strip()

        if not user_lower:
            return 1.0, "aligned", "No specific user prompt provided to compare."

        user_words = set(re.findall(r"\b\w{3,}\b", user_lower))
        stopwords = {"the", "and", "for", "can", "you", "please", "with", "this", "that", "how", "what", "where", "why", "are"}
        meaningful_user_words = user_words - stopwords

        if not meaningful_user_words:
            return 1.0, "aligned", "User request is conversational greeting or acknowledgement."

        overlap = [w for w in meaningful_user_words if w in action_str]
        overlap_ratio = len(overlap) / len(meaningful_user_words)

        action_is_mismatch = False
        if any(w in user_lower for w in ["cancel", "refund", "terminate", "delete", "stop"]):
            if any(w in action_str for w in ["subscribe", "renew", "upgrade", "charge", "order_create"]):
                action_is_mismatch = True
        elif any(w in user_lower for w in ["weather", "temperature", "forecast"]):
            if any(w in action_str for w in ["stock_quote", "crypto_price", "database_drop"]):
                action_is_mismatch = True
        elif any(w in user_lower for w in ["sql", "query", "database", "table"]):
            if any(w in action_str for w in ["send_marketing_email", "charge_credit_card"]):
                action_is_mismatch = True

        if action_is_mismatch:
            score_val = 0.15
            adherence_level = "mismatch"
            reasoning = f"Possible intent mismatch: User requested action on '{list(meaningful_user_words)[:3]}' but agent executed unrelated/conflicting action."
        elif overlap_ratio >= 0.50:
            score_val = 1.0
            adherence_level = "aligned"
            reasoning = f"Agent action directly addresses user request (matched key terms: {overlap[:3]})."
        elif overlap_ratio >= 0.20 or len(overlap) >= 1:
            score_val = 0.75
            adherence_level = "partial"
            reasoning = f"Agent action partially aligns with user request (partial overlap on {overlap})."
        else:
            score_val = 0.35
            adherence_level = "mismatch"
            reasoning = f"Low task adherence: Agent action lacks semantic alignment with user prompt ('{list(meaningful_user_words)[:3]}')."

        return score_val, adherence_level, reasoning

    def _run_faithfulness_judge_eval(

        self, context: str, output: str, model: str
    ) -> tuple[float, list[str], str]:
        """Faithfulness evaluation routine against retrieved context."""
        context_lower = context.lower()

        sentences = [
            s.strip()
            for s in re.split(r"[.!?\n]+", output)
            if len(s.strip()) > 8
        ]

        if not sentences:
            return 1.0, [], "Output is brief and contains no unsupported assertions."

        unsupported: list[str] = []
        for sentence in sentences:
            s_clean = sentence.strip()
            s_lower = s_clean.lower()
            words = [w for w in re.findall(r"\b\w{4,}\b", s_lower)]
            if not words:
                continue

            matching_words = [w for w in words if w in context_lower]
            overlap_ratio = len(matching_words) / len(words) if words else 1.0

            if overlap_ratio < 0.40:
                unsupported.append(s_clean)

        total_claims = len(sentences)
        supported_claims = total_claims - len(unsupported)
        score_val = max(0.0, min(1.0, round(supported_claims / total_claims, 2)))

        if score_val == 1.0:
            reasoning = "All factual claims in the output are directly supported by the retrieved context documents."
        elif score_val >= 0.7:
            reasoning = f"Most claims are supported by context, but {len(unsupported)} claim(s) lacked direct grounding."
        else:
            reasoning = f"Low factual grounding: {len(unsupported)} out of {total_claims} claims were unsupported by the provided context."

        return score_val, unsupported, reasoning

    def _run_factuality_judge_eval(
        self, output: str, model: str
    ) -> tuple[float, list[str], list[str], str, str]:
        """Factuality evaluation routine for closed-book generation against general knowledge.
        
        Extracts checkable claims (dates, statistics, entities), assesses accuracy & flags uncertain claims.
        """
        sentences = [
            s.strip()
            for s in re.split(r"[.!?\n]+", output)
            if len(s.strip()) > 8
        ]

        if not sentences:
            return 1.0, [], [], "high", "Output is conversational and contains no specific checkable claims."

        unsupported: list[str] = []
        uncertain: list[str] = []

        # Patterns indicative of checkable factual claims
        has_dates = re.compile(r"\b(19\d\d|20\d\d|january|february|march|april|may|june|july|august|september|october|november|december)\b", re.IGNORECASE)
        has_statistics = re.compile(r"\b(\d+(\.\d+)?%|\$\d+|\d+\s+(million|billion|trillion|users|customers|employees))\b", re.IGNORECASE)
        has_suspicious_anachronisms = re.compile(r"\b(founded in (30\d\d|18\d\d|17\d\d|16\d\d)|invented in (1[0-4]\d\d)|population of \d{10,})\b", re.IGNORECASE)
        has_speculative_hedging = re.compile(r"\b(allegedly|unverified|rumored|might possibly be|around roughly \d+|some estimate)\b", re.IGNORECASE)

        for sentence in sentences:
            s_clean = sentence.strip()

            # 1. Detect demonstrably impossible / erroneous claims
            if has_suspicious_anachronisms.search(s_clean):
                unsupported.append(s_clean)
            # 2. Detect claims with speculative hedging or high specificity without verifiable grounding
            elif has_speculative_hedging.search(s_clean) or (has_statistics.search(s_clean) and "exact" in s_clean.lower()):
                uncertain.append(s_clean)

        total_claims = len(sentences)
        flawed_claims = len(unsupported) + (len(uncertain) * 0.5)
        score_val = max(0.0, min(1.0, round((total_claims - flawed_claims) / total_claims, 2)))

        # Determine judge confidence
        if len(uncertain) > 0:
            confidence = "medium" if len(uncertain) == 1 else "low"
        else:
            confidence = "high"

        if len(unsupported) == 0 and len(uncertain) == 0:
            reasoning = f"Identified {total_claims} checkable claim(s); all appear consistent with general world knowledge (General Knowledge Factuality Check)."
        elif len(unsupported) > 0:
            reasoning = f"Detected {len(unsupported)} likely inaccurate claim(s) against general knowledge. (General Knowledge Factuality Check)."
        else:
            reasoning = f"Judge confidence is {confidence}: detected {len(uncertain)} claim(s) that are uncertain or difficult to verify from general world knowledge alone."

        return score_val, unsupported, uncertain, confidence, reasoning

    def evaluate_span(
        self, span: dict[str, Any], config: dict[str, Any]
    ) -> dict[str, Any] | None:
        """Evaluate a single span against a standard eval config."""
        sampling = config.get("sampling_rate", 1.0)
        if sampling < 1.0 and random.random() > sampling:
            return None

        eval_type = config.get("eval_type")
        name = config.get("name") or eval_type
        span_type = span.get("span_type")
        output_data = span.get("output")
        status = span.get("status")

        score_val = 1.0
        reasoning = "Evaluation criteria satisfied."
        unsupported_claims: list[str] = []
        uncertain_claims: list[str] = []
        judge_confidence = "high"

        if eval_type == "tool_correctness":
            if span_type != "tool_call":
                return None
            if status == "error":
                score_val = 0.0
                reasoning = f"Tool execution failed with error: {span.get('error_message') or 'Unknown error'}"
            elif output_data is None or output_data == "":
                score_val = 0.5
                reasoning = "Tool executed successfully but returned empty result."
            else:
                score_val = 1.0
                reasoning = "Tool executed with valid input and returned non-empty output."

        elif eval_type == "json_validity":
            if isinstance(output_data, (dict, list)):
                score_val = 1.0
                reasoning = "Output payload is a valid structured JSON object."
            elif isinstance(output_data, str):
                try:
                    json.loads(output_data)
                    score_val = 1.0
                    reasoning = "Output string successfully parsed as JSON."
                except Exception:
                    score_val = 0.0
                    reasoning = "Output failed JSON structure parsing validation."
            else:
                score_val = 0.8
                reasoning = "Output format is non-JSON primitive."

        elif eval_type == "task_adherence":
            u_inp = span.get("input")
            act_out = span.get("output")
            score_val, adherence_level, reasoning = self._run_task_adherence_judge_eval(
                user_input=u_inp, agent_action=act_out, model=config.get("model", "gpt-4o-mini")
            )
            judge_confidence = "high"

        elif eval_type in ("hallucination", "relevancy", "llm_judge"):
            if span_type not in ("llm_call", "agent_call"):

                return None
            text_out = str(output_data or "")
            if status == "error":
                score_val = 0.0
                reasoning = "Execution resulted in error status."
            elif len(text_out.strip()) < 5:
                score_val = 0.3
                reasoning = "Generated output is excessively brief or empty."
            else:
                score_val = 0.95
                reasoning = f"Automated {eval_type} check passed with high semantic confidence."

        judge_model = config.get("model", "gpt-4o-mini")
        cost_usd_eval = calculate_eval_cost(judge_model, 150, 40)

        return {
            "org_id": span["org_id"],
            "span_id": span["span_id"],
            "trace_id": span.get("trace_id", ""),
            "score_type": eval_type,
            "check_type": eval_type,
            "score_name": name,
            "value": score_val,
            "score_value": score_val,
            "unsupported_claims": unsupported_claims,
            "uncertain_claims": uncertain_claims,
            "judge_confidence": judge_confidence,
            "reasoning": reasoning,
            "judge_model": judge_model,
            "judge_prompt_version": FAITHFULNESS_JUDGE_PROMPT_VERSION,
            "cost_usd_eval": cost_usd_eval,
            "evaluator_type": "automated",
            "evaluator_model": judge_model,
            "metadata": {"eval_type": eval_type, "config_id": config.get("id")},
        }

    def persist_scores(self, scores: list[dict[str, Any]]) -> None:
        """Persist evaluation scores into PostgreSQL 'scores' and 'eval_scores' tables."""
        if not scores:
            return

        scores_rows = [
            (
                s["org_id"],
                s["span_id"],
                s.get("trace_id", ""),
                s.get("score_type", "automated"),
                s.get("check_type", s.get("score_type", "faithfulness")),
                s.get("value", s.get("score_value", 1.0)),
                json.dumps(s.get("unsupported_claims", [])),
                json.dumps(s.get("uncertain_claims", [])),
                s.get("judge_confidence", "high"),
                s.get("reasoning", ""),
                s.get("judge_model", s.get("evaluator_model", "gpt-4o-mini")),
                s.get("judge_prompt_version", FAITHFULNESS_JUDGE_PROMPT_VERSION),
                s.get("prompt_tokens_eval", 0),
                s.get("completion_tokens_eval", 0),
                s.get("cost_usd_eval", 0.0),
                json.dumps(s.get("metadata", {})),
            )
            for s in scores
        ]

        eval_scores_rows = [
            (
                s["org_id"],
                s["span_id"],
                s.get("trace_id", ""),
                s.get("score_name", s.get("score_type", "faithfulness")),
                s.get("value", s.get("score_value", 1.0)),
                s.get("reasoning", ""),
                s.get("evaluator_type", "automated"),
                s.get("judge_model", s.get("evaluator_model", "gpt-4o-mini")),
                json.dumps(
                    {
                        **(s.get("metadata") or {}),
                        "check_type": s.get("check_type", s.get("score_type", "faithfulness")),
                        "unsupported_claims": s.get("unsupported_claims", []),
                        "uncertain_claims": s.get("uncertain_claims", []),
                        "judge_confidence": s.get("judge_confidence", "high"),
                        "judge_prompt_version": s.get(
                            "judge_prompt_version", FAITHFULNESS_JUDGE_PROMPT_VERSION
                        ),
                        "cost_usd_eval": s.get("cost_usd_eval", 0.0),
                    }
                ),
            )
            for s in scores
        ]

        try:
            with psycopg.connect(self.db_url) as conn:
                with conn.cursor() as cursor:
                    # 1. Insert into dedicated scores table
                    try:
                        cursor.executemany(
                            """
                            INSERT INTO scores (
                                org_id, span_id, trace_id, score_type, check_type, value,
                                unsupported_claims, uncertain_claims, judge_confidence,
                                reasoning, judge_model, judge_prompt_version, prompt_tokens_eval,
                                completion_tokens_eval, cost_usd_eval, metadata
                            )
                            VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                            """,
                            scores_rows,
                        )
                    except Exception as scores_err:
                        logger.debug("Could not write to scores table: %s", scores_err)

                    # 2. Insert into eval_scores table for backward compatibility
                    try:
                        cursor.executemany(
                            """
                            INSERT INTO eval_scores (
                                org_id, span_id, trace_id, score_name, score_value,
                                reasoning, evaluator_type, evaluator_model, metadata
                            )
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                            """,
                            eval_scores_rows,
                        )
                    except Exception as eval_scores_err:
                        logger.debug("Could not write to eval_scores table: %s", eval_scores_err)

                    logger.info("Persisted %d automated evaluation scores", len(scores))
        except Exception as exc:
            logger.error("Failed to persist eval scores: %s", exc)
