"""Prompt templates, version control, and template compilation router."""

import json
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.dependencies import ApiKey, authenticate, state
from app.prompts import (
    PromptCompileRequest,
    PromptCreate,
    PromptVersionCreate,
    compile_template,
)

router = APIRouter(tags=["prompts"])


@router.get("/v1/prompts")
async def list_prompts(api_key: ApiKey = Depends(authenticate)) -> list[dict[str, Any]]:
    """List all prompt templates for the organization with production and latest version metadata."""
    if state.postgres is not None:
        rows = await state.postgres.fetch(
            """
            SELECT
                p.id,
                p.name,
                p.description,
                p.tags,
                p.created_at,
                p.updated_at,
                COALESCE(MAX(pv.version), 1) as latest_version,
                (
                    SELECT pv2.version
                    FROM prompt_versions pv2
                    WHERE pv2.prompt_id = p.id AND 'production' = ANY(pv2.labels)
                    ORDER BY pv2.version DESC LIMIT 1
                ) as production_version,
                (
                    SELECT pv3.model
                    FROM prompt_versions pv3
                    WHERE pv3.prompt_id = p.id
                    ORDER BY pv3.version DESC LIMIT 1
                ) as model
            FROM prompts p
            LEFT JOIN prompt_versions pv ON pv.prompt_id = p.id
            WHERE p.org_id = $1
            GROUP BY p.id, p.name, p.description, p.tags, p.created_at, p.updated_at
            ORDER BY p.updated_at DESC
            """,
            api_key.org_id,
        )
        return [dict(r) for r in rows]

    # In-memory fallback
    org_prompts = [p for p in state.memory_prompts.values() if p.get("org_id") == api_key.org_id]
    if not org_prompts:
        return [
            {
                "id": 1,
                "name": "customer_support_system",
                "description": "Primary persona and guardrail prompt for customer triage agent.",
                "tags": ["support", "production"],
                "latest_version": 2,
                "production_version": 2,
                "model": "gpt-4.1-mini",
                "created_at": "2026-08-20T10:00:00Z",
                "updated_at": "2026-08-22T12:00:00Z",
            },
            {
                "id": 2,
                "name": "sql_generator",
                "description": "Text-to-SQL generation prompt with strict table schema isolation.",
                "tags": ["sql", "rag"],
                "latest_version": 3,
                "production_version": 2,
                "model": "claude-3-5-haiku",
                "created_at": "2026-08-21T09:30:00Z",
                "updated_at": "2026-08-23T08:15:00Z",
            },
        ]
    return org_prompts


