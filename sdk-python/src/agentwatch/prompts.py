"""Centralized Prompt Management and Template Engine for AgentWatch."""

import logging
import re
import threading
import time
from typing import Any, Optional

import httpx

from .config import get_config

logger = logging.getLogger("agentwatch.prompts")


class PromptTemplate:
    """Represents a versioned prompt template with compilation capabilities."""

    def __init__(
        self,
        name: str,
        template: str,
        version: int = 1,
        model: str = "gpt-4.1-mini",
        model_parameters: Optional[dict[str, Any]] = None,
        labels: Optional[list[str]] = None,
    ) -> None:
        self.name = name
        self.template = template
        self.version = version
        self.model = model
        self.model_parameters = model_parameters or {}
        self.labels = labels or []

    def compile(self, **variables: Any) -> str:
        """Interpolate variables into the prompt template using {{var}} or {var} placeholders."""
        compiled = self.template
        for key, val in variables.items():
            compiled = re.sub(rf"\{{\{{\s*{re.escape(key)}\s*\}}\}}", str(val), compiled)
            compiled = re.sub(rf"\{{\s*{re.escape(key)}\s*\}}", str(val), compiled)
        return compiled

    def __str__(self) -> str:
        return self.template

    def __repr__(self) -> str:
        return f"<PromptTemplate name='{self.name}' v={self.version} model='{self.model}'>"


class PromptCache:
    def __init__(self) -> None:
        self._cache: dict[str, tuple[float, PromptTemplate]] = {}
        self._lock = threading.Lock()

    def get(self, key: str, ttl: float) -> Optional[PromptTemplate]:
        with self._lock:
            if key in self._cache:
                ts, prompt = self._cache[key]
                if time.time() - ts < ttl:
                    return prompt
        return None

    def set(self, key: str, prompt: PromptTemplate) -> None:
        with self._lock:
            self._cache[key] = (time.time(), prompt)

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()


_prompt_cache = PromptCache()


def get_prompt(
    name: str,
    version: Optional[int] = None,
    label: str = "production",
    variables: Optional[dict[str, Any]] = None,
    cache_ttl: float = 60.0,
) -> PromptTemplate:
    """Fetch a versioned prompt template from AgentWatch with local in-memory caching."""
    cache_key = f"{name}:{version or label}"
    cached = _prompt_cache.get(cache_key, cache_ttl)
    if cached is not None:
        if variables:
            # Return fresh instance with compiled template
            compiled_str = cached.compile(**variables)
            return PromptTemplate(
                name=cached.name,
                template=compiled_str,
                version=cached.version,
                model=cached.model,
                model_parameters=cached.model_parameters,
                labels=cached.labels,
            )
        return cached

    config = get_config()
    if not config.api_key or not config.endpoint:
        # Offline fallback template
        fallback = PromptTemplate(name=name, template=f"Assistant prompt for {name}: {{{{query}}}}")
        if variables:
            return PromptTemplate(name=name, template=fallback.compile(**variables))
        return fallback

    try:
        with httpx.Client(timeout=4.0) as client:
            url = f"{config.endpoint.rstrip('/')}/v1/prompts/{name}/compile"
            params = {"version": version} if version else {"label": label}
            resp = client.post(
                url,
                params=params,
                json={"variables": variables or {}},
                headers={"X-AgentWatch-Key": config.api_key},
            )
            if resp.status_code == 200:
                data = resp.json()
                prompt = PromptTemplate(
                    name=name,
                    template=data.get("compiled_prompt" if variables else "raw_template", ""),
                    version=data.get("version", 1),
                    model=data.get("model", "gpt-4.1-mini"),
                    model_parameters=data.get("model_parameters", {}),
                    labels=[label] if not version else [],
                )
                _prompt_cache.set(cache_key, prompt)
                return prompt
    except Exception as exc:
        logger.warning("Failed to fetch prompt '%s' from AgentWatch: %s", name, exc)

    return PromptTemplate(name=name, template=f"Default prompt for {name}")


def publish_prompt(
    name: str,
    template: str,
    model: str = "gpt-4.1-mini",
    model_parameters: Optional[dict[str, Any]] = None,
    labels: Optional[list[str]] = None,
    commit_message: Optional[str] = None,
) -> bool:
    """Publish a new prompt version to AgentWatch."""
    config = get_config()
    if not config.api_key or not config.endpoint:
        return False

    payload = {
        "template": template,
        "model": model,
        "model_parameters": model_parameters or {},
        "labels": labels or ["production"],
        "commit_message": commit_message or "Published via Python SDK",
    }

    try:
        with httpx.Client(timeout=4.0) as client:
            resp = client.post(
                f"{config.endpoint.rstrip('/')}/v1/prompts/{name}/versions",
                json=payload,
                headers={"X-AgentWatch-Key": config.api_key},
            )
            _prompt_cache.clear()
            return resp.status_code in (200, 201)
    except Exception as exc:
        logger.warning("Failed to publish prompt '%s': %s", name, exc)
        return False
