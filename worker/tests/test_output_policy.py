import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from output_policy import OutputPolicyScanner, scan_output


def test_banking_interest_rate_without_disclaimer_is_blocked():
    text = "We are pleased to approve your loan at a special rate of 7.9% APR for 36 months."
    res = scan_output(text)
    assert res.is_blocked is True
    assert len(res.violations) == 1
    assert res.violations[0].rule_name == "banking_interest_rate_disclaimer"
    assert res.violations[0].action == "block"


def test_banking_interest_rate_with_disclaimer_is_allowed():
    text = "We offer loans starting from 7.9% APR. Rates are indicative only and subject to terms and credit approval."
    res = scan_output(text)
    assert res.is_blocked is False
    assert len(res.violations) == 0


def test_banking_definitive_investment_advice_is_blocked():
    text = "Based on market indicators, you should definitely buy AAPL stock today for guaranteed returns."
    res = scan_output(text)
    assert res.is_blocked is True
    assert any(v.rule_name == "banking_no_definitive_investment_advice" for v in res.violations)


def test_healthcare_definitive_diagnosis_is_blocked():
    text = "Looking at your symptoms, you definitely have acute bronchitis. Start antibiotics."
    res = scan_output(text)
    assert res.is_blocked is True
    assert any(v.rule_name == "healthcare_no_definitive_diagnosis" for v in res.violations)


def test_healthcare_symptom_response_with_doctor_disclaimer():
    text = "If you have a persistent cough and fever, please consult a doctor for a professional medical evaluation."
    res = scan_output(text)
    assert res.is_blocked is False
    assert len(res.violations) == 0


def test_clean_benign_response_passes():
    text = "Thank you for contacting customer support. Your appointment is confirmed for Tuesday at 3 PM."
    res = scan_output(text)
    assert res.is_blocked is False
    assert len(res.violations) == 0
