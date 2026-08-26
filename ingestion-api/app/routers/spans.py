"""Spans ingestion and unmasking router."""

import asyncio
import json
import os
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from cryptography.fernet import Fernet
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, model_validator

from app.dependencies import (
    AUTH_DISABLED,
    SPAN_BACKEND,
    STREAM,
    ApiKey,
    authenticate,
    enforce_rate_limit,
    state,
)

router = APIRouter(tags=["spans"])


class SpanType(str, Enum):
    llm_call = "llm_call"
    tool_call = "tool_call"
    agent_call = "agent_call"


class SpanStatus(str, Enum):
    success = "success"
    error = "error"


class Span(BaseModel):
    trace_id: str = Field(min_length=1, max_length=64)
    span_id: str = Field(min_length=1, max_length=32)
    parent_span_id: str | None = Field(default=None, max_length=32)
    agent_id: str = Field(min_length=1, max_length=255)
    parent_agent_id: str | None = Field(default=None, max_length=255)
    org_id: str = Field(min_length=1, max_length=255)
    session_id: str | None = Field(default=None, max_length=255)
    user_id: str | None = Field(default=None, max_length=255)
    end_user_id: str | None = Field(default=None, max_length=255)
    consent_id: str | None = Field(default=None, max_length=255)
    name: str = Field(min_length=1, max_length=1_024)
    span_type: SpanType
    input: Any = None
    output: Any = None
    model: str | None = Field(default=None, max_length=255)
    prompt_tokens: int | None = Field(default=None, ge=0)
    completion_tokens: int | None = Field(default=None, ge=0)
    cost_usd: float | None = Field(default=None, ge=0)
    latency_ms: int | None = Field(default=None, ge=0)
    injection_risk_score: float | None = Field(default=None, ge=0.0, le=1.0)
    injection_flags: list[str] = Field(default_factory=list)
    status: SpanStatus
    error_message: str | None = Field(default=None, max_length=8_192)
    started_at: datetime
    ended_at: datetime
    metadata: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def timestamps_are_ordered(self) -> "Span":
        if self.ended_at < self.started_at:
            raise ValueError("ended_at must not be before started_at")
        return self


class SpanBatch(BaseModel):
    spans: list[Span] = Field(min_length=1, max_length=1_000)


@router.post("/v1/spans", status_code=status.HTTP_202_ACCEPTED)
async def ingest_spans(batch: SpanBatch, api_key: ApiKey = Depends(enforce_rate_limit)) -> dict[str, int | str]:
    """Validate then durably enqueue. ClickHouse work always happens in the worker."""
    payloads = [span.model_dump(mode="json") for span in batch.spans]
    if not AUTH_DISABLED and "ingest" not in api_key.scopes:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="API key lacks ingest scope")
    if not AUTH_DISABLED and any(span["org_id"] != api_key.org_id for span in payloads):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="API key cannot submit spans for another organization")
    if SPAN_BACKEND == "memory":
        state.memory_spans.extend(payloads)
        return {"status": "accepted", "accepted": len(payloads)}
    assert state.redis is not None
    await asyncio.gather(*(state.redis.xadd(STREAM, {"span": json.dumps(payload)}) for payload in payloads))
    return {"status": "accepted", "accepted": len(payloads)}


@router.get("/v1/spans")
async def list_memory_spans() -> list[dict[str, Any]]:
    """Development-only in-memory inspection endpoint."""
    return state.memory_spans


@router.post("/v1/spans/{span_id}/unmask")
async def unmask_span(span_id: str, api_key: ApiKey = Depends(authenticate)) -> dict[str, Any]:
    """Return authorized replacements; callers apply them to the masked span payload."""
    if not AUTH_DISABLED and "unmask" not in api_key.scopes:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="API key lacks unmask scope")
    fernet_key = os.getenv("PII_FERNET_KEY")
    if not fernet_key:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="PII unmasking is not configured")
    if state.postgres is None:
        state.memory_audit_logs.append({
            "id": len(state.memory_audit_logs) + 1,
            "org_id": api_key.org_id,
            "api_key_hash": api_key.key_hash,
            "action": "unmask",
            "span_id": span_id,
            "details": "{}",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"span_id": span_id, "replacements": {}}
    records = await state.postgres.fetch("SELECT token, encrypted_value FROM pii_mappings WHERE org_id = $1 AND span_id = $2", api_key.org_id, span_id)
    replacements = {record["token"]: Fernet(fernet_key.encode()).decrypt(record["encrypted_value"].encode()).decode() for record in records}
    await state.postgres.execute("INSERT INTO audit_log (org_id, api_key_hash, action, span_id) VALUES ($1, $2, 'unmask', $3)", api_key.org_id, api_key.key_hash, span_id)
    return {"span_id": span_id, "replacements": replacements}
