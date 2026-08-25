"""Evals domain models and evaluation score management."""

from datetime import datetime, timezone
from typing import Any
from pydantic import BaseModel, Field


class EvalScoreSubmission(BaseModel):
    span_id: str = Field(min_length=1, max_length=64)
    trace_id: str = Field(default="", max_length=64)
    score_name: str = Field(min_length=1, max_length=128)
    score_value: float = Field(ge=-1.0, le=1.0)
    reasoning: str | None = Field(default=None, max_length=4096)
    evaluator_type: str = Field(default="automated", pattern="^(automated|human|rule)$")
    evaluator_model: str | None = Field(default=None, max_length=128)
    metadata: dict[str, Any] = Field(default_factory=dict)


class EvalConfigCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    eval_type: str = Field(pattern="^(llm_judge|hallucination|relevancy|tool_correctness|json_validity)$")
    target_agent_id: str | None = Field(default=None, max_length=255)
    model: str = Field(default="gpt-4.1-mini", max_length=128)
    prompt_template: str | None = Field(default=None, max_length=4096)
    sampling_rate: float = Field(default=1.0, ge=0.0, le=1.0)
    is_active: bool = True
