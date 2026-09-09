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
          <Badge variant="neutral" className="border-borderStrong text-ink bg-surface text-[10px] font-mono uppercase tracking-wider">
            Full-Stack Agent Governance
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-ink font-display tracking-tight">
            Built for Autonomous Multi-Agent Swarms
          </h2>
          <p className="text-sm text-inkDim">
            Everything you need to observe, govern, and secure AI agents in production without burning unnecessary cloud spend.
          </p>
        </div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Multi-Agent Graph (Col span 2) */}
          <Card className="md:col-span-2 border border-border bg-surface p-6 rounded-sm shadow-none relative overflow-hidden group hover:border-ink transition-colors">
            <div className="space-y-3 max-w-md">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-none bg-paper border border-border text-ink">
                  <Share2 size={16} />
                </div>
                <h3 className="text-base font-bold text-ink font-display">Interactive Agent Topology Graph</h3>
              </div>
              <p className="text-xs text-inkDim leading-relaxed">
                Automatically maps delegation hierarchies, call volume, edge latencies, and error clusters across orchestrators, planners, and sub-agents.
              </p>
            </div>

            {/* Visual Node Graph Preview */}
            <div className="mt-6 rounded-none border border-border bg-paper p-4 font-mono text-xs text-ink flex items-center justify-around">
              <div className="p-3 rounded-none border border-border bg-surface text-center space-y-1 shadow-none">
                <Bot size={16} className="text-accent mx-auto" />
                <span className="text-[11px] text-ink font-bold block">Orchestrator</span>
                <span className="text-[9px] text-inkDim block">520 calls • 0.1% err</span>
              </div>
              <div className="h-0.5 w-12 bg-borderStrong" />
              <div className="p-3 rounded-none border border-border bg-surface text-center space-y-1 shadow-none">
                <Cpu size={16} className="text-ink mx-auto" />
                <span className="text-[11px] text-ink font-bold block">SQL Analyst</span>
                <span className="text-[9px] text-inkDim block">140 calls • 0.0% err</span>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <Link href="/agents/graph" className="text-xs text-ink font-bold hover:underline flex items-center gap-1 font-mono">
                View Topology Explorer <ArrowUpRight size={13} />
              </Link>
            </div>
          </Card>

          {/* Card 2: Cost Runaway Circuit Breaker (Col span 1) */}
          <Card className="border border-border bg-surface p-6 rounded-sm shadow-none relative overflow-hidden group hover:border-ink transition-colors space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-none bg-paper border border-border text-warn">
                  <ZapOff size={16} />
                </div>
                <h3 className="text-base font-bold text-ink font-display">Cost Circuit Breaker</h3>
              </div>
              <p className="text-xs text-inkDim leading-relaxed">
                Hard killswitch that stops runaway agents stuck in infinite loops ($50 in 5 min) and dispatches emergency PagerDuty webhooks.
              </p>
            </div>

            <div className="rounded-none bg-paper border border-border p-3 text-xs font-mono text-ink">
              ⚡ Threshold: $50.00 / 5m<br />
              ● Status: ARMED & ACTIVE
            </div>

            <Link href="/settings/circuit-breaker" className="text-xs text-ink font-bold hover:underline flex items-center gap-1 font-mono">
              Configure Breaker <ArrowUpRight size={13} />
            </Link>
          </Card>

          {/* Card 3: Model Context Protocol (MCP) Server (Col span 1) */}
          <Card id="mcp" className="border border-border bg-surface p-6 rounded-sm shadow-none relative overflow-hidden group hover:border-ink transition-colors space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-none bg-paper border border-border text-accent">
                  <Bot size={16} />
                </div>
                <h3 className="text-base font-bold text-ink font-display">Native MCP Server</h3>
              </div>
              <p className="text-xs text-inkDim leading-relaxed">
                Connect Claude Desktop, Cursor, or Windsurf directly via stdio JSON-RPC. AIs can query traces, check prompt security, and run evaluations.
              </p>
            </div>

            <div className="rounded-none bg-paper border border-border p-2.5 font-mono text-[11px] text-ink">
              <code>$ agentwatch mcp --port 8000</code>
            </div>

            <Link href="/docs/mcp-setup" className="text-xs text-ink font-bold hover:underline flex items-center gap-1 font-mono">
              MCP Documentation <ArrowUpRight size={13} />
            </Link>
          </Card>

          {/* Card 4: SHA-256 Audit Chain (Col span 1) */}
          <Card className="border border-border bg-surface p-6 rounded-sm shadow-none relative overflow-hidden group hover:border-ink transition-colors space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-none bg-paper border border-border text-good">
                  <ShieldCheck size={16} />
                </div>
                <h3 className="text-base font-bold text-ink font-display">SHA-256 Audit Chains</h3>
              </div>
              <p className="text-xs text-inkDim leading-relaxed">
                Cryptographically verify span immutability and compliance actions with tamper-evident SHA-256 hash chains.
              </p>
            </div>

            <div className="rounded-none bg-paper border border-border p-2.5 font-mono text-[10px] text-inkDim break-all">
              Prev: e3b0c442...<br />
              Hash: a4f89d02...
            </div>

            <Link href="/settings/audit-log" className="text-xs text-ink font-bold hover:underline flex items-center gap-1 font-mono">
              Audit Log Explorer <ArrowUpRight size={13} />
            </Link>
          </Card>

          {/* Card 5: Prompt Injection Shield (Col span 1) */}
          <Card className="border border-border bg-surface p-6 rounded-sm shadow-none relative overflow-hidden group hover:border-ink transition-colors space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-none bg-paper border border-border text-bad">
                  <ShieldAlert size={16} />
                </div>
                <h3 className="text-base font-bold text-ink font-display">Prompt Injection Shield</h3>
              </div>
              <p className="text-xs text-inkDim leading-relaxed">
                Autonomous heuristic & semantic detectors trap jailbreaks, delimiter injections, and role overrides before reaching the model.
              </p>
            </div>

            <div className="rounded-none bg-bad/10 border border-bad/30 p-2.5 font-mono text-[11px] text-bad">
              🛡 99.4% Injections Trapped
            </div>

            <Link href="/security/injection-attempts" className="text-xs text-ink font-bold hover:underline flex items-center gap-1 font-mono">
              Security Center <ArrowUpRight size={13} />
            </Link>
          </Card>
        </div>
      </div>
    </section>
  );
}
