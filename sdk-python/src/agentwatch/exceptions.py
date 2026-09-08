"""Exceptions for AgentWatch policy enforcement and validation."""


class AgentWatchError(Exception):
    """Base exception for all AgentWatch errors."""
    pass


class PolicyViolation(AgentWatchError):
    """Raised when an agent attempts to execute an unauthorized or blocked tool."""
    pass


class InjectionDetected(AgentWatchError):
    """Raised when an incoming user prompt contains a high-risk prompt injection attempt."""
    pass


class OutputPolicyViolation(AgentWatchError):
    """Raised when LLM output violates an enabled regulatory or industry output policy."""
    pass


class QuotaExceeded(AgentWatchError):
    """Raised when an end user exceeds their hourly/daily request or cost quota."""
    pass


class TierRestrictedError(AgentWatchError):
    """Raised when a requested feature is restricted to higher plan tiers (e.g. Team or Enterprise)."""
    pass


class LowConfidenceResponse(AgentWatchError):
    """Raised when an LLM output fails an evaluation gate threshold (e.g. low faithfulness or factuality)."""

    def __init__(
        self,
        message: str,
        *,
        score: float,
        unsupported_claims: list[str] | None = None,
        uncertain_claims: list[str] | None = None,
        check_type: str = "faithfulness",
        threshold: float = 0.7,
    ) -> None:
        super().__init__(message)
        self.score = score
        self.unsupported_claims = unsupported_claims or []
        self.uncertain_claims = uncertain_claims or []
        self.check_type = check_type
        self.threshold = threshold


