from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from app.main import Span, SpanStatus, SpanType


def test_span_rejects_inverted_timestamps() -> None:
    with pytest.raises(ValidationError):
        Span(trace_id="trace", span_id="span", agent_id="agent", org_id="org", name="test", span_type=SpanType.agent_call, status=SpanStatus.success, started_at=datetime(2026, 1, 2, tzinfo=timezone.utc), ended_at=datetime(2026, 1, 1, tzinfo=timezone.utc))
