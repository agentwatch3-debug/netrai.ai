"""Output Policy Scanning Engine for Industry Regulatory Guardrails."""

import logging
import re
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger("agentwatch.output_policy")

DEFAULT_BANKING_RULES = [
    {
        "id": "bnk_01",
        "name": "banking_interest_rate_disclaimer",
        "pattern_type": "disclaimer_required",
        "trigger_pattern": r"\b\d+(?:\.\d+)?%\s*(?:APR|interest|p\.a\.|annual|per annum)\b",
        "required_disclaimer": r"(subject to (terms|status|approval)|indicative only|terms and conditions apply|variable rate|rates may vary)",
        "action": "block",
        "message": "Regulatory violation: Interest rate quotes must include an explicit disclaimer (e.g. 'subject to terms and conditions').",
    },
    {
        "id": "bnk_02",
        "name": "banking_no_definitive_investment_advice",
        "pattern_type": "regex",
        "pattern": r"\b(guaranteed\s+returns?|you\s+(must|should definitely)\s+(buy|invest in|short|sell)\b|risk-free\s+profit|100%\s+safe\s+investment)\b",
        "action": "block",
        "message": "Regulatory violation: AI agents are strictly prohibited from giving definitive investment advice or guaranteed return claims.",
    },
]

DEFAULT_HEALTHCARE_RULES = [
    {
        "id": "med_01",
        "name": "healthcare_no_definitive_diagnosis",
        "pattern_type": "regex",
        "pattern": r"\b(you\s+(definitely\s+have|are\s+diagnosed\s+with)|this\s+is\s+a\s+confirmed\s+case\s+of|you\s+suffer\s+from\s+[a-z\s]+disease)\b",
        "action": "block",
        "message": "Medical compliance violation: AI cannot provide definitive medical diagnoses.",
    },
    {
        "id": "med_02",
        "name": "healthcare_symptom_disclaimer_required",
        "pattern_type": "disclaimer_required",
        "trigger_pattern": r"\b(symptoms?|pain|fever|infection|treatment|dosage|medication|swelling|headache|rash)\b",
        "required_disclaimer": r"(consult\s+(a\s+)?(doctor|physician|healthcare\s+professional|medical\s+expert)|seek\s+medical\s+advice)",
        "action": "flag",
        "message": "Medical compliance advisory: Symptom-related responses must include a doctor consultation disclaimer.",
    },
]


@dataclass
class PolicyViolationItem:
    rule_id: str
    rule_name: str
    action: str  # "block" | "flag"
    matched_text: str
    message: str
    output_snippet: str


@dataclass
class OutputPolicyScanResult:
    is_blocked: bool
    violations: list[PolicyViolationItem] = field(default_factory=list)


class OutputPolicyScanner:
    def __init__(self, custom_rules: list[dict[str, Any]] | None = None) -> None:
        self.rules = custom_rules if custom_rules is not None else (DEFAULT_BANKING_RULES + DEFAULT_HEALTHCARE_RULES)

    def scan(self, text: str, rules: list[dict[str, Any]] | None = None) -> OutputPolicyScanResult:
        """Scan LLM output text against regulatory policy rules."""
        if not text or not isinstance(text, str):
            return OutputPolicyScanResult(is_blocked=False, violations=[])

        active_rules = rules if rules is not None else self.rules
        violations: list[PolicyViolationItem] = []
        is_blocked = False

        for r in active_rules:
            rule_id = r.get("id", "rule_custom")
            rule_name = r.get("name", "unnamed_rule")
            pattern_type = r.get("pattern_type", "regex")
            action = r.get("action", "flag")
            message = r.get("message", "Output violated compliance policy.")

            if pattern_type == "regex":
                pat = r.get("pattern", "")
                if pat:
                    m = re.search(pat, text, re.IGNORECASE)
                    if m:
                        matched = m.group(0)
                        viol = PolicyViolationItem(
                            rule_id=rule_id,
                            rule_name=rule_name,
                            action=action,
                            matched_text=matched,
                            message=message,
                            output_snippet=text[:250],
                        )
                        violations.append(viol)
                        if action == "block":
                            is_blocked = True

            elif pattern_type == "keyword":
                kw = r.get("pattern", "")
                if kw and kw.lower() in text.lower():
                    viol = PolicyViolationItem(
                        rule_id=rule_id,
                        rule_name=rule_name,
                        action=action,
                        matched_text=kw,
                        message=message,
                        output_snippet=text[:250],
                    )
                    violations.append(viol)
                    if action == "block":
                        is_blocked = True

            elif pattern_type == "disclaimer_required":
                trigger_pat = r.get("trigger_pattern", "")
                disclaimer_pat = r.get("required_disclaimer", "")
                if trigger_pat and disclaimer_pat:
                    m = re.search(trigger_pat, text, re.IGNORECASE)
                    if m:
                        # Check if disclaimer exists anywhere in text
                        has_disclaimer = re.search(disclaimer_pat, text, re.IGNORECASE) is not None
                        if not has_disclaimer:
                            viol = PolicyViolationItem(
                                rule_id=rule_id,
                                rule_name=rule_name,
                                action=action,
                                matched_text=m.group(0),
                                message=message,
                                output_snippet=text[:250],
                            )
                            violations.append(viol)
                            if action == "block":
                                is_blocked = True

        return OutputPolicyScanResult(is_blocked=is_blocked, violations=violations)


scanner = OutputPolicyScanner()


def scan_output(text: str, rules: list[dict[str, Any]] | None = None) -> OutputPolicyScanResult:
    return scanner.scan(text, rules=rules)
