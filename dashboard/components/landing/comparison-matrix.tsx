"use client";

import { Check, Minus, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ComparisonMatrix() {
  const features = [
    {
      name: "Multi-Agent Topology Graph",
      desc: "Directed agent network graph with call volume & error clusters",
      agentwatch: true,
      langfuse: false,
      maxim: false,
      langsmith: false,
    },
    {
      name: "Automated Cost Runaway Circuit Breaker",
      desc: "Hard killswitch for infinite tool loops & spend spikes",
      agentwatch: true,
      langfuse: false,
      maxim: false,
      langsmith: false,
    },
    {
      name: "Native Model Context Protocol (MCP) Server",
      desc: "Direct integration for Claude Desktop, Cursor & Windsurf",
      agentwatch: true,
      langfuse: false,
      maxim: false,
      langsmith: false,
    },
    {
      name: "Tamper-Evident SHA-256 Audit Log Chains",
      desc: "Cryptographic hash chaining & append-only DB hardening",
      agentwatch: true,
      langfuse: false,
      maxim: false,
      langsmith: false,
    },
    {
      name: "Zero-Day Prompt Injection Defense",
      desc: "Pre-execution regex & semantic LLM judge classifier",
      agentwatch: true,
      langfuse: false,
      maxim: true,
      langsmith: false,
    },
    {
      name: "Zero-Cost Local Mode (No Paid Keys Needed)",
      desc: "Full tracing with local Ollama, Groq, or mock replay",
      agentwatch: true,
      langfuse: "partial",
      maxim: false,
      langsmith: false,
    },
    {
      name: "GDPR / CCPA Subject Rights Erasure Workflow",
      desc: "Two-step admin confirmation gate & ClickHouse purge",
      agentwatch: true,
      langfuse: false,
      maxim: false,
      langsmith: false,
    },
    {
      name: "CI/CD Golden Dataset Regression Guard",
      desc: "Pre-deploy CLI evaluation with exact, semantic & judge tests",
      agentwatch: true,
      langfuse: true,
      maxim: true,
      langsmith: true,
    },
  ];

  return (
    <section id="comparison" className="py-20 relative">
      <div className="mx-auto max-w-6xl px-4 space-y-10">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <Badge className="bg-blue-950/60 text-blue-300 border-blue-800 text-[10px] font-mono uppercase tracking-wider">
            Competitive Benchmarking
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            How AgentWatch Compares
          </h2>
          <p className="text-sm text-slate-400">
            Engineered specifically for autonomous multi-agent swarms with enterprise safety and zero vendor lock-in.
          </p>
        </div>

        <Card className="border-white/10 bg-slate-900/40 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="border-b border-white/10 bg-slate-950/60 font-mono text-slate-300">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Capabilities</th>
                  <th className="py-3.5 px-4 font-bold text-blue-400 bg-blue-950/30 text-center">
                    AgentWatch
                  </th>
                  <th className="py-3.5 px-4 font-medium text-slate-400 text-center">Langfuse</th>
                  <th className="py-3.5 px-4 font-medium text-slate-400 text-center">Maxim AI</th>
                  <th className="py-3.5 px-4 font-medium text-slate-400 text-center">LangSmith</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {features.map((f, i) => (
                  <tr key={i} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <strong className="text-white block font-sans text-xs">{f.name}</strong>
                      <span className="text-[11px] text-slate-400 font-mono">{f.desc}</span>
                    </td>
                    <td className="py-3.5 px-4 text-center bg-blue-950/20">
                      <div className="flex items-center justify-center text-emerald-400">
                        <Check size={16} className="stroke-[3]" />
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-500">
                      {f.langfuse === true ? (
                        <Check size={14} className="text-slate-300 mx-auto" />
                      ) : f.langfuse === "partial" ? (
                        <span className="text-[10px] text-amber-400 font-bold">PARTIAL</span>
                      ) : (
                        <X size={14} className="text-slate-600 mx-auto" />
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-500">
                      {f.maxim === true ? (
                        <Check size={14} className="text-slate-300 mx-auto" />
                      ) : (
                        <X size={14} className="text-slate-600 mx-auto" />
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-500">
                      {f.langsmith === true ? (
                        <Check size={14} className="text-slate-300 mx-auto" />
                      ) : (
                        <X size={14} className="text-slate-600 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </section>
  );
}
