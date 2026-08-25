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
