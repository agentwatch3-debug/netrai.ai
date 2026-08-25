"""SDK configuration, populated from environment by default."""

from dataclasses import dataclass, field
import os


@dataclass(slots=True)
class AgentWatchConfig:
    api_key: str = field(default_factory=lambda: os.getenv("AGENTWATCH_API_KEY", ""))
    endpoint: str = field(default_factory=lambda: os.getenv("AGENTWATCH_ENDPOINT", "http://127.0.0.1:8000"))
    org_id: str = field(default_factory=lambda: os.getenv("AGENTWATCH_ORG_ID", "default"))
    flush_interval_seconds: float = 2.0
    batch_size: int = 50


_config = AgentWatchConfig()


def configure(config: AgentWatchConfig) -> None:
    """Replace global SDK configuration; call before creating traced work."""
    global _config
    _config = config


def get_config() -> AgentWatchConfig:
    return _config
