"""Golden datasets, test cases, and CI regression testing router."""

import json
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.dependencies import ApiKey, authenticate, state

router = APIRouter(tags=["datasets", "test-runs"])


class GoldenCaseCreate(BaseModel):
    case_id: str
    input: Any
    eval_type: str = "exact"
    expected_output: Any = None
    expected_criteria: str | None = None


class GoldenDatasetCreate(BaseModel):
    name: str
    description: str | None = None
    cases: list[GoldenCaseCreate] = Field(default_factory=list)


class TestRunCreate(BaseModel):
    dataset_name: str
    git_commit: str | None = None
    git_branch: str | None = None
    total_cases: int
    passed_cases: int
    failed_cases: int
    has_regressions: bool = False
    results: list[dict[str, Any]] = Field(default_factory=list)


MOCK_CUSTOMER_SUPPORT_DATASET = {
    "id": 1,
    "org_id": "development",
    "name": "customer-support-v1",
    "description": "Core regression test suite for customer support, order lookups, and returns.",
    "created_at": "2026-08-20T10:00:00Z",
    "cases": [
        {
            "id": 1,
            "case_id": "cs_01_order_status",
            "eval_type": "exact",
            "input": {"query": "Where is my order #88921?"},
            "expected_output": {"status": "shipped", "tracking_number": "TRK-88921-IN", "eta_days": 2},
            "expected_criteria": None,
        },
        {
            "id": 2,
            "case_id": "cs_02_return_policy",
            "eval_type": "semantic",
            "input": {"query": "What is the return window for electronics?"},
            "expected_output": "Items can be returned within 30 days of delivery with original packaging and invoice.",
            "expected_criteria": None,
        },
        {
            "id": 3,
            "case_id": "cs_03_refund_escalation",
            "eval_type": "llm_judge",
            "input": {"query": "I was double charged on my card! Fix this immediately."},
            "expected_output": None,
            "expected_criteria": "Must apologize for the inconvenience, confirm refund request within 3-5 business days, and provide support ticket reference.",
        },
    ],
}


@router.get("/v1/datasets")
async def list_datasets(api_key: ApiKey = Depends(authenticate)) -> dict[str, Any]:
    """List all golden evaluation datasets."""
    if state.postgres is not None:
        rows = await state.postgres.fetch(
            "SELECT id, org_id, name, description, created_at FROM golden_datasets WHERE org_id = $1 ORDER BY created_at DESC",
            api_key.org_id,
        )
        if rows:
            return {"data": [dict(r) for r in rows]}

    return {
        "data": [
            {
                "id": 1,
                "org_id": api_key.org_id,
                "name": "customer-support-v1",
                "description": "Core regression test suite for customer support, order lookups, and returns.",
                "total_cases": 3,
                "created_at": "2026-08-20T10:00:00Z",
            }
        ]
    }


@router.get("/v1/datasets/{dataset_name}")
async def get_dataset(dataset_name: str, api_key: ApiKey = Depends(authenticate)) -> dict[str, Any]:
    """Fetch golden dataset with all test cases."""
    if state.postgres is not None:
        ds_row = await state.postgres.fetchrow(
            "SELECT id, org_id, name, description, created_at FROM golden_datasets WHERE org_id = $1 AND name = $2",
            api_key.org_id,
            dataset_name,
        )
        if ds_row:
            cases_rows = await state.postgres.fetch(
                "SELECT id, case_id, input, eval_type, expected_output, expected_criteria FROM golden_cases WHERE dataset_id = $1 ORDER BY id ASC",
                ds_row["id"],
            )
            data = dict(ds_row)
            data["cases"] = [dict(c) for c in cases_rows]
            return {"data": data}

    return {"data": MOCK_CUSTOMER_SUPPORT_DATASET}


