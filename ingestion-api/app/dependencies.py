"""Shared application state and FastAPI dependencies for AgentWatch Ingestion API."""

import hashlib
import os
from dataclasses import dataclass
from typing import Any

import asyncpg
from fastapi import Depends, HTTPException, Request, status
from redis.asyncio import Redis

STREAM = "spans:incoming"
RATE_LIMIT_SCRIPT = """
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return count
"""


class AppState:
    redis: Redis | None = None
    postgres: asyncpg.Pool | None = None
    clickhouse: Any = None
    memory_spans: list[dict[str, Any]] = []
    memory_audit_logs: list[dict[str, Any]] = []
    memory_eval_scores: list[dict[str, Any]] = []
    memory_eval_configs: list[dict[str, Any]] = []
    memory_prompts: dict[str, dict[str, Any]] = {}
    memory_prompt_versions: dict[str, list[dict[str, Any]]] = {}


state = AppState()
SPAN_BACKEND = os.getenv("SPAN_BACKEND", "redis").lower()
AUTH_DISABLED = os.getenv("AUTH_DISABLED", "false").lower() == "true"
RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", "600"))


@dataclass(frozen=True)
class ApiKey:
    org_id: str
    key_hash: str
    scopes: set[str]
    name: str | None = None


async def authenticate(request: Request) -> ApiKey:
    if AUTH_DISABLED:
        return ApiKey("development", "development", {"ingest", "unmask", "compliance"}, "Development Client")
    raw_key = request.headers.get("X-AgentWatch-Key")
    if not raw_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="X-AgentWatch-Key is required")
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    assert state.postgres is not None
    record = await state.postgres.fetchrow("SELECT org_id, scopes, name FROM api_keys WHERE key_hash = $1 AND revoked_at IS NULL", key_hash)
    if record is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")

    # Check if organization is throttled by Circuit Breaker
    org_id = str(record["org_id"])
    org_row = await state.postgres.fetchrow("SELECT is_throttled, throttled_reason FROM orgs WHERE id = $1", record["org_id"])
    if org_row and org_row.get("is_throttled"):
        reason = org_row.get("throttled_reason") or "Cost runaway circuit breaker tripped"
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Organization circuit breaker tripped: {reason}. Reset in dashboard settings.",
        )
    key_name = record.get("name") if "name" in record else "API Client"
    return ApiKey(org_id, key_hash, set(record["scopes"] or []), key_name)


async def enforce_rate_limit(request: Request, api_key: ApiKey = Depends(authenticate)) -> ApiKey:
    if state.redis is None:
        return api_key
    raw_key = request.headers.get("X-AgentWatch-Key", "development")
    bucket = hashlib.sha256(raw_key.encode()).hexdigest()
    count = await state.redis.eval(RATE_LIMIT_SCRIPT, 1, f"ratelimit:{bucket}", 60)
    if int(count) > RATE_LIMIT_PER_MINUTE:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Rate limit exceeded")
    return api_key
