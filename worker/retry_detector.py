"""Session Retry & Misunderstanding Loop Detection Engine.

Detects multi-turn sessions where users repeatedly rephrase their requests or
where tools are repeatedly called with differing arguments without achieving
a successful task completion.
"""

import json
import logging
import math
import re
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger("agentwatch.retry_detector")

STOPWORDS = {
    "a", "an", "the", "and", "or", "to", "of", "for", "in", "on", "at", "by",
    "is", "it", "this", "that", "my", "i", "you", "me", "please", "no", "yes",
    "can", "do", "did", "have", "with", "from", "so"
}


def tokenize_and_vectorize(text: str) -> dict[str, float]:
    """Convert text into normalized term and sub-word n-gram frequency vector."""
    words = re.findall(r"[a-zA-Z0-9]+", text.lower())
    if not words:
        return {}

    tokens: list[str] = []
    for w in words:
        if w not in STOPWORDS:
            tokens.append(w)
            if len(w) >= 3:
                for i in range(len(w) - 2):
                    tokens.append(w[i : i + 3])

    if not tokens:
        tokens = words

    counts = Counter(tokens)
    magnitude = math.sqrt(sum(c * c for c in counts.values()))
    if magnitude == 0.0:
        return {}

    return {k: v / magnitude for k, v in counts.items()}


def compute_semantic_similarity(text1: str, text2: str) -> float:
    """Compute cosine similarity between two text strings using n-gram vector representations."""
    if not text1 or not text2:
        return 0.0

    v1 = tokenize_and_vectorize(text1)
    v2 = tokenize_and_vectorize(text2)

    if not v1 or not v2:
        return 0.0

    # Dot product of normalized vectors
    dot_product = sum(v1[k] * v2[k] for k in v1 if k in v2)
    return round(max(0.0, min(1.0, dot_product)), 4)


@dataclass
class SessionTurn:
    turn_index: int
    trace_id: str
    user_message: str
    assistant_message: Optional[str] = None
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    tokens: int = 0
    cost_usd: float = 0.0
    status: str = "success"
    task_completed: bool = False


