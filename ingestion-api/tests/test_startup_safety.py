"""Unit tests for AgentWatch startup safety and environment checks."""

import os
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.startup_checks import verify_auth_environment_safety


def test_auth_disabled_in_production_raises_runtime_error(monkeypatch: pytest.MonkeyPatch):
    """Refuse to start if AUTH_DISABLED=true in production environment."""
    monkeypatch.setenv("AUTH_DISABLED", "true")
    monkeypatch.setenv("ENVIRONMENT", "production")

    with pytest.raises(RuntimeError) as exc_info:
        verify_auth_environment_safety()

    assert "CRITICAL SECURITY CONFIGURATION ERROR" in str(exc_info.value)
    assert "production" in str(exc_info.value)
    assert "AUTH_DISABLED is strictly dev-only" in str(exc_info.value)


def test_auth_disabled_in_staging_raises_runtime_error(monkeypatch: pytest.MonkeyPatch):
    """Refuse to start if AUTH_DISABLED=true in staging environment."""
    monkeypatch.setenv("AUTH_DISABLED", "true")
    monkeypatch.setenv("ENVIRONMENT", "staging")

    with pytest.raises(RuntimeError) as exc_info:
        verify_auth_environment_safety()

    assert "CRITICAL SECURITY CONFIGURATION ERROR" in str(exc_info.value)
    assert "staging" in str(exc_info.value)


def test_auth_disabled_with_unset_environment_raises_runtime_error(monkeypatch: pytest.MonkeyPatch):
    """Refuse to start if AUTH_DISABLED=true and ENVIRONMENT is unset."""
    monkeypatch.setenv("AUTH_DISABLED", "true")
    monkeypatch.delenv("ENVIRONMENT", raising=False)

    with pytest.raises(RuntimeError) as exc_info:
        verify_auth_environment_safety()

    assert "CRITICAL SECURITY CONFIGURATION ERROR" in str(exc_info.value)
    assert "<unset>" in str(exc_info.value)


def test_auth_disabled_in_local_development_logs_warning(monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture):
    """Allow starting in local / development environment and emit loud warning banner."""
    monkeypatch.setenv("AUTH_DISABLED", "true")
    monkeypatch.setenv("ENVIRONMENT", "local")

    verify_auth_environment_safety()
    captured = capsys.readouterr()

    assert "SECURITY WARNING" in captured.out
    assert "AUTH_DISABLED=true in ENVIRONMENT='local'" in captured.out


def test_auth_disabled_in_dev_environment_succeeds(monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture):
    """Allow starting in development environment."""
    monkeypatch.setenv("AUTH_DISABLED", "true")
    monkeypatch.setenv("ENVIRONMENT", "development")

    verify_auth_environment_safety()
    captured = capsys.readouterr()

    assert "SECURITY WARNING" in captured.out
    assert "ENVIRONMENT='development'" in captured.out


def test_auth_enabled_in_production_succeeds(monkeypatch: pytest.MonkeyPatch):
    """Allow starting cleanly in production when authentication is enabled."""
    monkeypatch.setenv("AUTH_DISABLED", "false")
    monkeypatch.setenv("ENVIRONMENT", "production")

    # Should not raise
    verify_auth_environment_safety()


def test_fastapi_lifespan_blocks_production_with_auth_disabled(monkeypatch: pytest.MonkeyPatch):
    """Verify FastAPI application lifespan aborts on startup when misconfigured."""
    monkeypatch.setenv("AUTH_DISABLED", "true")
    monkeypatch.setenv("ENVIRONMENT", "production")

    with pytest.raises(RuntimeError) as exc_info:
        with TestClient(app):
            pass

    assert "CRITICAL SECURITY CONFIGURATION ERROR" in str(exc_info.value)


def test_fastapi_lifespan_starts_cleanly_in_local_dev(monkeypatch: pytest.MonkeyPatch):
    """Verify FastAPI application starts cleanly in local development with in-memory mode."""
    monkeypatch.setenv("AUTH_DISABLED", "true")
    monkeypatch.setenv("ENVIRONMENT", "local")
    monkeypatch.setenv("SPAN_BACKEND", "memory")

    with TestClient(app) as client:
        res = client.get("/healthz")
        assert res.status_code == 200
        assert res.json() == {"status": "ok", "backend": "memory"}
