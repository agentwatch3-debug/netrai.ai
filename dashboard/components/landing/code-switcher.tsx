"use client";

import { useState } from "react";
import { Bot, Check, Copy, FileCode2, Terminal } from "lucide-react";

export function CodeSwitcher() {
  const [activeTab, setActiveTab] = useState<"python" | "typescript" | "langchain" | "mcp">("python");
  const [copied, setCopied] = useState(false);

  const snippets = {
    python: `import agentwatch
from agentwatch import trace_agent, trace_llm, trace_tool

# Auto-instruments multi-agent chains & propagates parent context
with trace_agent("support_orchestrator", end_user_id="cust_9921"):
    with trace_tool("query_knowledge_base") as tool:
        kb_results = search_docs("How to configure SAML SSO?")
        tool.finish(output={"matched_docs": 3})

    with trace_llm("gpt-4.1-mini") as llm:
        response = call_llm(kb_results)
        llm.finish(output=response)`,

    typescript: `import { AgentWatch, traceAgent, traceLLM } from "@agentwatch/sdk";

const watch = new AgentWatch({ apiKey: process.env.AGENTWATCH_API_KEY });

await traceAgent("triage_agent", { endUserId: "cust_9921" }, async (agentScope) => {
  const llmResult = await traceLLM("claude-3-5-sonnet", async (llmScope) => {
    return await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      messages: [{ role: "user", content: "Analyze account status" }]
    });
  });
});`,

    langchain: `from langchain_openai import ChatOpenAI
from agentwatch.instrumentation.langchain import AgentWatchCallbackHandler

# 1-Line auto-instrumentation callback handler
handler = AgentWatchCallbackHandler(agent_name="financial_analyst")

llm = ChatOpenAI(model="gpt-4o", callbacks=[handler])
response = llm.invoke("Generate quarterly revenue summary")`,

    mcp: `// ~/.config/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "agentwatch": {
      "command": "agentwatch",
      "args": ["mcp"],
      "env": {
        "AGENTWATCH_ENDPOINT": "https://api.agentwatch.dev",
        "AGENTWATCH_API_KEY": "aw_live_sec88921"
      }
    }
  }
}`,
  };

  function copyCode() {
    void navigator.clipboard.writeText(snippets[activeTab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-sm border border-border bg-surface shadow-none flex flex-col h-full overflow-hidden">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between border-b border-border bg-paper px-4 py-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: "python", label: "Python SDK" },
            { id: "typescript", label: "TypeScript" },
            { id: "langchain", label: "LangChain" },
            { id: "mcp", label: "MCP Protocol" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`rounded-sm px-2.5 py-1 text-xs font-mono font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-surface border border-ink text-ink font-bold shadow-none"
                  : "border border-transparent text-inkDim hover:text-ink hover:bg-surface"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          onClick={copyCode}
          className="flex items-center gap-1 text-[11px] font-mono text-inkDim hover:text-ink transition-colors px-2 py-0.5 border border-border rounded-sm bg-surface"
          title="Copy snippet"
        >
          {copied ? <Check size={12} className="text-good" /> : <Copy size={12} />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>

      {/* Code Display Area */}
      <pre className="p-4 font-mono text-xs bg-ink text-[#F4F3EE] overflow-x-auto leading-relaxed flex-1 selection:bg-accent selection:text-white">
        <code>{snippets[activeTab]}</code>
      </pre>

      {/* Footer Info */}
      <div className="border-t border-border bg-paper px-4 py-2 text-[11px] font-mono text-inkDim flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Terminal size={12} className="text-accent" />
          <span>pip install agentwatch-sdk</span>
        </span>
        <span className="text-[10px] text-good font-semibold">● Production Ready</span>
      </div>
    </div>
  );
}
