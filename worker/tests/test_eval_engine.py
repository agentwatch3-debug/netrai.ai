import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from eval_engine import (
    FACTUALITY_JUDGE_PROMPT_VERSION,
    FAITHFULNESS_JUDGE_PROMPT_VERSION,
    TASK_ADHERENCE_JUDGE_PROMPT_VERSION,
    EvalEngine,
    calculate_eval_cost,
    extract_retrieved_context,
)


def test_tool_correctness_evaluator():
    engine = EvalEngine("postgresql://mock")

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
    assert extract_retrieved_context("Sample retrieved documentation text") == "Sample retrieved documentation text"

    doc_dict = {"documents": ["Section 1: NetrAI pricing is tier-based.", "Section 2: DPDP pinning in ap-south-1."]}
    extracted = extract_retrieved_context(doc_dict)
    assert extracted is not None
    assert "Section 1" in extracted and "Section 2" in extracted

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
        "cost_usd": 0.0035,
    }

    score = engine.evaluate_faithfulness(llm_span, retrieved_tool_spans, judge_model="gpt-4o-mini")

    assert score is not None
    assert score["score_type"] == "faithfulness"
    assert score["check_type"] == "faithfulness"
    assert score["value"] == 1.0
    assert score["unsupported_claims"] == []
    assert "supported" in score["reasoning"].lower()
    assert score["judge_model"] == "gpt-4o-mini"
    assert score["judge_prompt_version"] == FAITHFULNESS_JUDGE_PROMPT_VERSION
    assert score["cost_usd_eval"] > 0.0
    assert score["cost_usd_eval"] != llm_span["cost_usd"]


def test_faithfulness_unsupported_claims_detection():
    engine = EvalEngine("postgresql://mock")

    retrieved_tool_spans = [
        {
            "span_type": "tool_call",
            "span_id": "tool_kb_search",
            "output": "The product warranty covers manufacturing defects for 12 months from purchase date.",
        }
    ]

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


def test_factuality_valid_general_knowledge_high_confidence():
    engine = EvalEngine("postgresql://mock")

    # Closed-book generation with well-established general knowledge
    llm_span = {
        "org_id": "org_enterprise_1",
        "span_id": "llm_span_closed_1",
        "trace_id": "trace_closed_1",
        "span_type": "llm_call",
        "input": "When was the Apollo 11 Moon landing?",
        "output": "The Apollo 11 Moon landing occurred in July 1969. Astronauts Neil Armstrong and Buzz Aldrin walked on the lunar surface.",
        "status": "success",
    }

    score = engine.evaluate_factuality(llm_span, judge_model="gpt-4o-mini")

    assert score is not None
    assert score["score_type"] == "factuality"
    assert score["check_type"] == "factuality"
    assert score["value"] == 1.0
    assert score["unsupported_claims"] == []
    assert score["uncertain_claims"] == []
    assert score["judge_confidence"] == "high"
    assert score["judge_prompt_version"] == FACTUALITY_JUDGE_PROMPT_VERSION
    assert score["cost_usd_eval"] > 0.0


def test_factuality_unsupported_anachronisms_detection():
    engine = EvalEngine("postgresql://mock")

    # Output containing demonstrably false chronological claims
    llm_span = {
        "org_id": "org_enterprise_1",
        "span_id": "llm_span_closed_2",
        "trace_id": "trace_closed_2",
        "span_type": "llm_call",
        "input": "Tell me about ancient internet history.",
        "output": "The World Wide Web was invented in 1250 by medieval scribes. Apple Computer was founded in 1650.",
        "status": "success",
    }

    score = engine.evaluate_factuality(llm_span, judge_model="gpt-4o-mini")

    assert score is not None
    assert score["score_type"] == "factuality"
    assert score["check_type"] == "factuality"
    assert score["value"] < 1.0
    assert len(score["unsupported_claims"]) >= 1