@router.post("/v1/datasets")
async def create_dataset(payload: GoldenDatasetCreate, api_key: ApiKey = Depends(authenticate)) -> dict[str, Any]:
    """Create a golden evaluation dataset with test cases."""
    if state.postgres is not None:
        async with state.postgres.acquire() as conn:
            async with conn.transaction():
                ds_row = await conn.fetchrow(
                    "INSERT INTO golden_datasets (org_id, name, description) VALUES ($1, $2, $3) RETURNING id, name",
                    api_key.org_id,
                    payload.name,
                    payload.description,
                )
                ds_id = ds_row["id"]
                for c in payload.cases:
                    await conn.execute(
                        """
                        INSERT INTO golden_cases (dataset_id, case_id, input, eval_type, expected_output, expected_criteria)
                        VALUES ($1, $2, $3::jsonb, $4, $5::jsonb, $6)
                        """,
                        ds_id,
                        c.case_id,
                        json.dumps(c.input),
                        c.eval_type,
                        json.dumps(c.expected_output) if c.expected_output is not None else None,
                        c.expected_criteria,
                    )
                return {"status": "created", "dataset_id": ds_id, "name": payload.name}

    return {"status": "created", "dataset_id": 99, "name": payload.name}


@router.get("/v1/test-runs/latest")
async def get_latest_test_run(dataset_name: str, api_key: ApiKey = Depends(authenticate)) -> dict[str, Any]:
    """Fetch previous test run for regression detection."""
    if state.postgres is not None:
        row = await state.postgres.fetchrow(
            """
            SELECT id, org_id, dataset_name, git_commit, git_branch, total_cases, passed_cases, failed_cases, has_regressions, results, created_at
            FROM test_runs
            WHERE org_id = $1 AND dataset_name = $2
            ORDER BY created_at DESC
            LIMIT 1
            """,
            api_key.org_id,
            dataset_name,
        )
        if row:
            return {"data": dict(row)}

    return {
        "data": {
            "id": 10,
            "dataset_name": dataset_name,
            "git_commit": "a1b2c3d",
            "git_branch": "main",
            "total_cases": 3,
            "passed_cases": 3,
            "failed_cases": 0,
            "has_regressions": False,
            "results": [
                {"case_id": "cs_01_order_status", "passed": True, "score": 1.0},
                {"case_id": "cs_02_return_policy", "passed": True, "score": 0.95},
                {"case_id": "cs_03_refund_escalation", "passed": True, "score": 1.0},
            ],
            "created_at": "2026-08-23T08:00:00Z",
        }
    }


@router.get("/v1/test-runs")
async def list_test_runs(dataset_name: str | None = None, api_key: ApiKey = Depends(authenticate)) -> dict[str, Any]:
    """List historical CI and pre-deploy test runs."""
    if state.postgres is not None:
        query = "SELECT id, org_id, dataset_name, git_commit, git_branch, total_cases, passed_cases, failed_cases, has_regressions, created_at FROM test_runs WHERE org_id = $1"
        params: list[Any] = [api_key.org_id]
        if dataset_name:
            query += " AND dataset_name = $2"
            params.append(dataset_name)
        query += " ORDER BY created_at DESC LIMIT 50"
        rows = await state.postgres.fetch(query, *params)
        return {"data": [dict(r) for r in rows]}

    return {
        "data": [
            {
                "id": 102,
                "org_id": api_key.org_id,
                "dataset_name": "customer-support-v1",
                "git_commit": "742f9cb",
                "git_branch": "feature/refund-flow",
                "total_cases": 3,
                "passed_cases": 3,
                "failed_cases": 0,
                "has_regressions": False,
                "created_at": "2026-08-23T09:30:00Z",
            },
            {
                "id": 101,
                "org_id": api_key.org_id,
                "dataset_name": "customer-support-v1",
                "git_commit": "e89d12a",
                "git_branch": "main",
                "total_cases": 3,
                "passed_cases": 3,
                "failed_cases": 0,
                "has_regressions": False,
                "created_at": "2026-08-23T08:00:00Z",
            },
        ]
    }


@router.post("/v1/test-runs")
async def record_test_run(payload: TestRunCreate, api_key: ApiKey = Depends(authenticate)) -> dict[str, Any]:
    """Record a test run execution."""
    if state.postgres is not None:
        row = await state.postgres.fetchrow(
            """
            INSERT INTO test_runs (org_id, dataset_name, git_commit, git_branch, total_cases, passed_cases, failed_cases, has_regressions, results)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
            RETURNING id, dataset_name, passed_cases, failed_cases, has_regressions, created_at
            """,
            api_key.org_id,
            payload.dataset_name,
            payload.git_commit,
            payload.git_branch,
            payload.total_cases,
            payload.passed_cases,
            payload.failed_cases,
            payload.has_regressions,
            json.dumps(payload.results),
        )
        return {"status": "recorded", "data": dict(row) if row else {}}
    return {"status": "recorded", "id": 103}
