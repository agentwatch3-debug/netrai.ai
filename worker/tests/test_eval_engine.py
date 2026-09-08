import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from eval_engine import (
    FAITHFULNESS_JUDGE_PROMPT_VERSION,
    EvalEngine,
    calculate_eval_cost,
    extract_retrieved_context,
)


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
    config = {
        "eval_type": "tool_correctness",
        "name": "Tool Accuracy",
        "sampling_rate": 1.0,
    }
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
    config = {
        "eval_type": "json_validity",
        "name": "JSON Check",
        "sampling_rate": 1.0,
    }

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


def test_extract_retrieved_context_various_structures():
    # 1. Plain string
    assert extract_retrieved_context("Sample retrieved documentation text") == "Sample retrieved documentation text"

    # 2. Dict with documents key
    doc_dict = {"documents": ["Section 1: NetrAI pricing is tier-based.", "Section 2: DPDP pinning in ap-south-1."]}
    extracted = extract_retrieved_context(doc_dict)
    assert extracted is not None
    assert "Section 1" in extracted and "Section 2" in extracted

    # 3. Tool span list
    tool_spans = [
        {
            "span_type": "tool_call",
            "span_id": "tool_1",
            "output": {"results": "AgentWatch uses ClickHouse 24.8 MergeTree for columnar storage."},
        }
    ]
    extracted_span_ctx = extract_retrieved_context(tool_spans)
    assert extracted_span_ctx is not None
    assert "ClickHouse 24.8" in extracted_span_ctx

    # 4. None / Empty
    assert extract_retrieved_context(None) is None
    assert extract_retrieved_context("") is None
    assert extract_retrieved_context([]) is None


def test_faithfulness_fully_supported_context():
    engine = EvalEngine("postgresql://mock")

    retrieved_tool_spans = [
        {
            "span_type": "tool_call",
            "span_id": "tool_kb_search",
            "output": {
                "content": "Acme Corp quarterly revenue grew 35% year-over-year in Q3 2026. The operating margin reached 22%."
            },
        }
    ]

    llm_span = {
        "org_id": "org_enterprise_1",
        "span_id": "llm_span_99",
        "trace_id": "trace_rag_100",
        "span_type": "llm_call",
        "input": "Summarize Acme Corp Q3 performance.",
        "output": "Acme Corp quarterly revenue grew 35% year-over-year in Q3 2026. Operating margin reached 22%.",
        "status": "success",
        "cost_usd": 0.0035,  # Original span customer cost
    }

    score = engine.evaluate_faithfulness(llm_span, retrieved_tool_spans, judge_model="gpt-4o-mini")

    assert score is not None
    assert score["score_type"] == "faithfulness"
    assert score["value"] == 1.0
    assert score["unsupported_claims"] == []
    assert "supported" in score["reasoning"].lower()
    assert score["judge_model"] == "gpt-4o-mini"
    assert score["judge_prompt_version"] == FAITHFULNESS_JUDGE_PROMPT_VERSION
    assert score["cost_usd_eval"] > 0.0
    assert score["cost_usd_eval"] != llm_span["cost_usd"]  # Evaluation cost is independent from span cost


def test_faithfulness_unsupported_claims_detection():
    engine = EvalEngine("postgresql://mock")

    retrieved_tool_spans = [
        {
            "span_type": "tool_call",
            "span_id": "tool_kb_search",
            "output": "The product warranty covers manufacturing defects for 12 months from purchase date.",
        }
    ]

    # LLM hallucinates extra unsupported claim about free lifetime battery replacements
    llm_span = {
        "org_id": "org_enterprise_1",
        "span_id": "llm_span_101",
        "trace_id": "trace_rag_102",
        "span_type": "llm_call",
        "input": "What is the warranty policy?",
        "output": "The warranty covers manufacturing defects for 12 months from purchase. We also guarantee free unlimited battery replacements for the lifetime of the vehicle.",
        "status": "success",
    }

    score = engine.evaluate_faithfulness(llm_span, retrieved_tool_spans, judge_model="gpt-4o-mini")

    assert score is not None
    assert score["value"] < 1.0
    assert len(score["unsupported_claims"]) >= 1
    assert any("battery" in claim.lower() or "lifetime" in claim.lower() for claim in score["unsupported_claims"])
    assert "unsupported" in score["reasoning"].lower() or "grounding" in score["reasoning"].lower()


def test_faithfulness_skipped_when_no_context():
    engine = EvalEngine("postgresql://mock")

    llm_span = {
        "org_id": "org_1",
        "span_id": "sp_no_ctx",
        "trace_id": "tr_no_ctx",
        "span_type": "llm_call",
        "input": "Tell me a joke",
        "output": "Why did the chicken cross the road?",
    }

    # No tool context provided
    score = engine.evaluate_faithfulness(llm_span, context_or_tool_spans=None)
    assert score is None


def test_faithfulness_skipped_on_non_llm_span():
    engine = EvalEngine("postgresql://mock")

    tool_span = {
        "org_id": "org_1",
        "span_id": "sp_tool",
        "span_type": "tool_call",
        "input": {"query": "pricing"},
        "output": "Prices start at $10/mo",
    }

    score = engine.evaluate_faithfulness(tool_span, context_or_tool_spans="Context string")
    assert score is None


def test_calculate_eval_cost_models():
    # Test gpt-4o-mini pricing ($0.15/1M prompt, $0.60/1M completion)
    cost_mini = calculate_eval_cost("gpt-4o-mini", prompt_tokens=1000, completion_tokens=200)
    expected_mini = (1000 / 1e6) * 0.15 + (200 / 1e6) * 0.60
    assert cost_mini == round(expected_mini, 7)
    assert cost_mini > 0.0

    # Test claude-3-5-haiku pricing ($0.80/1M prompt, $4.00/1M completion)
    cost_haiku = calculate_eval_cost("claude-3-5-haiku", prompt_tokens=2000, completion_tokens=500)
    expected_haiku = (2000 / 1e6) * 0.80 + (500 / 1e6) * 4.00
    assert cost_haiku == round(expected_haiku, 7)
