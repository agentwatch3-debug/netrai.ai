from typing import Any

import httpx


class AgentWatchClient:
    """Small synchronous client for submitting sanitized spans."""

    def __init__(self, endpoint: str, api_key: str | None = None) -> None:
        self.endpoint = endpoint.rstrip("/")
        self.api_key = api_key

    def emit(self, span: dict[str, Any]) -> None:
        headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
        response = httpx.post(f"{self.endpoint}/v1/spans", json=span, headers=headers, timeout=10)
        response.raise_for_status()
