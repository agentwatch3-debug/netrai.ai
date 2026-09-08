import os
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from worker.retry_detector import (
    RetryLoopDetector,
    compute_semantic_similarity,
)


def test_semantic_similarity_rephrasing_detection():
    # High similarity for rephrased request
    msg1 = "Please cancel my subscription and refund my bank account."
    msg2 = "I want to cancel the subscription and get a refund to my bank please."
    sim_high = compute_semantic_similarity(msg1, msg2)
    assert sim_high >= 0.65

    # Low similarity for unrelated queries
    msg3 = "What is the capital city of France?"
    sim_low = compute_semantic_similarity(msg1, msg3)
    assert sim_low < 0.20


def test_misunderstanding_loop_flagged_for_unresolved_rephrasings():
    detector = RetryLoopDetector(similarity_threshold=0.55, min_rephrase_turns=3)


    turns = [
        {
            "turn_index": 1,
            "user_message": "Cancel order #ORD-1234 and refund my card.",
            "assistant_message": "I can help check order #ORD-1234 status.",
            "tokens": 1200,
            "cost_usd": 0.012,
        },
        {
            "turn_index": 2,
            "user_message": "No, please cancel order 1234 and process my refund.",
            "assistant_message": "Your order is scheduled for dispatch tomorrow.",
            "tokens": 1500,
            "cost_usd": 0.015,
        },
        {
            "turn_index": 3,
            "user_message": "I said cancel order 1234 and refund the card immediately!",
            "assistant_message": "Let me look up the shipping carrier...",
            "tokens": 1800,
            "cost_usd": 0.018,
            "task_completed": False,
        },
    ]

    alert = detector.analyze_session(
        org_id="org_test",
        session_id="sess_confusion_01",
        turns=turns,
        agent_id="support_bot",
        user_id="user_rahul",
    )

    assert alert is not None
    assert alert.session_id == "sess_confusion_01"
    assert alert.retry_count == 3
    assert alert.total_tokens_in_loop == 4500
    assert abs(alert.total_cost_in_loop - 0.045) < 0.0001
    assert alert.loop_type == "misunderstanding_loop"
    assert len(alert.sample_rephrasings) == 3
    assert alert.task_completed is False


def test_successful_task_completion_suppresses_misunderstanding_alert():
    detector = RetryLoopDetector(similarity_threshold=0.65, min_rephrase_turns=3)

    # Even with rephrasings, if task was successfully completed (e.g. ticket_resolved=True), do not flag
    turns = [
        {
            "turn_index": 1,
            "user_message": "Can I update my email address?",
            "tokens": 1000,
            "cost_usd": 0.01,
        },
        {
            "turn_index": 2,
            "user_message": "Please update my account email address to new@test.com",
            "tokens": 1200,
            "cost_usd": 0.012,
        },
        {
            "turn_index": 3,
            "user_message": "Update account email to new@test.com now",
            "tokens": 1400,
            "cost_usd": 0.014,
            "metadata": {"ticket_resolved": True},
        },
    ]

    alert = detector.analyze_session(
        org_id="org_test",
        session_id="sess_resolved_02",
        turns=turns,
    )

    assert alert is None


def test_tool_argument_thrashing_detection():
    detector = RetryLoopDetector(similarity_threshold=0.60, min_rephrase_turns=3)

    turns = [
        {
            "turn_index": 1,
            "user_message": "Find customers in Germany with enterprise tier",
            "tool_calls": [{"name": "sql_query", "input": {"sql": "SELECT * FROM users WHERE country = 'DE'"}}],
            "tokens": 1000,
            "cost_usd": 0.01,
        },
        {
            "turn_index": 2,
            "user_message": "Find German accounts on enterprise plan",
            "tool_calls": [{"name": "sql_query", "input": {"sql": "SELECT * FROM accounts WHERE nation = 'Germany'"}}],
            "tokens": 1200,
            "cost_usd": 0.012,
        },
        {
            "turn_index": 3,
            "user_message": "Query all enterprise customers located in Germany",
            "tool_calls": [{"name": "sql_query", "input": {"sql": "SELECT * FROM orgs WHERE region = 'DE' AND plan = 'enterprise'"}}],
            "tokens": 1400,
            "cost_usd": 0.014,
        },
    ]

    alert = detector.analyze_session(
        org_id="org_test",
        session_id="sess_tool_thrash_03",
        turns=turns,
        agent_id="sql_bot",
    )

    assert alert is not None
    assert alert.tool_thrashing_detected is True
    assert alert.loop_type == "tool_arg_thrashing"
    assert alert.retry_count >= 2
