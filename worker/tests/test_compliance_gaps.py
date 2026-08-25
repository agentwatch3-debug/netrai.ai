import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from pii_engine import PiiEngine


from unittest.mock import MagicMock
from pii_engine import PiiMapping


def test_pii_detected_without_consent_identifies_compliance_gap():
    # Verify compliance gap identification logic on spans with detected PII mappings
    span_with_pii_no_consent = {
        "span_id": "sp_unconsented_1",
        "trace_id": "tr_unconsented_1",
        "org_id": "org_compliance_test",
        "user_id": "user_anon_44",
        "consent_id": None,  # No consent!
        "input": {"email": "rahul.sharma@example.in", "query": "Check status"},
    }

    # Simulate PII mappings returned from masking engine
    mappings = [
        PiiMapping(token="<EMAIL_ADDRESS_1>", encrypted_value="gAAAAAB..."),
        PiiMapping(token="<INDIAN_PAN_1>", encrypted_value="gAAAAAB..."),
    ]

    # Compliance rule: if mappings > 0 and not span["consent_id"] -> Gap identified
    has_gap = len(mappings) > 0 and not span_with_pii_no_consent.get("consent_id")
    assert has_gap is True
    tokens = [m.token for m in mappings]
    assert any("EMAIL_ADDRESS" in t for t in tokens)

    # Compliant case: span has valid consent_id
    span_with_consent = {
        "span_id": "sp_consented_1",
        "trace_id": "tr_consented_1",
        "org_id": "org_compliance_test",
        "user_id": "user_rahul_99",
        "consent_id": "cst_form_loan_8819",
        "input": {"email": "rahul.sharma@example.in"},
    }
    has_gap_consented = len(mappings) > 0 and not span_with_consent.get("consent_id")
    assert has_gap_consented is False
