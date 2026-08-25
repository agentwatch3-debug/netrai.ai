"""Best-effort background exporter. Application calls never wait for HTTP."""

import asyncio
import logging
import threading
from collections.abc import Mapping
from typing import Any

import httpx

from .config import get_config

logger = logging.getLogger("agentwatch")


class SpanExporter:
    def __init__(self) -> None:
        self._spans: list[dict[str, Any]] = []
        self._lock = threading.Lock()
        self._wake = threading.Event()
        self._closed = False
        self._thread = threading.Thread(target=self._run, name="agentwatch-exporter", daemon=True)
        self._thread.start()

    def enqueue(self, span: dict[str, Any]) -> None:
        with self._lock:
            self._spans.append(span)
            if len(self._spans) >= get_config().batch_size:
                self._wake.set()

    def _take_batch(self) -> list[dict[str, Any]]:
        with self._lock:
            batch, self._spans = self._spans, []
        return batch

    async def _send(self, batch: list[dict[str, Any]]) -> None:
        config = get_config()
        if not config.api_key:
            logger.debug("AgentWatch API key is absent; dropping %d spans", len(batch))
            return
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.post(f"{config.endpoint.rstrip('/')}/v1/spans", json={"spans": batch}, headers={"X-AgentWatch-Key": config.api_key})
                response.raise_for_status()
        except Exception:
            logger.warning("AgentWatch export failed; dropped %d spans", len(batch), exc_info=True)

    def _flush(self) -> None:
        batch = self._take_batch()
        if batch:
            asyncio.run(self._send(batch))

    def _run(self) -> None:
        while not self._closed:
            self._wake.wait(timeout=get_config().flush_interval_seconds)
            self._wake.clear()
            self._flush()

    def flush(self) -> None:
        """Synchronously drain queued spans; useful during controlled shutdown/tests."""
        self._flush()

    def shutdown(self) -> None:
        self._closed = True
        self._wake.set()
        self._thread.join(timeout=2.0)
        self._flush()


exporter = SpanExporter()
