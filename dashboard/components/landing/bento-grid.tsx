"use client";

import Link from "next/link";
import { ArrowUpRight, Bot, Cpu, Database, Eye, Fingerprint, Lock, Network, Radio, Scale, Share2, ShieldAlert, ShieldCheck, Terminal, Users, UserX, ZapOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function BentoGrid() {
  return (
    <section id="features" className="py-20 relative">
      <div className="mx-auto max-w-6xl px-4 space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <Badge className="bg-indigo-950/60 text-indigo-300 border-indigo-800 text-[10px] font-mono uppercase tracking-wider">
            Full-Stack Agent Governance
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Built for Autonomous Multi-Agent Swarms
          </h2>
          <p className="text-sm text-slate-400">
            Everything you need to observe, govern, and secure AI agents in production without burning unnecessary cloud spend.
          </p>
        </div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Multi-Agent Graph (Col span 2) */}
          <Card className="md:col-span-2 border-white/10 bg-slate-900/40 p-6 rounded-2xl shadow-xl backdrop-blur-xl relative overflow-hidden group hover:border-blue-500/50 transition-colors">
            <div className="space-y-3 max-w-md">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-950 border border-blue-800 text-blue-400">
                  <Share2 size={16} />
                </div>
                <h3 className="text-base font-bold text-white">Interactive Agent Topology Graph</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Automatically maps delegation hierarchies, call volume, edge latencies, and error clusters across orchestrators, planners, and sub-agents.
              </p>
            </div>

            {/* Visual Node Graph Preview */}
            <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-300 flex items-center justify-around">
              <div className="p-3 rounded-lg border border-blue-500/50 bg-blue-950/40 text-center space-y-1">
                <Bot size={16} className="text-blue-400 mx-auto" />
                <span className="text-[11px] text-white font-bold block">Orchestrator</span>
                <span className="text-[9px] text-blue-300 block">520 calls • 0.1% err</span>
              </div>
              <div className="h-0.5 w-12 bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse" />
              <div className="p-3 rounded-lg border border-purple-500/50 bg-purple-950/40 text-center space-y-1">
                <Cpu size={16} className="text-purple-400 mx-auto" />
                <span className="text-[11px] text-white font-bold block">SQL Analyst</span>
                <span className="text-[9px] text-purple-300 block">140 calls • 0.0% err</span>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <Link href="/agents/graph" className="text-xs text-blue-400 hover:underline flex items-center gap-1 font-mono">
                View Topology Explorer <ArrowUpRight size={13} />
              </Link>
            </div>
          </Card>

          {/* Card 2: Cost Runaway Circuit Breaker (Col span 1) */}
          <Card className="border-white/10 bg-slate-900/40 p-6 rounded-2xl shadow-xl backdrop-blur-xl relative overflow-hidden group hover:border-amber-500/50 transition-colors space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-950 border border-amber-800 text-amber-400">
                  <ZapOff size={16} />
                </div>
                <h3 className="text-base font-bold text-white">Cost Circuit Breaker</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Hard killswitch that stops runaway agents stuck in infinite loops ($50 in 5 min) and dispatches emergency PagerDuty webhooks.
              </p>
            </div>

            <div className="rounded-lg bg-amber-950/30 border border-amber-800/40 p-3 text-xs font-mono text-amber-300">
              ⚡ Threshold: $50.00 / 5m<br />
              ● Status: ARMED & ACTIVE
            </div>

            <Link href="/settings/circuit-breaker" className="text-xs text-amber-400 hover:underline flex items-center gap-1 font-mono">
              Configure Breaker <ArrowUpRight size={13} />
            </Link>
          </Card>

          {/* Card 3: Model Context Protocol (MCP) Server (Col span 1) */}
          <Card id="mcp" className="border-white/10 bg-slate-900/40 p-6 rounded-2xl shadow-xl backdrop-blur-xl relative overflow-hidden group hover:border-purple-500/50 transition-colors space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-950 border border-purple-800 text-purple-400">
                  <Bot size={16} />
                </div>
                <h3 className="text-base font-bold text-white">Native MCP Server</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Connect Claude Desktop, Cursor, or Windsurf directly via stdio JSON-RPC. AIs can query traces, check prompt security, and run evaluations.
              </p>
            </div>

            <div className="rounded-lg bg-slate-950 border border-purple-800/40 p-2.5 font-mono text-[11px] text-purple-300">
              $ agentwatch mcp --serve
            </div>

            <Link href="/docs/mcp-setup" className="text-xs text-purple-400 hover:underline flex items-center gap-1 font-mono">
              MCP Documentation <ArrowUpRight size={13} />
            </Link>
          </Card>

          {/* Card 4: Tamper-Evident SHA-256 Audit Chains (Col span 2) */}
          <Card className="md:col-span-2 border-white/10 bg-slate-900/40 p-6 rounded-2xl shadow-xl backdrop-blur-xl relative overflow-hidden group hover:border-emerald-500/50 transition-colors">
            <div className="space-y-3 max-w-md">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-400">
                  <Fingerprint size={16} />
                </div>
                <h3 className="text-base font-bold text-white">Tamper-Evident Cryptographic Audit Chains</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Blockchain-style SHA-256 hash chains with database-level append-only enforcement (REVOKE UPDATE/DELETE) for SOC 2 and HIPAA non-repudiation.
              </p>
            </div>

            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] text-slate-300 flex flex-wrap items-center justify-between gap-2">
              <span className="text-slate-400">Prev Hash: <span className="text-slate-600">00000000...</span></span>
              <span className="text-emerald-400 font-bold">SHA256(Block #1) ➔ Entry Hash: c9102938...</span>
              <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800 text-[9px]">100% IMMUTABLE</Badge>
            </div>

            <div className="pt-4 flex justify-end">
              <Link href="/settings/audit-log" className="text-xs text-emerald-400 hover:underline flex items-center gap-1 font-mono">
                Inspect Audit Ledger <ArrowUpRight size={13} />
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
