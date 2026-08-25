"""Pre-deploy Testing Engine for Golden Datasets, Output Evaluation, and Regression Detection."""

import difflib
import importlib
import json
import logging
import re
import sys
from dataclasses import dataclass, field
from typing import Any, Callable

import httpx

logger = logging.getLogger("agentwatch.testing")


def evaluate_exact_match(actual: Any, expected: Any) -> tuple[bool, float, str | None]:
    """Check if actual output strictly matches expected output."""
    if isinstance(actual, (dict, list)) and isinstance(expected, (dict, list)):
        passed = actual == expected
        score = 1.0 if passed else 0.0
        reason = None if passed else "JSON structure mismatch."
        return passed, score, reason

    actual_str = str(actual).strip()
    expected_str = str(expected).strip()
    passed = actual_str == expected_str
    score = 1.0 if passed else 0.0
    reason = None if passed else "Exact string mismatch."
    return passed, score, reason


def evaluate_semantic_similarity(actual: Any, expected: Any, threshold: float = 0.75) -> tuple[bool, float, str | None]:
    """Calculate semantic text similarity using token/n-gram overlap cosine metrics."""
    actual_str = str(actual).lower().strip()
    expected_str = str(expected).lower().strip()

    if not actual_str or not expected_str:
        return actual_str == expected_str, 1.0 if actual_str == expected_str else 0.0, None

    # Token-based Jaccard and SequenceMatcher similarity
    matcher = difflib.SequenceMatcher(None, actual_str, expected_str)
    ratio = matcher.ratio()

    # Keyword overlap
    tokens_actual = set(re.findall(r"\w+", actual_str))
    tokens_expected = set(re.findall(r"\w+", expected_str))
    overlap = len(tokens_actual.intersection(tokens_expected)) / max(len(tokens_expected), 1)

    combined_score = round(0.5 * ratio + 0.5 * overlap, 3)
    passed = combined_score >= threshold
    reason = None if passed else f"Semantic similarity score {combined_score} is below threshold {threshold}."
    return passed, combined_score, reason


def evaluate_llm_judge(actual: Any, criteria: str) -> tuple[bool, float, str | None]:
    """Heuristic / Rule-based criteria evaluation against expected criteria."""
    actual_str = str(actual).lower()
    criteria_lower = criteria.lower()

    # Extract required phrases or keywords specified in criteria
    # e.g. "must mention order ID and refund timeline"
    keywords = [w for w in re.findall(r"\b[a-z]{4,}\b", criteria_lower) if w not in {"must", "should", "include", "mention", "contain", "ensure", "response", "user"}]
    if not keywords:
        return True, 1.0, None

    matches = [kw for kw in keywords if kw in actual_str]
    match_rate = len(matches) / len(keywords)

    passed = match_rate >= 0.5
    score = round(match_rate, 2)
    reason = None if passed else f"Output failed judge criteria: missing key terms {set(keywords) - set(matches)}."
    return passed, score, reason


def load_runner_function(runner_spec: str) -> Callable[[Any], Any]:
    """Load a runner callable from a string like 'module.submodule:func' or 'path/to/script.py:func'."""
    if ":" not in runner_spec:
        raise ValueError(f"Runner spec must be in the format 'path/to/script.py:function_name' or 'module:function_name', got '{runner_spec}'")

    path_or_mod, func_name = runner_spec.rsplit(":", 1)

    if path_or_mod.endswith(".py"):
        import importlib.util
        spec = importlib.util.spec_from_file_location("dynamic_agent_runner", path_or_mod)
        if spec is None or spec.loader is None:
            raise ImportError(f"Could not load runner script from '{path_or_mod}'")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
    else:
        module = importlib.import_module(path_or_mod)

    runner_func = getattr(module, func_name, None)
    if runner_func is None or not callable(runner_func):
        raise AttributeError(f"Function '{func_name}' not found or not callable in '{path_or_mod}'")

    return runner_func


@dataclass
class TestCaseResult:
    case_id: str
    eval_type: str
    input_data: Any
    expected: Any
    actual: Any
    passed: bool
    score: float
    reason: str | None
    is_regression: bool = False
    diff_text: str | None = None


def format_diff(actual: Any, expected: Any) -> str:
    """Format unified diff between expected and actual outputs."""
    act_lines = json.dumps(actual, indent=2).splitlines() if isinstance(actual, (dict, list)) else str(actual).splitlines()
    exp_lines = json.dumps(expected, indent=2).splitlines() if isinstance(expected, (dict, list)) else str(expected).splitlines()
    diff = difflib.unified_diff(exp_lines, act_lines, fromfile="Expected", tofile="Actual", lineterm="")
    return "\n".join(diff)


