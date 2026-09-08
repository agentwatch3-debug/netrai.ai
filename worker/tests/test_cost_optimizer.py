import os
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from worker.cost_optimizer import (
    USD_TO_INR_RATE,
    analyze_context_bloat,
    analyze_prompt_caching,
    extract_prompt_fingerprint,
    run_cost_optimization_analysis,
)


def test_extract_prompt_fingerprint_hashes_consistent_prefix():
    prompt_text = "You are a specialized financial compliance agent responsible for verifying DPDP and PII."
    fp1, preview1, tokens1 = extract_prompt_fingerprint(prompt_text)
    fp2, preview2, tokens2 = extract_prompt_fingerprint(prompt_text.upper() + "   ")

    assert fp1 == fp2
    assert len(fp1) == 64
    assert tokens1 > 0


def test_analyze_prompt_caching_detects_repeated_system_prompt():
    large_system_prompt = "You are an automated medical triage assistant. " * 80  # ~3,200 chars / 800 tokens

    spans = [
        {
            "agent_id": "medical_triage_bot",
            "model": "claude-3-5-sonnet",
            "span_type": "llm_call",
            "prompt_tokens": 1200,
            "completion_tokens": 150,
            "input_data": [{"role": "system", "content": large_system_prompt}, {"role": "user", "content": f"Query {i}"}],
        }
        for i in range(10)
    ]

    opportunities = analyze_prompt_caching(spans, min_static_tokens=500, min_repetition_threshold=0.70)
    assert len(opportunities) == 1

    op = opportunities[0]
    assert op.agent_id == "medical_triage_bot"
    assert op.provider == "anthropic"
    assert op.advisor_type == "prompt_caching"
    assert op.repeated_prompt_pct == 100.0
    assert op.estimated_monthly_savings_usd > 0
    assert op.estimated_monthly_savings_inr == round(op.estimated_monthly_savings_usd * USD_TO_INR_RATE, 2)
    assert "Prompt Caching" in op.headline
    assert "cache_control" in (op.code_example or "")


def test_analyze_context_bloat_flags_extreme_input_output_ratio():
    # Spans with 3,500 input tokens and only 25 output tokens (140:1 ratio)
    spans = [
        {
            "agent_id": "sql_data_analyst",
            "model": "gpt-4o",
            "span_type": "llm_call",
            "prompt_tokens": 3500,
            "completion_tokens": 25,
        }
        for _ in range(5)
    ]

    opportunities = analyze_context_bloat(spans, min_input_tokens=1500, imbalance_ratio_threshold=25.0)
    assert len(opportunities) == 1

    op = opportunities[0]
    assert op.agent_id == "sql_data_analyst"
    assert op.advisor_type == "context_pruning"
    assert op.input_to_output_ratio >= 100.0
    assert op.avg_input_tokens == 3500
    assert op.avg_output_tokens == 25
    assert op.estimated_monthly_savings_inr > 0
    assert "Context Length" in op.headline


def test_run_cost_optimization_analysis_aggregates_roi_in_inr():
    large_prompt = "You are an enterprise customer support agent. " * 60
    spans = [
        {
            "agent_id": "customer_support_bot",
            "model": "gpt-4o",
            "span_type": "llm_call",
            "prompt_tokens": 2400,
            "completion_tokens": 30,  # Also triggers context ratio imbalance
            "input_data": large_prompt + f" user session {i}",
        }
        for i in range(8)
    ]

    result = run_cost_optimization_analysis(spans, org_id="org_dev_demo")

    assert result["currency"] == "INR"
    assert result["usd_to_inr_rate"] == USD_TO_INR_RATE
    assert "summary" in result
    assert result["summary"]["total_potential_monthly_savings_inr"] > 0
    assert result["summary"]["total_opportunities_count"] >= 1
    assert len(result["opportunities"]) >= 1

