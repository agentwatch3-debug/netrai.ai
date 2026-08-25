import json
import pytest
import respx
from httpx import Response

from agentwatch.testing import (
    GoldenTestRunner,
    evaluate_exact_match,
    evaluate_llm_judge,
    evaluate_semantic_similarity,
    format_diff,
    load_runner_function,
)


def test_evaluate_exact_match():
    # String match
    passed, score, reason = evaluate_exact_match("Hello world", "Hello world")
    assert passed is True
    assert score == 1.0

    # String mismatch
    passed, score, reason = evaluate_exact_match("Hello world", "Hello there")
    assert passed is False
    assert score == 0.0

    # JSON dict match
    passed, score, reason = evaluate_exact_match({"a": 1, "b": 2}, {"b": 2, "a": 1})
    assert passed is True

    # JSON dict mismatch
    passed, score, reason = evaluate_exact_match({"a": 1}, {"a": 2})
    assert passed is False


def test_evaluate_semantic_similarity():
    # Similar phrases
    actual = "Items can be returned within thirty days if you keep the original packaging."
    expected = "Items can be returned within 30 days of delivery with original packaging and invoice."
    passed, score, reason = evaluate_semantic_similarity(actual, expected, threshold=0.60)
    assert passed is True
    assert score > 0.60

    # Dissimilar phrases
    actual_bad = "No refunds allowed under any circumstance."
    passed, score, reason = evaluate_semantic_similarity(actual_bad, expected, threshold=0.60)
    assert passed is False


def test_evaluate_llm_judge():
    criteria = "Must apologize for the inconvenience and confirm refund within 3-5 business days."
    good_output = "We sincerely apologize for the inconvenience. Your refund has been initiated and will arrive in 3-5 business days."
    passed, score, reason = evaluate_llm_judge(good_output, criteria)
    assert passed is True

    bad_output = "Go away."
    passed, score, reason = evaluate_llm_judge(bad_output, criteria)
    assert passed is False


def test_format_diff():
    diff = format_diff({"status": "failed"}, {"status": "shipped"})
    assert "Expected" in diff
    assert "Actual" in diff


@respx.mock
def test_golden_test_runner_detects_regressions():
    endpoint = "https://ingestion.test"
    dataset_route = respx.get(f"{endpoint}/v1/datasets/customer-support-v1").mock(
        return_value=Response(
            200,
            json={
                "data": {
                    "name": "customer-support-v1",
                    "cases": [
                        {
                            "case_id": "cs_01_order_status",
                            "eval_type": "exact",
                            "input": {"query": "order #88921"},
                            "expected_output": {"status": "shipped"},
                        }
                    ],
                }
            },
        )
    )

    # Previous run had cs_01 passing
    latest_run_route = respx.get(f"{endpoint}/v1/test-runs/latest?dataset_name=customer-support-v1").mock(
        return_value=Response(
            200,
            json={
                "data": {
                    "id": 1,
                    "dataset_name": "customer-support-v1",
                    "results": [{"case_id": "cs_01_order_status", "passed": True}],
                }
            },
        )
    )

    record_route = respx.post(f"{endpoint}/v1/test-runs").mock(return_value=Response(200, json={"status": "recorded"}))

    runner = GoldenTestRunner(endpoint=endpoint, api_key="test-key")

    # Broken runner function that fails cs_01
    def broken_agent(inp: dict) -> dict:
        return {"status": "cancelled"}

    results = runner.run_tests("customer-support-v1", broken_agent)
    assert len(results) == 1
    res = results[0]
    assert res.passed is False
    assert res.is_regression is True  # Regression flagged!
