"""
AgentWatch — Multi-Model Demo
==============================
This file shows clients how to connect AgentWatch to ANY AI model.
Just add your API key below and run:

    python examples/multi_model_demo.py

Supported out-of-the-box:
  - Google Gemini  (free tier available)
  - OpenAI GPT-4o  (needs OPENAI_API_KEY)
  - Anthropic Claude (needs ANTHROPIC_API_KEY)
  - Groq (ultra-fast, free tier available)
"""

import os
import httpx
import json
import agentwatch
from agentwatch.tracing import _SpanScope

# ─────────────────────────────────────────────────────────────────────────────
# YOUR API KEYS — paste your keys here or set them as environment variables
# ─────────────────────────────────────────────────────────────────────────────
GEMINI_API_KEY    = os.getenv("GEMINI_API_KEY", "")        # get free key at aistudio.google.com
OPENAI_API_KEY    = os.getenv("OPENAI_API_KEY", "")       # get key at platform.openai.com
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")    # get key at console.anthropic.com
GROQ_API_KEY      = os.getenv("GROQ_API_KEY", "")         # get free key at console.groq.com

agentwatch.configure(agentwatch.AgentWatchConfig(endpoint="http://localhost:8000", api_key="dev-key"))

USER_QUESTION = "What are the top 3 benefits of monitoring AI agents in production?"

# ─────────────────────────────────────────────────────────────────────────────
# MODEL 1: Google Gemini (FREE tier — works right now)
# ─────────────────────────────────────────────────────────────────────────────
def run_gemini():
    print("\n[1] Google Gemini (gemini-3.6-flash) — FREE tier")
    print("-" * 60)
    with _SpanScope("gemini_call", "llm_call", input_data={"prompt": USER_QUESTION}) as scope:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key={GEMINI_API_KEY}"
        resp = httpx.post(url, json={"contents": [{"parts": [{"text": USER_QUESTION}]}]}, timeout=30)
        data = resp.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        tokens = data.get("usageMetadata", {})
        scope.finish(
            output=text,
            model="gemini-3.6-flash",
            prompt_tokens=tokens.get("promptTokenCount"),
            completion_tokens=tokens.get("candidatesTokenCount"),
        )
    print(text[:400])
    print("[AgentWatch] Gemini trace recorded!")


# ─────────────────────────────────────────────────────────────────────────────
# MODEL 2: OpenAI GPT-4o (needs OPENAI_API_KEY)
# ─────────────────────────────────────────────────────────────────────────────
def run_openai():
    if not OPENAI_API_KEY:
        print("\n[2] OpenAI GPT-4o — SKIPPED (set OPENAI_API_KEY to enable)")
        return
    print("\n[2] OpenAI GPT-4o")
    print("-" * 60)
    try:
        import openai
        from agentwatch.instrumentation.openai import patch_openai
        client = openai.OpenAI(api_key=OPENAI_API_KEY)
        patch_openai(client)  # auto-instruments this client instance
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": USER_QUESTION}],
            max_tokens=300,
        )
        text = response.choices[0].message.content
        print(text[:400])
        print("[AgentWatch] GPT-4o trace auto-recorded!")
    except ImportError:
        print("  -> Install openai: pip install openai")


# ─────────────────────────────────────────────────────────────────────────────
# MODEL 3: Anthropic Claude (needs ANTHROPIC_API_KEY)
# ─────────────────────────────────────────────────────────────────────────────
def run_anthropic():
    if not ANTHROPIC_API_KEY:
        print("\n[3] Anthropic Claude — SKIPPED (set ANTHROPIC_API_KEY to enable)")
        return
    print("\n[3] Anthropic Claude Sonnet")
    print("-" * 60)
    try:
        import anthropic
        from agentwatch.instrumentation.anthropic import patch_anthropic
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        patch_anthropic(client)  # auto-instruments this client instance
        message = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=300,
            messages=[{"role": "user", "content": USER_QUESTION}],
        )
        text = message.content[0].text
        print(text[:400])
        print("[AgentWatch] Claude trace auto-recorded!")
    except ImportError:
        print("  -> Install anthropic: pip install anthropic")


# ─────────────────────────────────────────────────────────────────────────────
# MODEL 4: Groq LLaMA (free tier — get key at groq.com)
# ─────────────────────────────────────────────────────────────────────────────
def run_groq():
    if not GROQ_API_KEY:
        print("\n[4] Groq LLaMA-3 — SKIPPED (set GROQ_API_KEY to enable, free at groq.com)")
        return
    print("\n[4] Groq LLaMA-3.3-70b (ultra-fast)")
    print("-" * 60)
    with _SpanScope("groq_call", "llm_call", input_data={"prompt": USER_QUESTION}) as scope:
        resp = httpx.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": [{"role": "user", "content": USER_QUESTION}],
                "max_tokens": 300,
            },
            timeout=30,
        )
        data = resp.json()
        text = data["choices"][0]["message"]["content"]
        usage = data.get("usage", {})
        scope.finish(
            output=text,
            model="llama-3.3-70b",
            prompt_tokens=usage.get("prompt_tokens"),
            completion_tokens=usage.get("completion_tokens"),
        )
    print(text[:400])
    print("[AgentWatch] Groq LLaMA trace recorded!")


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 60)
    print(" AgentWatch Multi-Model Demo")
    print(" Question:", USER_QUESTION)
    print("=" * 60)

    run_gemini()
    run_openai()
    run_anthropic()
    run_groq()

    print("\n" + "=" * 60)
    print(" All available models tested and traced by AgentWatch!")
    print(" View traces at: http://localhost:3000/traces")
    print("=" * 60)
