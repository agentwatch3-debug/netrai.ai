"use client";

import Link from "next/link";
import { ArrowRight, Bot, CheckCircle2, ChevronRight, Play, Shield, Sparkles, Terminal, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeSwitcher } from "./code-switcher";
import { InteractiveWaterfallSimulator } from "./interactive-waterfall";

export function LandingHero() {
  return (
    <section className="relative pt-12 pb-16 overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 space-y-12">
        {/* Top Tag Pill */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-sm border border-borderStrong bg-surface px-4 py-1.5 text-xs font-mono text-ink shadow-none">
            <span className="flex h-2 w-2 rounded-none bg-accent" />
            <span>NetrAI 2.0 with Native MCP Server & Multi-Agent Graphs</span>
            <ChevronRight size={13} className="text-inkDim" />
          </div>
        </div>

        {/* Hero Headings */}
        <div className="text-center space-y-4 max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-ink font-display leading-tight">
            The Open-Source{" "}
            <span className="text-accent underline decoration-borderStrong decoration-2 underline-offset-8">
              Multi-Agent Observability
            </span>{" "}
            & Governance Engine
          </h1>
          <p className="text-base sm:text-lg text-inkDim max-w-2xl mx-auto leading-relaxed">
            Trace hierarchical agent swarms, trap infinite tool loops with automatic cost circuit breakers, block prompt injections, and query real-time telemetry via native Model Context Protocol (MCP).
          </p>
        </div>

        {/* Action CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/dashboard">
            <Button className="h-11 px-6 bg-ink hover:bg-ink/90 text-surface font-mono font-bold rounded-sm border border-ink flex items-center gap-2 text-sm shadow-none">
              Start Tracing Free <ArrowRight size={15} />
            </Button>
          </Link>

          <Link href="/agents/graph">
            <Button className="h-11 px-5 border border-borderStrong bg-surface hover:bg-paper text-ink font-mono font-semibold rounded-sm text-sm flex items-center gap-2 shadow-none">
              <Play size={14} className="text-ink fill-ink" /> Explore Agent Graph
            </Button>
          </Link>
        </div>

        {/* Split-Screen Code & Live Interactive Simulator */}
        <div id="interactive-trace" className="pt-4 grid lg:grid-cols-2 gap-6 items-stretch">
          <div className="h-[480px]">
            <CodeSwitcher />
          </div>
          <div className="h-[480px]">
            <InteractiveWaterfallSimulator />
          </div>
        </div>

        {/* Live Features Trust Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-8 border-t border-border text-center font-mono text-xs text-inkDim">
          <div className="flex items-center justify-center gap-2 border border-border bg-surface p-3 rounded-sm">
            <CheckCircle2 size={15} className="text-good" />
            <span className="text-ink font-medium">Zero-Cost Local Mode</span>
          </div>
          <div className="flex items-center justify-center gap-2 border border-border bg-surface p-3 rounded-sm">
            <Bot size={15} className="text-accent" />
            <span className="text-ink font-medium">Claude & Cursor MCP</span>
          </div>
          <div className="flex items-center justify-center gap-2 border border-border bg-surface p-3 rounded-sm">
            <Shield size={15} className="text-ink" />
            <span className="text-ink font-medium">SHA-256 Audit Proof</span>
          </div>
          <div className="flex items-center justify-center gap-2 border border-border bg-surface p-3 rounded-sm">
            <Zap size={15} className="text-warn" />
            <span className="text-ink font-medium">50ms Circuit Breaker</span>
          </div>
        </div>
      </div>
    </section>
  );
}