@dataclass
class MisunderstandingLoopAlert:
    org_id: str
    session_id: str
    agent_id: str
    user_id: Optional[str]
    retry_count: int
    total_tokens_in_loop: int
    total_cost_in_loop: float
    loop_type: str  # "misunderstanding_loop" | "tool_arg_thrashing"
    similarity_scores: list[float]
    sample_rephrasings: list[str]
    tool_thrashing_detected: bool
    task_completed: bool
    flagged_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class RetryLoopDetector:
    """Analyzes session turn sequences for user rephrasing patterns, tool thrashing, and confusion loops."""

    def __init__(
        self,
        similarity_threshold: float = 0.55,
        min_rephrase_turns: int = 3,
        postgres_pool: Any = None,
    ) -> None:
        self.similarity_threshold = similarity_threshold
        self.min_rephrase_turns = min_rephrase_turns
        self.postgres_pool = postgres_pool

    def analyze_session(
        self,
        org_id: str,
        session_id: str,
        turns: list[dict[str, Any]],
        agent_id: str = "agent",
        user_id: Optional[str] = None,
    ) -> Optional[MisunderstandingLoopAlert]:
        """Analyze turns in a session to identify if a misunderstanding loop occurred."""
        if len(turns) < self.min_rephrase_turns:
            return None

        user_messages: list[str] = []
        turn_costs: list[float] = []
        turn_tokens: list[int] = []
        tool_invocations: list[tuple[str, str]] = []  # (tool_name, json_args)
        has_task_completion = False

        for t in turns:
            u_msg = str(t.get("user_message") or t.get("input") or "")
            user_messages.append(u_msg)
            turn_costs.append(float(t.get("cost_usd") or t.get("total_cost") or 0.0))
            turn_tokens.append(int(t.get("tokens") or t.get("total_tokens") or 0))

            # Check outcome flags
            meta = t.get("metadata") or {}
            if (
                t.get("task_completed")
                or meta.get("ticket_resolved")
                or meta.get("goal_achieved")
                or meta.get("outcome_success")
            ):
                has_task_completion = True

            # Extract tool calls
            calls = t.get("tool_calls") or []
            for c in calls:
                tool_name = c.get("name") or c.get("tool_name") or ""
                inp = c.get("input") or c.get("arguments") or {}
                inp_str = json.dumps(inp, sort_keys=True) if isinstance(inp, dict) else str(inp)
                if tool_name:
                    tool_invocations.append((tool_name, inp_str))

        # 1. Compute pairwise consecutive similarities between user turns
        similarities: list[float] = []
        for i in range(len(user_messages) - 1):
            sim = compute_semantic_similarity(user_messages[i], user_messages[i + 1])
            similarities.append(sim)

        # 2. Check for tool argument thrashing: same tool called with differing arguments 3+ times
        tool_thrashing = False
        tool_name_counts: Counter[str] = Counter()
        for name, _ in tool_invocations:
            tool_name_counts[name] += 1

        for tool_name, count in tool_name_counts.items():
            if count >= 3:
                # Check if arguments differed
                args_set = {args for name, args in tool_invocations if name == tool_name}
                if len(args_set) >= 2:
                    tool_thrashing = True
                    break

        # 3. Check for consecutive rephrasing sequence
        consecutive_high_sim = 0
        max_consecutive_high_sim = 0
        loop_indices: list[int] = []

        for i, sim in enumerate(similarities):
            if sim >= self.similarity_threshold:
                consecutive_high_sim += 1
                if consecutive_high_sim > max_consecutive_high_sim:
                    max_consecutive_high_sim = consecutive_high_sim
                if i not in loop_indices:
                    loop_indices.append(i)
                if (i + 1) not in loop_indices:
                    loop_indices.append(i + 1)
            else:
                consecutive_high_sim = 0

        # Flag misunderstanding loop if:
        # (3+ turns show high similarity OR tool thrashing with 3+ turns) AND no task completion recorded
        is_misunderstanding_loop = (
            (max_consecutive_high_sim >= (self.min_rephrase_turns - 1) or (tool_thrashing and len(turns) >= self.min_rephrase_turns))
            and not has_task_completion
        )

        if not is_misunderstanding_loop:
            return None

        # Compute wasted resources in loop
        if loop_indices and len(loop_indices) >= self.min_rephrase_turns:
            total_cost_in_loop = sum(turn_costs[idx] for idx in loop_indices if idx < len(turn_costs))
            total_tokens_in_loop = sum(turn_tokens[idx] for idx in loop_indices if idx < len(turn_tokens))
            rephrasings = [user_messages[idx] for idx in loop_indices if idx < len(user_messages) and user_messages[idx]]
        else:
            total_cost_in_loop = sum(turn_costs)
            total_tokens_in_loop = sum(turn_tokens)
            rephrasings = [m for m in user_messages if m]

        loop_type = "misunderstanding_loop" if not tool_thrashing else "tool_arg_thrashing"

        return MisunderstandingLoopAlert(
            org_id=org_id,
            session_id=session_id,
            agent_id=agent_id,
            user_id=user_id,
            retry_count=len(rephrasings),
            total_tokens_in_loop=total_tokens_in_loop,
            total_cost_in_loop=round(total_cost_in_loop, 4),
            loop_type=loop_type,
            similarity_scores=similarities,
            sample_rephrasings=rephrasings,
            tool_thrashing_detected=tool_thrashing,
            task_completed=has_task_completion,
        )

    async def record_loop_alert(self, alert: MisunderstandingLoopAlert) -> None:
        """Persist detected misunderstanding loop into session_quality PostgreSQL table."""
        if self.postgres_pool is not None:
            try:
                await self.postgres_pool.execute(
                    """
                    INSERT INTO session_quality (
                        org_id, session_id, agent_id, user_id, retry_count,
                        total_tokens_in_loop, total_cost_in_loop, loop_type,
                        similarity_scores, sample_rephrasings, tool_thrashing_detected,
                        task_completed, flagged_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12, NOW())
                    ON CONFLICT (session_id) DO UPDATE SET
                        retry_count = EXCLUDED.retry_count,
                        total_tokens_in_loop = EXCLUDED.total_tokens_in_loop,
                        total_cost_in_loop = EXCLUDED.total_cost_in_loop,
                        similarity_scores = EXCLUDED.similarity_scores,
                        sample_rephrasings = EXCLUDED.sample_rephrasings,
                        flagged_at = NOW()
                    """,
                    alert.org_id,
                    alert.session_id,
                    alert.agent_id,
                    alert.user_id,
                    alert.retry_count,
                    alert.total_tokens_in_loop,
                    alert.total_cost_in_loop,
                    alert.loop_type,
                    json.dumps(alert.similarity_scores),
                    json.dumps(alert.sample_rephrasings),
                    alert.tool_thrashing_detected,
                    alert.task_completed,
                )
            except Exception as e:
                logger.warning("Failed storing session quality record: %s", e)
