"""Startup safety and security validation checks for AgentWatch Ingestion API."""

import logging
import os
import sys

logger = logging.getLogger("agentwatch.security")

WARNING_BANNER = """
================================================================================
                      *** SECURITY WARNING ***
  AGENTWATCH INGESTION API IS RUNNING WITH AUTHENTICATION DISABLED!
  AUTH_DISABLED=true in ENVIRONMENT='{env}'.
  All requests will bypass API key validation and have full tenant access.
  THIS CONFIGURATION IS STRICTLY PROHIBITED IN PRODUCTION AND STAGING.
================================================================================
"""


def verify_auth_environment_safety() -> None:
    """Validate that authentication is never disabled in production or staging environments."""
    auth_disabled_str = os.getenv("AUTH_DISABLED", "false").strip().lower()
    auth_disabled = auth_disabled_str == "true"

    environment = os.getenv("ENVIRONMENT", "").strip().lower()

    if auth_disabled:
        if environment in ("production", "staging") or not environment:
            error_msg = (
                f"CRITICAL SECURITY CONFIGURATION ERROR: AUTH_DISABLED is set to '{auth_disabled_str}', "
                f"but ENVIRONMENT is '{environment or '<unset>'}'. "
                "AUTH_DISABLED is strictly dev-only and must NEVER be enabled in production, "
                "staging, or when ENVIRONMENT is unset."
            )
            logger.critical(error_msg)
            raise RuntimeError(error_msg)

        if environment in ("development", "local", "test", "dev"):
            banner = WARNING_BANNER.format(env=environment).strip()
            # Log and print directly to sys.stdout so it is impossible to miss in console / log streams
            sys.stdout.write(f"\n{banner}\n\n")
            sys.stdout.flush()
            logger.warning(banner)


def run_startup_checks() -> None:
    """Run all critical startup safety and configuration checks."""
    verify_auth_environment_safety()
