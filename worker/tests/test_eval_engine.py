import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from eval_engine import EvalEngine


def test_tool_correctness_evaluator():
    engine = EvalEngine("postgresql://mock")

    # Successful tool call
    valid_tool_span = {
        "org_id": "org_1",
        "span_id": "sp_1",
        "trace_id": "tr_1",
        "span_type": "tool_call",
        "input": {"param": "val"},
        "output": {"result": "success"},
        "status": "success",
    }
    config = {"eval_type": "tool_correctness", "name": "Tool Accuracy", "sampling_rate": 1.0}
    score = engine.evaluate_span(valid_tool_span, config)
    assert score is not None
    assert score["score_value"] == 1.0
    assert "Tool executed" in score["reasoning"]

    # Failed tool call
    failed_tool_span = {
        "org_id": "org_1",
        "span_id": "sp_2",
        "trace_id": "tr_1",
        "span_type": "tool_call",
        "input": {"param": "val"},
        "output": None,
        "status": "error",
        "error_message": "Timeout executing tool",
    }
    score_err = engine.evaluate_span(failed_tool_span, config)
    assert score_err is not None
    assert score_err["score_value"] == 0.0


def test_json_validity_evaluator():
    engine = EvalEngine("postgresql://mock")
    config = {"eval_type": "json_validity", "name": "JSON Check", "sampling_rate": 1.0}

    span = {
        "org_id": "org_1",
        "span_id": "sp_3",
        "trace_id": "tr_1",
        "span_type": "llm_call",
        "input": {},
        "output": '{"report_id": 42, "status": "verified"}',
        "status": "success",
    }
    score = engine.evaluate_span(span, config)
    assert score is not None
    assert score["score_value"] == 1.0
