"""Cost Optimization Advisor Engine.

Analyzes LLM spans across agents for:
1. Prompt Caching Opportunities: Detects static/near-duplicate system prompts or preamble
   blocks sent repeatedly across calls, calculates provider-specific cache discounts,
   and projects monthly INR savings.
2. Context Length & RAG Pruning Advisor: Flags spans where output tokens are small relative
   to input tokens by an unusual ratio (e.g. >25:1), pinpointing bloated context and
   RAG over-retrieval.
"""

import hashlib
import json
import logging
import math
import re
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass, field
from typing import Any, Optional

logger = logging.getLogger("agentwatch.cost_optimizer")

# Standard currency conversion rate for Indian engineering ROI
USD_TO_INR_RATE = 83.5

# Provider caching discount benchmarks
PROVIDER_CACHE_DISCOUNTS = {
    "anthropic": 0.90,  # 90% discount on cache read tokens (e.g. Claude 3.5 Sonnet)
    "claude": 0.90,
    "openai": 0.50,     # 50% discount on cached prompt tokens (GPT-4o, GPT-4o-mini)
    "gpt": 0.50,
    "deepseek": 0.75,   # 75-80% discount on context caching
    "gemini": 0.75,     # 75% discount on Gemini context caching
    "default": 0.60,
}

# Base token cost per 1M input tokens (approximate USD)
MODEL_INPUT_COST_PER_MILLION = {
    "claude-3-5-sonnet": 3.00,
    "claude-3-haiku": 0.25,
    "claude-3-opus": 15.00,
    "gpt-4o": 2.50,
    "gpt-4o-mini": 0.15,
    "gpt-4-turbo": 10.00,
    "text-embedding-3-small": 0.02,
    "default": 2.00,
}


@dataclass
class OptimizationOpportunity:
    advisor_type: str  # "prompt_caching" | "context_pruning"
    agent_id: str
    agent_name: str
    provider: str
    model: str
    headline: str
    detail: str
    recommended_action: str
    code_example: Optional[str] = None
    repeated_prompt_pct: float = 0.0
    static_token_count: int = 0
    input_to_output_ratio: float = 0.0
    avg_input_tokens: int = 0
    avg_output_tokens: int = 0
    sample_call_count: int = 0
    estimated_monthly_calls: int = 0
    estimated_cost_reduction_pct: float = 0.0
    estimated_monthly_savings_usd: float = 0.0
    estimated_monthly_savings_inr: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def normalize_prompt_text(text: str) -> str:
    """Normalize whitespace and lowercase text for hashing and prefix matching."""
    if not text:
        return ""
    return re.sub(r"\s+", " ", text.strip().lower())


