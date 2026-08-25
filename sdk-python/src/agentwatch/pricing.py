"""Approximate direct-provider text-token prices in USD per million tokens."""

from dataclasses import dataclass


@dataclass(frozen=True)
class ModelPrice:
    input_per_million: float
    output_per_million: float


# Keep this small and explicit: unknown models report a zero estimate rather than guessing.
PRICING: dict[str, ModelPrice] = {
    # ── OpenAI ──────────────────────────────────────────────────────────────
    "gpt-4.1": ModelPrice(2.00, 8.00),
    "gpt-4.1-mini": ModelPrice(0.40, 1.60),
    "gpt-4.1-nano": ModelPrice(0.10, 0.40),
    "gpt-4o": ModelPrice(2.50, 10.00),
    "gpt-4o-mini": ModelPrice(0.15, 0.60),
    "o1": ModelPrice(15.00, 60.00),
    "o3-mini": ModelPrice(1.10, 4.40),
    "o4-mini": ModelPrice(1.10, 4.40),
    # ── Anthropic ───────────────────────────────────────────────────────────
    "claude-opus-4-1": ModelPrice(15.00, 75.00),
    "claude-opus-4": ModelPrice(15.00, 75.00),
    "claude-sonnet-4": ModelPrice(3.00, 15.00),
    "claude-3-7-sonnet": ModelPrice(3.00, 15.00),
    "claude-3-5-haiku": ModelPrice(0.80, 4.00),
    "claude-3-5-sonnet": ModelPrice(3.00, 15.00),
    "claude-3-haiku": ModelPrice(0.25, 1.25),
    # ── Google Gemini ────────────────────────────────────────────────────────
    "gemini-2.5-pro": ModelPrice(1.25, 10.00),
    "gemini-2.5-flash": ModelPrice(0.075, 0.30),
    "gemini-2.0-flash": ModelPrice(0.10, 0.40),
    "gemini-1.5-pro": ModelPrice(1.25, 5.00),
    "gemini-1.5-flash": ModelPrice(0.075, 0.30),
    "gemini-3.6-flash": ModelPrice(0.00, 0.00),   # free tier
    # ── Groq (ultra-fast inference) ─────────────────────────────────────────
    "llama-3.3-70b": ModelPrice(0.59, 0.79),
    "llama-3.1-8b": ModelPrice(0.05, 0.08),
    "mixtral-8x7b": ModelPrice(0.24, 0.24),
    "gemma2-9b": ModelPrice(0.20, 0.20),
    # ── Ollama / Local (always free) ─────────────────────────────────────────
    "llama3": ModelPrice(0.00, 0.00),
    "mistral": ModelPrice(0.00, 0.00),
    "phi3": ModelPrice(0.00, 0.00),
}


def estimate_cost(model: str | None, prompt_tokens: int | None, completion_tokens: int | None) -> float | None:
    if not model:
        return None
    normalized = model.lower()
    price = next((price for name, price in PRICING.items() if normalized.startswith(name)), None)
    if price is None:
        return None
    return round(((prompt_tokens or 0) * price.input_per_million + (completion_tokens or 0) * price.output_per_million) / 1_000_000, 10)
