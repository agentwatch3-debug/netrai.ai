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
    <div className="rounded-2xl border border-white/10 bg-slate-950/90 shadow-2xl overflow-hidden backdrop-blur-xl flex flex-col h-full">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between border-b border-white/10 bg-slate-900/60 px-4 py-2.5">
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
              className={`rounded-lg px-2.5 py-1 text-xs font-mono font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-blue-600/30 border border-blue-500/50 text-blue-300 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          onClick={copyCode}
          className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-white transition-colors"
          title="Copy snippet"
        >
          {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>

      {/* Code Body */}
      <div className="p-4 font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed flex-1 bg-slate-950/40">
        <pre className="text-slate-200">
          <code>{snippets[activeTab]}</code>
        </pre>
      </div>

      {/* Quick Terminal Command */}
      <div className="border-t border-white/5 bg-slate-900/30 px-4 py-2 flex items-center justify-between text-[11px] font-mono text-slate-400">
        <div className="flex items-center gap-2">
          <Terminal size={12} className="text-blue-400" />
          <span>pip install agentwatch-sdk</span>
        </div>
        <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.5 rounded">
          ● Ready
        </span>
      </div>
    </div>
  );
}
