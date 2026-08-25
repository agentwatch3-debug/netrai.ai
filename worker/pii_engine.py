"""Presidio-backed PII detection and reversible tokenization for span payloads."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from cryptography.fernet import Fernet
from presidio_analyzer import AnalyzerEngine, Pattern, PatternRecognizer
from presidio_anonymizer import AnonymizerEngine
from presidio_anonymizer.entities import OperatorConfig

ENTITIES = ["EMAIL_ADDRESS", "PHONE_NUMBER", "CREDIT_CARD", "PERSON", "LOCATION", "AADHAAR", "INDIAN_PAN", "API_SECRET"]


@dataclass(frozen=True)
class PiiMapping:
    token: str
    encrypted_value: str


class PiiEngine:
    def __init__(self, fernet_key: str) -> None:
        self.fernet = Fernet(fernet_key.encode())
        self.analyzer = AnalyzerEngine()
        self.anonymizer = AnonymizerEngine()
        self.analyzer.registry.add_recognizer(PatternRecognizer(supported_entity="AADHAAR", patterns=[Pattern("aadhaar", r"\b\d{4}\s?\d{4}\s?\d{4}\b", 0.9)]))
        self.analyzer.registry.add_recognizer(PatternRecognizer(supported_entity="INDIAN_PAN", patterns=[Pattern("indian_pan", r"\b[A-Z]{5}[0-9]{4}[A-Z]\b", 0.9)]))
        self.analyzer.registry.add_recognizer(PatternRecognizer(supported_entity="API_SECRET", patterns=[Pattern("api_secret", r"\b(?:sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|(?:api[_-]?key|secret|token)[=:]\s*[A-Za-z0-9_./+=-]{16,})\b", 0.85)]))

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
