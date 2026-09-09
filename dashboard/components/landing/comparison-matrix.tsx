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
      name: "Heuristic & Semantic Prompt Injection Defense",
      desc: "Pre-execution pattern matching & semantic LLM judge classifier",
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
      name: "DPDP / GDPR Subject Rights Erasure Workflow",
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
          <Badge variant="neutral" className="border-borderStrong text-ink bg-surface text-[10px] font-mono uppercase tracking-wider">
            Competitive Benchmarking
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-ink font-display tracking-tight">
            How NetrAI Compares
          </h2>
          <p className="text-sm text-inkDim">
            Engineered specifically for autonomous multi-agent swarms with enterprise safety and zero vendor lock-in.
          </p>
        </div>

        <Card className="border border-border bg-surface rounded-sm shadow-none overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="border-b border-border bg-paper font-mono text-ink">
                <tr>
                  <th className="py-3.5 px-4 font-bold">Capabilities</th>
                  <th className="py-3.5 px-4 font-bold text-ink bg-accentSoft/60 text-center border-x border-border">
                    NetrAI
                  </th>
                  <th className="py-3.5 px-4 font-medium text-inkDim text-center">Langfuse</th>
                  <th className="py-3.5 px-4 font-medium text-inkDim text-center">Maxim AI</th>
                  <th className="py-3.5 px-4 font-medium text-inkDim text-center">LangSmith</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-sans">
                {features.map((row, idx) => (
                  <tr key={idx} className="hover:bg-paper transition-colors">
                    <td className="py-3 px-4">
                      <strong className="block text-ink font-semibold text-xs">{row.name}</strong>
                      <span className="text-[11px] text-inkDim">{row.desc}</span>
                    </td>

                    {/* NetrAI Column */}
                    <td className="py-3 px-4 text-center bg-accentSoft/30 border-x border-border">
                      <div className="inline-flex h-6 w-6 items-center justify-center rounded-none bg-good/20 text-good">
                        <Check size={14} className="stroke-[3]" />
                      </div>
                    </td>

                    {/* Langfuse Column */}
                    <td className="py-3 px-4 text-center text-inkDim">
                      {row.langfuse === true ? (
                        <Check size={14} className="mx-auto text-good" />
                      ) : row.langfuse === "partial" ? (
                        <span className="text-[10px] font-mono font-semibold text-warn">PARTIAL</span>
                      ) : (
                        <X size={14} className="mx-auto text-bad" />
                      )}
                    </td>

                    {/* Maxim AI Column */}
                    <td className="py-3 px-4 text-center text-inkDim">
                      {row.maxim === true ? (
                        <Check size={14} className="mx-auto text-good" />
                      ) : (
                        <X size={14} className="mx-auto text-bad" />
                      )}
                    </td>

                    {/* LangSmith Column */}
                    <td className="py-3 px-4 text-center text-inkDim">
                      {row.langsmith === true ? (
                        <Check size={14} className="mx-auto text-good" />
                      ) : (
                        <X size={14} className="mx-auto text-bad" />
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
