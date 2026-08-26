"""HTTP edge for AgentWatch span ingestion and observability APIs."""

import os
from contextlib import asynccontextmanager

import asyncpg
from fastapi import FastAPI
from redis.asyncio import Redis

from app.dependencies import (
    AUTH_DISABLED,
    RATE_LIMIT_PER_MINUTE,
    RATE_LIMIT_SCRIPT,
    SPAN_BACKEND,
    STREAM,
    ApiKey,
    AppState,
    authenticate,
    enforce_rate_limit,
    state,
)
from app.routers.agents import router as agents_router
from app.routers.alerts import router as alerts_router
from app.routers.billing import router as billing_router
from app.routers.circuit_breaker import router as circuit_breaker_router
from app.routers.consents import router as consents_router
from app.routers.datasets import router as datasets_router
from app.routers.evals import router as evals_router
from app.routers.organizations import router as organizations_router
from app.routers.policies import router as policies_router
from app.routers.prompts import router as prompts_router
from app.routers.quotas import router as quotas_router
from app.routers.security import router as security_router
from app.routers.sessions import router as sessions_router
from app.routers.spans import (
    Span,
    SpanBatch,
    SpanStatus,
    SpanType,
    router as spans_router,
)
from app.startup_checks import run_startup_checks


@asynccontextmanager
async def lifespan(_: FastAPI):
    run_startup_checks()
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    if SPAN_BACKEND == "redis" or not AUTH_DISABLED:
        state.redis = Redis.from_url(redis_url, decode_responses=True)
    if not AUTH_DISABLED:
        state.postgres = await asyncpg.create_pool(
            os.getenv("DATABASE_URL", "postgresql://agentwatch:agentwatch@localhost:5432/agentwatch")
        )
    yield
    if state.redis:
        await state.redis.aclose()
    if state.postgres:
        await state.postgres.close()


app = FastAPI(title="AgentWatch Ingestion API", lifespan=lifespan)


@app.get("/healthz")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok", "backend": SPAN_BACKEND}


# Register all modular domain routers
app.include_router(spans_router)
app.include_router(billing_router)
app.include_router(policies_router)
app.include_router(alerts_router)
app.include_router(evals_router)
app.include_router(prompts_router)
app.include_router(sessions_router)
app.include_router(circuit_breaker_router)
app.include_router(security_router)
app.include_router(consents_router)
app.include_router(agents_router)
app.include_router(datasets_router)
app.include_router(quotas_router)
app.include_router(organizations_router)

__all__ = [
    "app",
    "state",
    "AppState",
    "ApiKey",
    "authenticate",
    "enforce_rate_limit",
    "SPAN_BACKEND",
    "AUTH_DISABLED",
    "STREAM",
    "RATE_LIMIT_PER_MINUTE",
    "RATE_LIMIT_SCRIPT",
    "Span",
    "SpanBatch",
    "SpanType",
    "SpanStatus",
]
