"""In-memory cached tool-call policy checker for AgentWatch."""

import logging
import threading
import time
from typing import Any

import httpx

from .config import get_config
from .exceptions import PolicyViolation

logger = logging.getLogger("agentwatch.policy")


class PolicyCache:
    def __init__(self, ttl_seconds: float = 60.0) -> None:
        self._cache: dict[str, tuple[float, set[str]]] = {}
        self._lock = threading.Lock()
        self.ttl_seconds = ttl_seconds

    def get_blocked_tools(self, agent_id: str | None) -> set[str]:
        key = agent_id or "*"
        now = time.time()
        with self._lock:
            if key in self._cache:
                ts, blocked = self._cache[key]
                if now - ts < self.ttl_seconds:
                    return blocked

        config = get_config()
        if not config.api_key or not config.endpoint:
            return set()

        try:
            with httpx.Client(timeout=3.0) as client:
                url = f"{config.endpoint.rstrip('/')}/v1/policies/tools"
                resp = client.get(url, params={"agent_id": key}, headers={"X-AgentWatch-Key": config.api_key})
                if resp.status_code == 200:
                    data = resp.json()
                    blocked = set(data.get("blocked_tool_names", []))
                    with self._lock:
                        self._cache[key] = (now, blocked)
                    return blocked
        except Exception as exc:
            logger.debug("Failed to fetch tool policy rules for agent %s: %s", key, exc)

        with self._lock:
            return self._cache.get(key, (0, set()))[1]

    def check_tool_allowed(self, tool_name: str, agent_id: str | None = None) -> None:
        """Raise PolicyViolation if the tool is blocked for the given agent."""
        blocked = self.get_blocked_tools(agent_id)
        if tool_name in blocked or "*" in blocked:
            raise PolicyViolation(
                f"Tool '{tool_name}' is blocked by policy rule for agent '{agent_id or '*'}'"
            )

    def set_local_policy(self, agent_id: str, blocked_tool_names: list[str]) -> None:
        """Manually populate cache for testing or pre-configured offline policies."""
        with self._lock:
            self._cache[agent_id] = (time.time(), set(blocked_tool_names))

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()


policy_cache = PolicyCache()
