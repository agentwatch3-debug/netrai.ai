import pytest
from worker.protect import ProtectEngine, evaluate_response_gate


def test_protect_engine_faithfulness_passed():
    engine = ProtectEngine(db_url="postgresql://localhost:5432/test")
    context = "AgentWatch provides enterprise agent observability with SHA-256 tamper-evident audit logging."
    output = "AgentWatch provides enterprise agent observability and SHA-256 tamper-evident audit logging."

    res = engine.evaluate_response(
        response_text=output,
        context_text=context,
        default_score_type="faithfulness",
        default_threshold=0.7,
        default_action="block",
    )
    assert res.is_passed is True
    assert res.score >= 0.7
    assert res.action_taken == "passed"
    assert len(res.unsupported_claims) == 0


def test_protect_engine_faithfulness_blocked_on_hallucination():
    engine = ProtectEngine(db_url="postgresql://localhost:5432/test")
    context = "The return policy is strictly 30 days with receipt."
    output = "We offer a 365-day full refund warranty with free international shipping and bonus store credits."

    res = engine.evaluate_response(
        response_text=output,
        context_text=context,
        default_score_type="faithfulness",
        default_threshold=0.7,
        default_action="block",
    )
    assert res.is_passed is False
    assert res.score < 0.7
    assert res.action_taken == "block"
    assert len(res.unsupported_claims) > 0


def test_protect_engine_reroute_to_fallback_model():
    engine = ProtectEngine(db_url="postgresql://localhost:5432/test")
    context = "Plan tier allows 5 team members."
    output = "Unlimited enterprise users and global cluster access with free lifetime licenses."

    res = engine.evaluate_response(
        response_text=output,
        context_text=context,
        default_score_type="faithfulness",
        default_threshold=0.7,
        default_action="reroute_to_model",
        default_fallback_model="gpt-4o",
    )
    assert res.is_passed is False
    assert res.action_taken == "reroute_to_model"
    assert res.fallback_model == "gpt-4o"


def test_protect_engine_factuality_flag_action():
    engine = ProtectEngine(db_url="postgresql://localhost:5432/test")
    # Closed-book response with speculative hedging
    output = "The secret treasure was allegedly discovered around roughly 1850 according to unverified rumors."

    res = engine.evaluate_response(
        response_text=output,
        context_text=None,
        default_score_type="factuality",
        default_threshold=0.9,
        default_action="flag",
    )
    assert res.score_type == "factuality"
    assert res.action_taken == "flag"
    assert len(res.uncertain_claims) > 0


def test_evaluate_response_gate_helper():
    context = "Solar power converts sunlight into electricity."
    output = "Solar power converts sunlight into electricity."
    res = evaluate_response_gate(response_text=output, context_text=context)
    assert res.is_passed is True
