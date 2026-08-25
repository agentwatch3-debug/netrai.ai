"""Prompt domain models and template compiler."""

import re
from typing import Any
from pydantic import BaseModel, Field


class PromptCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128, pattern="^[a-zA-Z0-9_-]+$")
    description: str | None = Field(default=None, max_length=1024)
    tags: list[str] = Field(default_factory=list)


class PromptVersionCreate(BaseModel):
    template: str = Field(min_length=1)
    model: str = Field(default="gpt-4.1-mini", max_length=128)
    model_parameters: dict[str, Any] = Field(default_factory=dict)
    labels: list[str] = Field(default_factory=list)
    author: str | None = Field(default=None, max_length=128)
    commit_message: str | None = Field(default=None, max_length=512)


class PromptCompileRequest(BaseModel):
    variables: dict[str, Any] = Field(default_factory=dict)


def compile_template(template: str, variables: dict[str, Any]) -> str:
    """Replace {{variable}} and {variable} placeholders with runtime values."""
    compiled = template
    for key, val in variables.items():
        compiled = re.sub(rf"\{{\{{\s*{re.escape(key)}\s*\}}\}}", str(val), compiled)
        compiled = re.sub(rf"\{{\s*{re.escape(key)}\s*\}}", str(val), compiled)
    return compiled
