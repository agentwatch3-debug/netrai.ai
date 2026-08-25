"""Master auto-instrumentation manager for AgentWatch."""

import logging
from typing import Optional

from .anthropic import patch_anthropic
from .litellm import patch_litellm
from .openai import patch_openai

logger = logging.getLogger("agentwatch.instrumentation")


def auto_instrument(
    openai: bool = True,
    anthropic: bool = True,
    litellm: bool = True,
) -> None:
    """Automatically detect and instrument all installed AI libraries in one call."""
    if openai:
        patch_openai()
    if anthropic:
        patch_anthropic()
    if litellm:
        patch_litellm()
    logger.info("AgentWatch auto-instrumentation completed")
