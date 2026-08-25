from app.main import span_row


def test_span_row_serializes_json() -> None:
    row = span_row({"input": {"query": "test"}, "output": None, "metadata": {}})
    assert '{"query": "test"}' in row