def extract_prompt_fingerprint(prompt_content: Any, prefix_chars: int = 800) -> tuple[str, str, int]:
    """Extract a normalized fingerprint and estimated token count for a prompt.

    Returns (hash_fingerprint, prefix_preview, estimated_token_count).
    """
    text = ""
    if isinstance(prompt_content, str):
        text = prompt_content
    elif isinstance(prompt_content, list):
        for item in prompt_content:
            if isinstance(item, dict):
                role = item.get("role", "")
                content = str(item.get("content", ""))
                if role in ("system", "developer"):
                    text = content + " " + text
                else:
                    text += " " + content
            else:
                text += " " + str(item)
    elif isinstance(prompt_content, dict):
        text = json.dumps(prompt_content, sort_keys=True)

    normalized = normalize_prompt_text(text)
    if not normalized:
        return ("", "", 0)

    prefix = normalized[:prefix_chars]
    fp_hash = hashlib.sha256(prefix.encode("utf-8")).hexdigest()
    est_tokens = max(1, len(text) // 4)
    preview = text[:200] + ("..." if len(text) > 200 else "")

    return (fp_hash, preview, est_tokens)


def detect_provider_from_model(model_name: str) -> str:
    """Detect LLM provider from model string."""
    m = (model_name or "").lower()
    if "claude" in m or "anthropic" in m:
        return "anthropic"
    if "gpt" in m or "o1" in m or "o3" in m or "openai" in m:
        return "openai"
    if "gemini" in m or "google" in m:
        return "gemini"
    if "deepseek" in m:
        return "deepseek"
    return "default"


def get_input_cost_per_million(model_name: str) -> float:
    """Get input cost per 1M tokens for a given model."""
    m = (model_name or "").lower()
    for key, cost in MODEL_INPUT_COST_PER_MILLION.items():
        if key in m:
            return cost
    return MODEL_INPUT_COST_PER_MILLION["default"]


def analyze_prompt_caching(
    spans: list[dict[str, Any]],
    min_static_tokens: int = 800,
    min_repetition_threshold: float = 0.50,
) -> list[OptimizationOpportunity]:
    """Analyze spans per agent to detect repeated large system prompts suitable for prompt caching."""
    agent_spans: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for s in spans:
        if s.get("span_type") in ("llm_call", "agent_call") or s.get("prompt_tokens"):
            aid = s.get("agent_id") or "default_agent"
            agent_spans[aid].append(s)

    opportunities: list[OptimizationOpportunity] = []

    for agent_id, agent_span_list in agent_spans.items():
        total_calls = len(agent_span_list)
        if total_calls < 3:
            continue

        fp_counter: Counter[str] = Counter()
        fp_info: dict[str, tuple[str, int, str]] = {}

        for s in agent_span_list:
            raw_prompt = s.get("input_data") or s.get("input") or s.get("metadata", {}).get("prompt") or s.get("name", "")
            model = s.get("model") or s.get("metadata", {}).get("model") or "gpt-4o"
            prompt_tokens = s.get("prompt_tokens") or 0

            fp_hash, preview, est_tokens = extract_prompt_fingerprint(raw_prompt)
            if not fp_hash:
                continue

            token_count = max(prompt_tokens, est_tokens)
            fp_counter[fp_hash] += 1
            if fp_hash not in fp_info:
                fp_info[fp_hash] = (preview, token_count, model)

        if not fp_counter:
            continue

        most_common_fp, most_common_count = fp_counter.most_common(1)[0]
        repeat_pct = round((most_common_count / total_calls) * 100, 1)

        preview, static_tokens, primary_model = fp_info[most_common_fp]

        if repeat_pct >= (min_repetition_threshold * 100) and static_tokens >= min_static_tokens:
            provider = detect_provider_from_model(primary_model)
            discount_pct = PROVIDER_CACHE_DISCOUNTS.get(provider, 0.60)
            cost_per_m = get_input_cost_per_million(primary_model)

            est_monthly_calls = total_calls * 30
            repeated_monthly_calls = int(est_monthly_calls * (repeat_pct / 100))

            monthly_static_tokens = repeated_monthly_calls * static_tokens
            base_cost_usd = (monthly_static_tokens / 1_000_000) * cost_per_m
            savings_usd = round(base_cost_usd * discount_pct, 2)
            savings_inr = round(savings_usd * USD_TO_INR_RATE, 2)
            effective_reduction_pct = round(discount_pct * (repeat_pct / 100) * 100, 1)

            agent_name = agent_id.replace("_", " ").title()

            code_example = ""
            if provider == "anthropic":
                code_example = (
                    "// Anthropic Prompt Caching (90% discount on cache hits)\n"
                    "client.messages.create(\n"
                    f"  model=\"{primary_model}\",\n"
                    "  system=[\n"
                    "    {\"type\": \"text\", \"text\": SYSTEM_PROMPT, \"cache_control\": {\"type\": \"ephemeral\"}}\n"
                    "  ],\n"
                    "  messages=[...]\n"
                    ")"
                )
            else:
                code_example = (
                    "// OpenAI Automatic Prefix Caching (50% discount on prefix >= 1024 tokens)\n"
                    "openai.chat.completions.create(\n"
                    f"  model=\"{primary_model}\",\n"
                    "  messages=[\n"
                    "    {\"role\": \"system\", \"content\": STATIC_SYSTEM_PROMPT},\n"
                    "    {\"role\": \"user\", \"content\": dynamic_user_query}\n"
                    "  ]\n"
                    ")"
                )

            headline = f"Enable Prompt Caching: {repeat_pct}% of calls share a {static_tokens:,}-token system prompt"
            detail = (
                f"This agent sends the same {static_tokens:,}-token system prompt on {repeat_pct}% of calls. "
                f"Enabling prompt caching on {provider.title()} ({primary_model}) will yield a "
                f"{int(discount_pct*100)}% discount on repeated prompt tokens, cutting monthly costs by an estimated {effective_reduction_pct}%."
            )
            action = f"Add cache-control headers or structure prefix instructions for {provider.title()} caching."

            opportunities.append(
                OptimizationOpportunity(
                    advisor_type="prompt_caching",
                    agent_id=agent_id,
                    agent_name=agent_name,
                    provider=provider,
                    model=primary_model,
                    headline=headline,
                    detail=detail,
                    recommended_action=action,
                    code_example=code_example,
                    repeated_prompt_pct=repeat_pct,
                    static_token_count=static_tokens,
                    sample_call_count=total_calls,
                    estimated_monthly_calls=est_monthly_calls,
                    estimated_cost_reduction_pct=effective_reduction_pct,
                    estimated_monthly_savings_usd=savings_usd,
                    estimated_monthly_savings_inr=savings_inr,
                )
            )

    return sorted(opportunities, key=lambda o: o.estimated_monthly_savings_inr, reverse=True)


def analyze_context_bloat(
    spans: list[dict[str, Any]],
    min_input_tokens: int = 1500,
    imbalance_ratio_threshold: float = 25.0,
) -> list[OptimizationOpportunity]:
    """Flag agents where input tokens are disproportionately large relative to output tokens."""
    agent_spans: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for s in spans:
        if s.get("prompt_tokens") and s.get("completion_tokens"):
            aid = s.get("agent_id") or "default_agent"
            agent_spans[aid].append(s)

    opportunities: list[OptimizationOpportunity] = []

    for agent_id, agent_span_list in agent_spans.items():
        total_calls = len(agent_span_list)
        if total_calls < 3:
            continue

        total_input_tokens = sum(s.get("prompt_tokens", 0) for s in agent_span_list)
        total_output_tokens = sum(s.get("completion_tokens", 0) for s in agent_span_list)

        avg_input = total_input_tokens // total_calls
        avg_output = max(1, total_output_tokens // total_calls)
        ratio = round(avg_input / avg_output, 1)

        primary_model = agent_span_list[0].get("model") or "gpt-4o"
        provider = detect_provider_from_model(primary_model)

        if avg_input >= min_input_tokens and ratio >= imbalance_ratio_threshold:
            trimmable_pct = 0.35
            cost_per_m = get_input_cost_per_million(primary_model)
            est_monthly_calls = total_calls * 30

            monthly_input_tokens = est_monthly_calls * avg_input
            monthly_wasted_tokens = int(monthly_input_tokens * trimmable_pct)
            savings_usd = round((monthly_wasted_tokens / 1_000_000) * cost_per_m, 2)
            savings_inr = round(savings_usd * USD_TO_INR_RATE, 2)
            reduction_pct = round(trimmable_pct * 100, 1)

            agent_name = agent_id.replace("_", " ").title()

            headline = f"Context Length Optimization: Extreme {ratio}:1 Input-to-Output Ratio"
            detail = (
                f"Spans for this agent average {avg_input:,} input tokens for only {avg_output} output tokens "
                f"({ratio}:1 ratio). Trimming redundant RAG search chunks or compacting preamble instructions "
                f"could reduce input token consumption by ~{reduction_pct}%."
            )
            action = "Apply semantic reranking (e.g. Cohere/FlashRank) to send top-3 chunks instead of raw top-10, or compress static schemas."
            code_example = (
                "// RAG Context Chunk Pruning Example\n"
                "const rerankedChunks = await reranker.rank({\n"
                "  query: userQuery,\n"
                "  documents: retrievedDocs,\n"
                "  topN: 3 // Keep only high-relevance chunks\n"
                "});\n"
                "const prunedContext = rerankedChunks.map(c => c.text).join('\\n---\\n');"
            )

            opportunities.append(
                OptimizationOpportunity(
                    advisor_type="context_pruning",
                    agent_id=agent_id,
                    agent_name=agent_name,
                    provider=provider,
                    model=primary_model,
                    headline=headline,
                    detail=detail,
                    recommended_action=action,
                    code_example=code_example,
                    input_to_output_ratio=ratio,
                    avg_input_tokens=avg_input,
                    avg_output_tokens=avg_output,
                    sample_call_count=total_calls,
                    estimated_monthly_calls=est_monthly_calls,
                    estimated_cost_reduction_pct=reduction_pct,
                    estimated_monthly_savings_usd=savings_usd,
                    estimated_monthly_savings_inr=savings_inr,
                )
            )

    return sorted(opportunities, key=lambda o: o.estimated_monthly_savings_inr, reverse=True)


def run_cost_optimization_analysis(
    spans: list[dict[str, Any]],
    org_id: str = "default_org",
) -> dict[str, Any]:
    """Run all cost optimization advisors across provided spans and aggregate ROI metrics."""
    caching_ops = analyze_prompt_caching(spans)
    pruning_ops = analyze_context_bloat(spans)

    all_opportunities = caching_ops + pruning_ops
    all_opportunities.sort(key=lambda o: o.estimated_monthly_savings_inr, reverse=True)

    total_usd = round(sum(o.estimated_monthly_savings_usd for o in all_opportunities), 2)
    total_inr = round(sum(o.estimated_monthly_savings_inr for o in all_opportunities), 2)

    return {
        "org_id": org_id,
        "currency": "INR",
        "usd_to_inr_rate": USD_TO_INR_RATE,
        "summary": {
            "total_potential_monthly_savings_inr": total_inr,
            "total_potential_monthly_savings_usd": total_usd,
            "total_opportunities_count": len(all_opportunities),
            "prompt_caching_opportunities_count": len(caching_ops),
            "context_pruning_opportunities_count": len(pruning_ops),
            "top_opportunity_headline": all_opportunities[0].headline if all_opportunities else "All agents running optimally",
            "top_opportunity_savings_inr": all_opportunities[0].estimated_monthly_savings_inr if all_opportunities else 0.0,
        },
        "opportunities": [o.to_dict() for o in all_opportunities],
    }

