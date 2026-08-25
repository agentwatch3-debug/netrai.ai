"""High-speed synchronous client-side Prompt Injection Detector for Python SDK."""

import base64
import binascii
import logging
import re
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger("agentwatch.injection")

INSTRUCTION_OVERRIDE_PATTERNS = [
    re.compile(r"ignore\s+(all\s+)?(previous|prior|above|existing)\s+(instructions|prompts|commands|rules|directives)", re.IGNORECASE),
    re.compile(r"disregard\s+(all\s+)?(the\s+)?(previous|prior|system)\s+(instructions|prompt|rules|commands)", re.IGNORECASE),
    re.compile(r"you\s+are\s+now\s+(a|an|in|acting\s+as)\s+", re.IGNORECASE),
    re.compile(r"(forget|drop|bypass)\s+(all\s+)?(prior|previous|existing|system)\s+(guidelines|instructions|context|constraints)", re.IGNORECASE),
    re.compile(r"(do\s+anything\s+now|DAN\s+mode|jailbreak|developer\s+mode\s+enabled)", re.IGNORECASE),
    re.compile(r"override\s+(all\s+)?system\s+(prompt|instructions|settings)", re.IGNORECASE),
    re.compile(r"new\s+system\s+directive:\s*", re.IGNORECASE),
]

ROLE_OVERRIDE_PATTERNS = [
    re.compile(r"<\|im_start\|>\s*system", re.IGNORECASE),
    re.compile(r"\[INST\]\s*<<SYS>>", re.IGNORECASE),
    re.compile(r"(^|\n)\s*system:\s*(you are|instructions|override)", re.IGNORECASE),
    re.compile(r"['\"]?role['\"]?\s*:\s*['\"]?system['\"]?", re.IGNORECASE),
    re.compile(r"###\s*(instruction|system|prompt|override)\s*###", re.IGNORECASE),
]

DELIMITER_INJECTION_PATTERNS = [
    re.compile(r"(---|===|###)\s*(BEGIN|START|SYSTEM)\s*(SYSTEM|INSTRUCTIONS|PROMPT)?\s*(---|===|###)", re.IGNORECASE),
    re.compile(r"```(system|instructions)[\s\S]*?```", re.IGNORECASE),
    re.compile(r"<system>[\s\S]*?</system>", re.IGNORECASE),
    re.compile(r"\[SYSTEM_PROMPT\][\s\S]*?\[/SYSTEM_PROMPT\]", re.IGNORECASE),
]

BASE64_CANDIDATE = re.compile(r"(?:[A-Za-z0-9+/]{4}){4,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?")
HEX_CANDIDATE = re.compile(r"(?:\\x[0-9a-fA-F]{2}){4,}|(?:[0-9a-fA-F]{2}){8,}")


@dataclass
class InjectionCheckResult:
    is_injection: bool
    risk_score: float
    flags: list[str] = field(default_factory=list)
    matched_patterns: list[str] = field(default_factory=list)


def detect_prompt_injection(text: Any, threshold: float = 0.70) -> InjectionCheckResult:
    """Analyze prompt text or message list for injection attacks and calculate risk score (0.0 to 1.0)."""
    if isinstance(text, (list, tuple)):
        # Extract text from message dictionaries
        extracted_parts = []
        for msg in text:
            if isinstance(msg, dict):
                content = msg.get("content")
                if isinstance(content, str):
                    extracted_parts.append(content)
            elif isinstance(msg, str):
                extracted_parts.append(msg)
        raw_text = " \n ".join(extracted_parts)
    elif isinstance(text, str):
        raw_text = text
    else:
        raw_text = str(text) if text is not None else ""

    if not raw_text:
        return InjectionCheckResult(is_injection=False, risk_score=0.0)

    accumulated_score = 0.0
    flags: list[str] = []
    matched_patterns: list[str] = []

    # 1. Instruction Override
    for p in INSTRUCTION_OVERRIDE_PATTERNS:
        m = p.search(raw_text)
        if m:
            accumulated_score += 0.85
            flags.append("instruction_override")
            matched_patterns.append(m.group(0))
            break

    # 2. Role Override
    for p in ROLE_OVERRIDE_PATTERNS:
        m = p.search(raw_text)
        if m:
            accumulated_score += 0.80
            flags.append("role_override")
            matched_patterns.append(m.group(0))
            break

    # 3. Delimiter Injection
    for p in DELIMITER_INJECTION_PATTERNS:
        m = p.search(raw_text)
        if m:
            accumulated_score += 0.75
            flags.append("delimiter_injection")
            matched_patterns.append(m.group(0))
            break

    # 4. Encoded Payloads
    for match in BASE64_CANDIDATE.finditer(raw_text):
        chunk = match.group(0)
        if len(chunk) >= 16:
            try:
                decoded = base64.b64decode(chunk).decode("utf-8", errors="ignore")
                if decoded and any(p.search(decoded) for p in INSTRUCTION_OVERRIDE_PATTERNS + ROLE_OVERRIDE_PATTERNS):
                    accumulated_score += 0.90
                    flags.append("base64_encoded_injection")
                    matched_patterns.append(f"base64:{chunk[:16]}")
                    break
            except Exception:
                pass

    for match in HEX_CANDIDATE.finditer(raw_text):
        chunk = match.group(0)
        try:
            raw_hex = chunk.replace("\\x", "")
            decoded = binascii.unhexlify(raw_hex).decode("utf-8", errors="ignore")
            if decoded and any(p.search(decoded) for p in INSTRUCTION_OVERRIDE_PATTERNS + ROLE_OVERRIDE_PATTERNS):
                accumulated_score += 0.90
                flags.append("hex_encoded_injection")
                matched_patterns.append(f"hex:{chunk[:16]}")
                break
        except Exception:
            pass

    # 5. Extraction Probe
    if re.search(r"(repeat|reveal|print|show)\s+(the\s+)?(above|system|initial)\s+(prompt|text|instructions)", raw_text, re.IGNORECASE):
        accumulated_score += 0.65
        flags.append("prompt_extraction_probe")
        matched_patterns.append("prompt_extraction")

    final_score = min(1.0, round(accumulated_score, 2))
    return InjectionCheckResult(
        is_injection=final_score >= threshold,
        risk_score=final_score,
        flags=list(set(flags)),
        matched_patterns=matched_patterns,
    )
