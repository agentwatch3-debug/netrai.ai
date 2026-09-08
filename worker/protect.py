"""Response-gating and eval-gate policy enforcement module for AgentWatch worker."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Any

import psycopg

from .eval_engine import (
    FAITHFULNESS_JUDGE_PROMPT_VERSION,
    FACTUALITY_JUDGE_PROMPT_VERSION,
    EvalEngine,
    calculate_eval_cost,
    extract_retrieved_context,
)

logger = logging.getLogger("agentwatch.protect")


@dataclass
class ResponseGateResult:
    is_passed: bool
    score: float
    score_type: str
    action_taken: str  # "passed" | "blocked" | "flagged" | "reroute_to_model"
    threshold: float
    unsupported_claims: list[str] = field(default_factory=list)
    uncertain_claims: list[str] = field(default_factory=list)
    fallback_model: str | None = None
    reasoning: str = ""
    judge_model: str = "gpt-4o-mini"
    cost_usd_eval: float = 0.0


class ProtectEngine:
    def __init__(self, db_url: str | None = None) -> None:
        self.db_url = db_url or os.getenv(
            "DATABASE_URL",
            "postgresql://agentwatch:agentwatch@localhost:5432/agentwatch",
        )
        self.eval_engine = EvalEngine(self.db_url)

    def fetch_rules(self, org_id: str, agent_id: str | None = None) -> list[dict[str, Any]]:
        """Fetch active evaluation gating rules for the organization and target agent."""
        try:
            with psycopg.connect(self.db_url) as conn:
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT id, score_type, threshold, action, fallback_model
                        FROM eval_gate_rules
                        WHERE org_id = %s AND is_enabled = TRUE
                          AND (agent_id = %s OR agent_id = '*' OR agent_id IS NULL)
                        ORDER BY id ASC
                        """,
                        (org_id, agent_id or "*"),
                    )
                    rows = cursor.fetchall()
                    return [
                        {
                            "id": r[0],
                            "score_type": r[1],
                            "threshold": float(r[2]),
                            "action": r[3],
                            "fallback_model": r[4],
                        }
                        for r in rows
                    ]
        except Exception as exc:
            logger.debug("Failed to fetch eval gate rules from database: %s", exc)
            return []

    def evaluate_response(
        self,
        response_text: str,
        context_text: str | None = None,
        rules: list[dict[str, Any]] | None = None,
        org_id: str | None = None,
        agent_id: str | None = None,
        default_score_type: str | None = None,
        default_threshold: float = 0.7,
        default_action: str = "block",
        default_fallback_model: str | None = None,
        judge_model: str = "gpt-4o-mini",
    ) -> ResponseGateResult:
        """Evaluate generated output against eval gate policies.

        Runs faithfulness check if context is provided, or factuality check for closed-book responses.
        Enforces configured threshold with actions: 'block', 'flag', or 'reroute_to_model'.
        """
        active_rules = rules or []
        if not active_rules and org_id:
            active_rules = self.fetch_rules(org_id, agent_id)

        # Fallback to default rule if no database rule configured
        if not active_rules:
            active_rules = [
                {
                    "score_type": default_score_type or ("faithfulness" if context_text else "factuality"),
                    "threshold": default_threshold,
                    "action": default_action,
                    "fallback_model": default_fallback_model,
                }
            ]

        # Use highest priority matching rule
        rule = active_rules[0]
        score_type = rule.get("score_type") or ("faithfulness" if context_text else "factuality")
        threshold = float(rule.get("threshold", 0.7))
        action = rule.get("action", "block")
        fallback_model = rule.get("fallback_model") or default_fallback_model

        if score_type == "faithfulness" and context_text:
            score, unsupported, reasoning = self.eval_engine._run_faithfulness_judge_eval(
                context=context_text, output=response_text, model=judge_model
            )
            uncertain: list[str] = []
        else:
            score, unsupported, uncertain, _, reasoning = (
                self.eval_engine._run_factuality_judge_eval(
                    output=response_text, model=judge_model
                )
            )

        prompt_tokens = max(1, (len(context_text or "") + len(response_text)) // 4)
        completion_tokens = max(1, len(reasoning) // 4)
        eval_cost = calculate_eval_cost(judge_model, prompt_tokens, completion_tokens)

        is_passed = score >= threshold
        action_taken = "passed" if is_passed else action

        return ResponseGateResult(
            is_passed=is_passed,
            score=score,
            score_type=score_type,
            action_taken=action_taken,
            threshold=threshold,
            unsupported_claims=unsupported,
            uncertain_claims=uncertain,
            fallback_model=fallback_model,
            reasoning=reasoning,
            judge_model=judge_model,
            cost_usd_eval=eval_cost,
        )


def evaluate_response_gate(
    response_text: str,
    context_text: str | None = None,
    score_type: str | None = None,
    threshold: float = 0.7,
    action: str = "block",
    fallback_model: str | None = None,
    judge_model: str = "gpt-4o-mini",
) -> ResponseGateResult:
    """Helper function to perform standalone inline response gating verification."""
    engine = ProtectEngine()
    return engine.evaluate_response(
        response_text=response_text,
        context_text=context_text,
        default_score_type=score_type,
        default_threshold=threshold,
        default_action=action,
        default_fallback_model=fallback_model,
        judge_model=judge_model,
    )
