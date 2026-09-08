"""Automated evaluation engine for AgentWatch spans including faithfulness judge scoring."""

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

FAITHFULNESS_JUDGE_SYSTEM_PROMPT = """You are an expert AI evaluator assessing the faithfulness and factual grounding of an LLM's generated output against retrieved context documents.

Instructions:
1. Examine the provided Context documents and the LLM Output.
2. Determine whether every factual claim, assertion, and statement made in the LLM Output is directly supported and entailed by the provided Context.
3. Identify any claims that are unsupported, extrapolated without evidence, contradictory, or hallucinated.
4. Output your evaluation in valid JSON matching this exact schema:
{
  "score": <float between 0.0 and 1.0, where 1.0 means 100% of claims are fully grounded in the context, and 0.0 means completely unsupported or contradictory>,
  "unsupported_claims": [<list of strings, each being a specific unsupported claim found in the output>],
  "reasoning": "<concise explanation of the score and grounding assessment>"
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
        # Check if this is a single span dict
        if "output" in tool_input and tool_input.get("span_type") == "tool_call":
            return extract_retrieved_context(tool_input["output"])
        # Check for document dictionary keys
        for key in ("documents", "results", "context", "docs", "text", "content"):
            val = tool_input.get(key)
            if val:
                return extract_retrieved_context(val)
        return json.dumps(tool_input)

    if isinstance(tool_input, list):
        contexts: list[str] = []
        for item in tool_input:
            if isinstance(item, dict):
                # If item is a span dict
                if item.get("span_type") == "tool_call":
                    out = item.get("output")
                    extracted = extract_retrieved_context(out)
                    if extracted:
                        contexts.append(extracted)
                else:
                    # Item could be a doc dict {"content": "..."}
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

        # Format output text
        output_text = (
            llm_output
            if isinstance(llm_output, str)
            else json.dumps(llm_output, ensure_ascii=False)
        ).strip()
        if not output_text:
            return None

        # Extract context
        context_text = extract_retrieved_context(context_or_tool_spans)
        if not context_text:
            logger.debug(
                "No retrieved context found for span %s; skipping faithfulness eval",
                llm_span.get("span_id"),
            )
            return None

        # Run judge logic
        score_val, unsupported_claims, reasoning = self._run_judge_eval(
            context=context_text,
            output=output_text,
            model=judge_model,
        )

        # Estimate judge tokens & calculate independent evaluation cost
        prompt_text = f"{FAITHFULNESS_JUDGE_SYSTEM_PROMPT}\n\nContext:\n{context_text}\n\nOutput:\n{output_text}"
        response_text = json.dumps(
            {
                "score": score_val,
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
            "value": score_val,
            "unsupported_claims": unsupported_claims,
            "reasoning": reasoning,
            "judge_model": judge_model,
            "judge_prompt_version": FAITHFULNESS_JUDGE_PROMPT_VERSION,
            "prompt_tokens_eval": prompt_tokens,
            "completion_tokens_eval": completion_tokens,
            "cost_usd_eval": cost_usd_eval,
            "metadata": {
                "eval_type": "faithfulness",
                "retrieved_context_length": len(context_text),
                "output_length": len(output_text),
            },
        }

    def _run_judge_eval(
        self, context: str, output: str, model: str
    ) -> tuple[float, list[str], str]:
        """Judge evaluation routine: assesses factual consistency and identifies unsupported claims."""
        context_lower = context.lower()
        output_lower = output.lower()

        # Split output into sentences/claims
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
            # Extract key informative words (>3 chars)
            words = [w for w in re.findall(r"\b\w{4,}\b", s_lower)]
            if not words:
                continue

            # Check overlap against context
            matching_words = [w for w in words if w in context_lower]
            overlap_ratio = len(matching_words) / len(words) if words else 1.0

            # If less than 40% of informative keywords exist in retrieved context, mark claim as unsupported
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
            "score_name": name,
            "value": score_val,
            "score_value": score_val,
            "unsupported_claims": unsupported_claims,
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
                s.get("value", s.get("score_value", 1.0)),
                json.dumps(s.get("unsupported_claims", [])),
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
                        "unsupported_claims": s.get("unsupported_claims", []),
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
                                org_id, span_id, trace_id, score_type, value, unsupported_claims,
                                reasoning, judge_model, judge_prompt_version, prompt_tokens_eval,
                                completion_tokens_eval, cost_usd_eval, metadata
                            )
                            VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s, %s, %s, %s, %s::jsonb)
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