@router.post("/v1/prompts", status_code=status.HTTP_201_CREATED)
async def create_prompt(prompt: PromptCreate, api_key: ApiKey = Depends(authenticate)) -> dict[str, Any]:
    """Create a new prompt template slug."""
    if state.postgres is not None:
        row = await state.postgres.fetchrow(
            """
            INSERT INTO prompts (org_id, name, description, tags)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (org_id, name) DO UPDATE SET description = EXCLUDED.description, tags = EXCLUDED.tags, updated_at = NOW()
            RETURNING id, org_id, name, description, tags, created_at, updated_at
            """,
            api_key.org_id,
            prompt.name,
            prompt.description,
            prompt.tags,
        )
        return dict(row)

    key = f"{api_key.org_id}:{prompt.name}"
    p_dict = {
        "id": len(state.memory_prompts) + 1,
        "org_id": api_key.org_id,
        "name": prompt.name,
        "description": prompt.description,
        "tags": prompt.tags,
        "latest_version": 1,
        "production_version": 1,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    state.memory_prompts[key] = p_dict
    return p_dict


@router.get("/v1/prompts/{name}")
async def get_prompt_with_versions(name: str, api_key: ApiKey = Depends(authenticate)) -> dict[str, Any]:
    """Get a prompt definition with its entire version history."""
    if state.postgres is not None:
        p_row = await state.postgres.fetchrow(
            "SELECT id, org_id, name, description, tags, created_at, updated_at FROM prompts WHERE org_id = $1 AND name = $2",
            api_key.org_id,
            name,
        )
        if not p_row:
            raise HTTPException(status_code=404, detail="Prompt not found")
        versions = await state.postgres.fetch(
            """
            SELECT id, version, template, model, model_parameters, labels, author, commit_message, created_at
            FROM prompt_versions
            WHERE prompt_id = $1
            ORDER BY version DESC
            """,
            p_row["id"],
        )
        p_dict = dict(p_row)
        p_dict["versions"] = [dict(v) for v in versions]
        return p_dict

    # In-memory dev fallback
    key = f"{api_key.org_id}:{name}"
    p = state.memory_prompts.get(key)
    versions = state.memory_prompt_versions.get(key, [])
    if not p:
        return {
            "name": name,
            "description": "Primary prompt template",
            "tags": ["production"],
            "versions": [
                {
                    "version": 2,
                    "template": "You are a helpful customer support agent for {{company_name}}.\nUser Query: {{query}}\nContext: {{context}}\nInstructions: Always adhere to DPDP data privacy guidelines.",
                    "model": "gpt-4.1-mini",
                    "model_parameters": {"temperature": 0.2},
                    "labels": ["production"],
                    "author": "dev-lead",
                    "commit_message": "Added DPDP compliance guardrails to prompt template",
                    "created_at": "2026-08-22T14:00:00Z",
                },
                {
                    "version": 1,
                    "template": "You are a customer assistant.\nUser Query: {{query}}",
                    "model": "gpt-4.1-mini",
                    "model_parameters": {"temperature": 0.5},
                    "labels": [],
                    "author": "initial",
                    "commit_message": "Initial prompt creation",
                    "created_at": "2026-08-20T10:00:00Z",
                },
            ],
        }
    p_copy = dict(p)
    p_copy["versions"] = versions
    return p_copy


@router.post("/v1/prompts/{name}/versions", status_code=status.HTTP_201_CREATED)
async def publish_prompt_version(name: str, ver: PromptVersionCreate, api_key: ApiKey = Depends(authenticate)) -> dict[str, Any]:
    """Publish a new version of a prompt template."""
    if state.postgres is not None:
        p_row = await state.postgres.fetchrow(
            """
            INSERT INTO prompts (org_id, name) VALUES ($1, $2)
            ON CONFLICT (org_id, name) DO UPDATE SET updated_at = NOW()
            RETURNING id
            """,
            api_key.org_id,
            name,
        )
        prompt_id = p_row["id"]
        v_num_row = await state.postgres.fetchrow(
            "SELECT COALESCE(MAX(version), 0) + 1 as next_ver FROM prompt_versions WHERE prompt_id = $1",
            prompt_id,
        )
        next_ver = v_num_row["next_ver"]

        # If labeled production, remove production label from older versions
        if "production" in ver.labels:
            await state.postgres.execute(
                "UPDATE prompt_versions SET labels = array_remove(labels, 'production') WHERE prompt_id = $1",
                prompt_id,
            )

        new_v = await state.postgres.fetchrow(
            """
            INSERT INTO prompt_versions (prompt_id, org_id, version, template, model, model_parameters, labels, author, commit_message)
            VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
            RETURNING id, prompt_id, org_id, version, template, model, model_parameters, labels, author, commit_message, created_at
            """,
            prompt_id,
            api_key.org_id,
            next_ver,
            ver.template,
            ver.model,
            json.dumps(ver.model_parameters),
            ver.labels,
            ver.author,
            ver.commit_message,
        )
        return dict(new_v)

    # In-memory dev fallback
    key = f"{api_key.org_id}:{name}"
    versions = state.memory_prompt_versions.setdefault(key, [])
    next_ver = len(versions) + 1
    if "production" in ver.labels:
        for v in versions:
            if "production" in v.get("labels", []):
                v["labels"].remove("production")

    v_dict = ver.model_dump()
    v_dict["version"] = next_ver
    v_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    versions.insert(0, v_dict)
    return v_dict


@router.post("/v1/prompts/{name}/versions/{version}/promote")
async def promote_prompt_version(
    name: str,
    version: int,
    label: str = Query(default="production", pattern="^(production|staging)$"),
    api_key: ApiKey = Depends(authenticate),
) -> dict[str, Any]:
    """Promote a prompt version to a specific label (e.g. production or staging) and demote previous versions."""
    if state.postgres is not None:
        p_row = await state.postgres.fetchrow("SELECT id FROM prompts WHERE org_id = $1 AND name = $2", api_key.org_id, name)
        if not p_row:
            raise HTTPException(status_code=404, detail="Prompt not found")
        prompt_id = p_row["id"]
        # Remove label from all versions of this prompt
        await state.postgres.execute(
            "UPDATE prompt_versions SET labels = array_remove(labels, $1) WHERE prompt_id = $2",
            label,
            prompt_id,
        )
        # Add label to the target version
        await state.postgres.execute(
            "UPDATE prompt_versions SET labels = array_append(labels, $1) WHERE prompt_id = $2 AND version = $3",
            label,
            prompt_id,
            version,
        )
        return {"status": "promoted", "name": name, "version": version, "label": label}

    return {"status": "promoted", "name": name, "version": version, "label": label}


@router.post("/v1/prompts/{name}/compile")
async def compile_prompt(
    name: str,
    req: PromptCompileRequest,
    version: int | None = None,
    label: str = "production",
    api_key: ApiKey = Depends(authenticate),
) -> dict[str, Any]:
    """Fetch and compile a prompt template with runtime variables."""
    template_str = ""
    model = "gpt-4.1-mini"
    params = {}
    ver_num = version or 1

    if state.postgres is not None:
        if version:
            v_row = await state.postgres.fetchrow(
                """
                SELECT pv.version, pv.template, pv.model, pv.model_parameters
                FROM prompt_versions pv
                JOIN prompts p ON p.id = pv.prompt_id
                WHERE p.org_id = $1 AND p.name = $2 AND pv.version = $3
                """,
                api_key.org_id,
                name,
                version,
            )
        else:
            v_row = await state.postgres.fetchrow(
                """
                SELECT pv.version, pv.template, pv.model, pv.model_parameters
                FROM prompt_versions pv
                JOIN prompts p ON p.id = pv.prompt_id
                WHERE p.org_id = $1 AND p.name = $2 AND $3 = ANY(pv.labels)
                ORDER BY pv.version DESC LIMIT 1
                """,
                api_key.org_id,
                name,
                label,
            )
        if v_row:
            template_str = v_row["template"]
            model = v_row["model"]
            params = json.loads(v_row["model_parameters"]) if isinstance(v_row["model_parameters"], str) else v_row["model_parameters"]
            ver_num = v_row["version"]
        else:
            latest = await state.postgres.fetchrow(
                """
                SELECT pv.version, pv.template, pv.model, pv.model_parameters
                FROM prompt_versions pv
                JOIN prompts p ON p.id = pv.prompt_id
                WHERE p.org_id = $1 AND p.name = $2
                ORDER BY pv.version DESC LIMIT 1
                """,
                api_key.org_id,
                name,
            )
            if latest:
                template_str, model, ver_num = latest["template"], latest["model"], latest["version"]

    if not template_str:
        template_str = f"You are a helpful assistant for {name}.\nUser: {{{{query}}}}"

    compiled_text = compile_template(template_str, req.variables)
    return {
        "name": name,
        "version": ver_num,
        "model": model,
        "model_parameters": params,
        "raw_template": template_str,
        "compiled_prompt": compiled_text,
    }