class GoldenTestRunner:
    def __init__(
        self,
        endpoint: str = "http://localhost:8000",
        api_key: str = "dev-key",
        org_id: str = "org_dev_demo",
    ) -> None:
        self.endpoint = endpoint.rstrip("/")
        self.api_key = api_key
        self.org_id = org_id

    def fetch_dataset(self, dataset_name: str) -> dict[str, Any]:
        """Fetch golden dataset and test cases from Ingestion API."""
        url = f"{self.endpoint}/v1/datasets/{dataset_name}"
        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.get(url, headers={"Authorization": f"Bearer {self.api_key}"})
                if res.status_code == 200:
                    return res.json().get("data", {})
        except Exception as e:
            logger.warning("Could not fetch remote dataset '%s': %s", dataset_name, e)

        # Built-in fallback cases for customer-support-v1
        return {
            "name": dataset_name,
            "cases": [
                {
                    "case_id": "cs_01_order_status",
                    "eval_type": "exact",
                    "input": {"query": "Where is my order #88921?"},
                    "expected_output": {"status": "shipped", "tracking_number": "TRK-88921-IN", "eta_days": 2},
                },
                {
                    "case_id": "cs_02_return_policy",
                    "eval_type": "semantic",
                    "input": {"query": "What is the return window for electronics?"},
                    "expected_output": "Items can be returned within 30 days of delivery with original packaging and invoice.",
                },
                {
                    "case_id": "cs_03_refund_escalation",
                    "eval_type": "llm_judge",
                    "input": {"query": "I was double charged on my card! Fix this immediately."},
                    "expected_criteria": "Must apologize for the inconvenience, confirm refund request within 3-5 business days, and provide support ticket reference.",
                },
            ],
        }

    def fetch_previous_run(self, dataset_name: str) -> dict[str, Any] | None:
        """Fetch previous test run for regression detection."""
        url = f"{self.endpoint}/v1/test-runs/latest?dataset_name={dataset_name}"
        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.get(url, headers={"Authorization": f"Bearer {self.api_key}"})
                if res.status_code == 200:
                    return res.json().get("data")
        except Exception:
            pass
        return None

    def record_test_run(
        self,
        dataset_name: str,
        results: list[TestCaseResult],
        git_commit: str | None = None,
        git_branch: str | None = None,
    ) -> None:
        """Post test run execution results to Ingestion API."""
        url = f"{self.endpoint}/v1/test-runs"
        total = len(results)
        passed = sum(1 for r in results if r.passed)
        failed = total - passed
        has_regressions = any(r.is_regression for r in results)

        payload = {
            "dataset_name": dataset_name,
            "git_commit": git_commit,
            "git_branch": git_branch,
            "total_cases": total,
            "passed_cases": passed,
            "failed_cases": failed,
            "has_regressions": has_regressions,
            "results": [
                {
                    "case_id": r.case_id,
                    "eval_type": r.eval_type,
                    "passed": r.passed,
                    "score": r.score,
                    "is_regression": r.is_regression,
                    "reason": r.reason,
                }
                for r in results
            ],
        }

        try:
            with httpx.Client(timeout=10.0) as client:
                client.post(url, json=payload, headers={"Authorization": f"Bearer {self.api_key}"})
        except Exception as e:
            logger.debug("Failed to record test run to server: %s", e)

    def run_tests(
        self,
        dataset_name: str,
        runner_fn: Callable[[Any], Any],
        git_commit: str | None = None,
        git_branch: str | None = None,
    ) -> list[TestCaseResult]:
        """Execute all dataset cases through the runner function and evaluate results."""
        dataset = self.fetch_dataset(dataset_name)
        cases = dataset.get("cases", [])
        prev_run = self.fetch_previous_run(dataset_name)
        prev_passed_case_ids = set()
        if prev_run and isinstance(prev_run.get("results"), list):
            prev_passed_case_ids = {r.get("case_id") for r in prev_run["results"] if r.get("passed")}

        results: list[TestCaseResult] = []

        for case in cases:
            case_id = case.get("case_id", "unnamed_case")
            eval_type = case.get("eval_type", "exact")
            input_data = case.get("input", {})
            expected_output = case.get("expected_output")
            expected_criteria = case.get("expected_criteria")

            try:
                actual_output = runner_fn(input_data)
            except Exception as e:
                actual_output = f"RUNNER_EXCEPTION: {e}"

            if eval_type == "exact":
                passed, score, reason = evaluate_exact_match(actual_output, expected_output)
            elif eval_type == "semantic":
                passed, score, reason = evaluate_semantic_similarity(actual_output, expected_output)
            elif eval_type == "llm_judge":
                passed, score, reason = evaluate_llm_judge(actual_output, expected_criteria or "")
            else:
                passed, score, reason = evaluate_exact_match(actual_output, expected_output)

            # Check regression: was passing in previous run, but failed now
            is_regression = not passed and case_id in prev_passed_case_ids

            diff_str = None
            if not passed and expected_output is not None:
                diff_str = format_diff(actual_output, expected_output)

            results.append(
                TestCaseResult(
                    case_id=case_id,
                    eval_type=eval_type,
                    input_data=input_data,
                    expected=expected_output or expected_criteria,
                    actual=actual_output,
                    passed=passed,
                    score=score,
                    reason=reason,
                    is_regression=is_regression,
                    diff_text=diff_str,
                )
            )

        self.record_test_run(dataset_name, results, git_commit=git_commit, git_branch=git_branch)
        return results
