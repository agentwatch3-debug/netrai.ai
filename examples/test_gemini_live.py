"""Live Google Gemini agent execution traced with AgentWatch using standard HTTPX."""

import os
import sys
import httpx
import agentwatch
from agentwatch import trace_agent, trace_llm, trace_tool
from agentwatch.tracing import _SpanScope

# Configure Gemini API Key — set via: $env:GEMINI_API_KEY="your-key"
# Get a free key at: https://aistudio.google.com/app/apikey
GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")

print("================================================================================")
print(" [*] Running Live Google Gemini Agent Traced by AgentWatch")
print("================================================================================\n")

try:
    with trace_agent("customer_support_agent", end_user_id="cust_live_gemini_01") as agent:
        print("1. Tracing customer support agent workflow...")

        with _SpanScope("query_knowledge_base", "tool_call", input_data={"query": "How does AgentWatch circuit breaker work?"}) as tool:
            print("2. Querying simulated knowledge base...")
            kb_data = {
                "article": "AgentWatch circuit breaker automatically monitors LLM spend velocity and kills runaway agent tool loops when spend exceeds $50 within 5 minutes."
            }
            tool.finish(output=kb_data)

        print("3. Calling Google Gemini (gemini-3.6-flash) live...")
        with trace_llm("gemini-3.6-flash") as llm_scope:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key={GEMINI_KEY}"
            prompt = f"You are AgentWatch Support AI. Context: {kb_data['article']}\n\nQuestion: Explain the cost circuit breaker in 2 sentences."
            
            payload = {
                "contents": [
                    {
                        "parts": [
                            {"text": prompt}
                        ]
                    }
                ],
                "generationConfig": {
                    "maxOutputTokens": 300,
                    "temperature": 0.2
                }
            }

            resp = httpx.post(url, json=payload, timeout=20.0)
            
            if resp.status_code != 200:
                print(f"[!] Gemini API returned status {resp.status_code}: {resp.text}")
                llm_scope.finish(output=f"Error {resp.status_code}")
                sys.exit(1)

            data = resp.json()
            gemini_answer = data["candidates"][0]["content"]["parts"][0]["text"]
            usage_metadata = data.get("usageMetadata", {})
            tokens_in = usage_metadata.get("promptTokenCount", 0)
            tokens_out = usage_metadata.get("candidatesTokenCount", 0)

            llm_scope.finish(output=gemini_answer)

            print("\n--------------------------------------------------------------------------------")
            print(" [+] Live Response from Google Gemini:")
            print("--------------------------------------------------------------------------------")
            print(gemini_answer.strip())
            print("--------------------------------------------------------------------------------")
            print(f" [i] Telemetry: {tokens_in} prompt tokens, {tokens_out} completion tokens")
            print("--------------------------------------------------------------------------------\n")

    print("[SUCCESS] Live Gemini trace completed and recorded successfully!")

except Exception as e:
    print(f"\n[ERROR] Error during Gemini execution: {e}")
    sys.exit(1)