def test_factuality_flags_uncertain_claims():
    engine = EvalEngine("postgresql://mock")

    # Output with speculative/unverified assertions that trigger judge uncertainty
    llm_span = {
        "org_id": "org_enterprise_1",
        "span_id": "llm_span_closed_3",
        "trace_id": "trace_closed_3",
        "span_type": "llm_call",
        "input": "What is the secretive project code?",
        "output": "The CEO allegedly held an unverified meeting with secret advisors. The project is rumored to launch next year.",
        "status": "success",
    }

    score = engine.evaluate_factuality(llm_span, judge_model="gpt-4o-mini")

    assert score is not None
    assert score["check_type"] == "factuality"
    assert len(score["uncertain_claims"]) >= 1
    assert score["judge_confidence"] in ("medium", "low")
    assert "uncertain" in score["reasoning"].lower() or "confidence" in score["reasoning"].lower()


def test_calculate_eval_cost_models():
    cost_mini = calculate_eval_cost("gpt-4o-mini", prompt_tokens=1000, completion_tokens=200)
    expected_mini = (1000 / 1e6) * 0.15 + (200 / 1e6) * 0.60
    assert cost_mini == round(expected_mini, 7)
    assert cost_mini > 0.0

    cost_haiku = calculate_eval_cost("claude-3-5-haiku", prompt_tokens=2000, completion_tokens=500)
    expected_haiku = (2000 / 1e6) * 0.80 + (500 / 1e6) * 4.00
    assert cost_haiku == round(expected_haiku, 7)


def test_task_adherence_aligned_intent_action():
    engine = EvalEngine("postgresql://mock")

    user_request = "Can you look up the current order status for order ID ORD-9921?"
    agent_action = {
        "tool": "lookup_order",
        "arguments": {"order_id": "ORD-9921"},
    }

    llm_span = {
        "org_id": "org_enterprise_1",
        "span_id": "llm_span_adh_1",
        "trace_id": "trace_adh_1",
        "span_type": "llm_call",
        "input": user_request,
        "output": json.dumps(agent_action),
        "status": "success",
    }

    score = engine.evaluate_task_adherence(
        user_input=user_request,
        agent_action=agent_action,
        llm_span=llm_span,
        judge_model="gpt-4o-mini",
    )

    assert score is not None
    assert score["score_type"] == "task_adherence"
    assert score["check_type"] == "task_adherence"
    assert score["value"] >= 0.70
    assert score["metadata"]["adherence_level"] == "aligned"
    assert score["judge_model"] == "gpt-4o-mini"
    assert score["judge_prompt_version"] == TASK_ADHERENCE_JUDGE_PROMPT_VERSION
    assert score["cost_usd_eval"] > 0.0


def test_task_adherence_intent_mismatch():
    engine = EvalEngine("postgresql://mock")

    user_request = "Please cancel my subscription immediately and stop recurring billing."
    agent_action = {
        "tool": "charge_credit_card",
        "arguments": {"amount": 299.00, "renew": True},
    }

    llm_span = {
        "org_id": "org_enterprise_1",
        "span_id": "llm_span_adh_2",
        "trace_id": "trace_adh_2",
        "span_type": "llm_call",
        "input": user_request,
        "output": json.dumps(agent_action),
        "status": "success",
    }

    score = engine.evaluate_task_adherence(
        user_input=user_request,
        agent_action=agent_action,
        llm_span=llm_span,
        judge_model="gpt-4o-mini",
    )

    assert score is not None
    assert score["score_type"] == "task_adherence"
    assert score["value"] < 0.70
    assert score["metadata"]["adherence_level"] == "mismatch"
    assert "Possible intent mismatch" in score["reasoning"]


def test_task_adherence_span_evaluator():
    engine = EvalEngine("postgresql://mock")

    span = {
        "org_id": "org_enterprise_1",
        "span_id": "llm_span_adh_3",
        "trace_id": "trace_adh_3",
        "span_type": "llm_call",
        "input": "Query database for customer email records",
        "output": {"tool": "database_query", "sql": "SELECT email FROM customers"},
        "status": "success",
    }

    config = {
        "eval_type": "task_adherence",
        "name": "Task Adherence Check",
        "sampling_rate": 1.0,
        "model": "gpt-4o-mini",
    }

    score = engine.evaluate_span(span, config)
    assert score is not None
    assert score["score_type"] == "task_adherence"
    assert score["score_value"] >= 0.70
    assert score["cost_usd_eval"] > 0.0

