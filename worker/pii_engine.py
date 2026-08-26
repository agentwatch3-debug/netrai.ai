"""Presidio-backed PII detection and reversible tokenization for span payloads."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

from cryptography.fernet import Fernet, MultiFernet
from presidio_analyzer import AnalyzerEngine, Pattern, PatternRecognizer
from presidio_anonymizer import AnonymizerEngine
from presidio_anonymizer.entities import OperatorConfig

ENTITIES = ["EMAIL_ADDRESS", "PHONE_NUMBER", "CREDIT_CARD", "PERSON", "LOCATION", "AADHAAR", "INDIAN_PAN", "API_SECRET"]


def build_multi_fernet(keys: str | list[str] | MultiFernet | None = None) -> MultiFernet:
    """Construct a MultiFernet instance supporting key rotation.

    The first key in the list is used for encryption. All keys are tried in order for decryption.
    Accepts a MultiFernet instance, comma-separated string, list of key strings, or reads from
    PII_FERNET_KEYS / PII_FERNET_KEY environment variables.
    """
    if isinstance(keys, MultiFernet):
        return keys

    raw_keys: list[str] = []
    if keys is None:
        env_val = os.getenv("PII_FERNET_KEYS") or os.getenv("PII_FERNET_KEY")
        if env_val:
            raw_keys = [k.strip() for k in env_val.split(",") if k.strip()]
    elif isinstance(keys, str):
        raw_keys = [k.strip() for k in keys.split(",") if k.strip()]
    elif isinstance(keys, (list, tuple)):
        for item in keys:
            if isinstance(item, str):
                raw_keys.extend([k.strip() for k in item.split(",") if k.strip()])

    if not raw_keys:
        raise ValueError("No valid Fernet encryption keys provided. Set PII_FERNET_KEYS or PII_FERNET_KEY.")

    fernet_instances = [Fernet(k.encode() if isinstance(k, str) else k) for k in raw_keys]
    return MultiFernet(fernet_instances)


@dataclass(frozen=True)
class PiiMapping:
    token: str
    encrypted_value: str


class PiiEngine:
    def __init__(self, fernet_keys: str | list[str] | MultiFernet | None = None) -> None:
        self.fernet = build_multi_fernet(fernet_keys)
        self.analyzer = AnalyzerEngine()
        self.anonymizer = AnonymizerEngine()
        self.analyzer.registry.add_recognizer(PatternRecognizer(supported_entity="AADHAAR", patterns=[Pattern("aadhaar", r"\b\d{4}\s?\d{4}\s?\d{4}\b", 0.9)]))
        self.analyzer.registry.add_recognizer(PatternRecognizer(supported_entity="INDIAN_PAN", patterns=[Pattern("indian_pan", r"\b[A-Z]{5}[0-9]{4}[A-Z]\b", 0.9)]))
        self.analyzer.registry.add_recognizer(PatternRecognizer(supported_entity="API_SECRET", patterns=[Pattern("api_secret", r"\b(?:sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|(?:api[_-]?key|secret|token)[=:]\s*[A-Za-z0-9_./+=-]{16,})\b", 0.85)]))

    def decrypt(self, encrypted_value: str | bytes) -> str:
        """Decrypt a ciphertext using the MultiFernet key ring."""
        val_bytes = encrypted_value.encode() if isinstance(encrypted_value, str) else encrypted_value
        return self.fernet.decrypt(val_bytes).decode()

    def mask_json(self, value: Any) -> tuple[Any, list[PiiMapping]]:
        counter: dict[str, int] = {}
        mappings: list[PiiMapping] = []

        def mask(item: Any) -> Any:
            if isinstance(item, str):
                results = self.analyzer.analyze(text=item, entities=ENTITIES, language="en")
                # Replace right-to-left to keep recognizer character offsets correct.
                text = item
                for result in sorted(results, key=lambda result: result.start, reverse=True):
                    entity = result.entity_type
                    counter[entity] = counter.get(entity, 0) + 1
                    token = f"<{entity}_{counter[entity]}>"
                    original = text[result.start:result.end]
                    anonymized = self.anonymizer.anonymize(text=text, analyzer_results=[result], operators={"DEFAULT": OperatorConfig("replace", {"new_value": token})})
                    text = anonymized.text
                    mappings.append(PiiMapping(token, self.fernet.encrypt(original.encode()).decode()))
                return text
            if isinstance(item, list):
                return [mask(child) for child in item]
            if isinstance(item, dict):
                return {key: mask(child) for key, child in item.items()}
            return item

        return mask(value), mappings
