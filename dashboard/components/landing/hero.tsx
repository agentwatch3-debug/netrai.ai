"use client";

import Link from "next/link";
import { ArrowRight, Bot, CheckCircle2, ChevronRight, Play, Shield, Sparkles, Terminal, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeSwitcher } from "./code-switcher";
import { InteractiveWaterfallSimulator } from "./interactive-waterfall";

export function LandingHero() {
  return (
    <section className="relative pt-12 pb-20 overflow-hidden">
      {/* Background Radiant Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gradient-to-tr from-blue-600/20 via-indigo-600/20 to-purple-600/10 blur-[130px] -z-10 pointer-events-none" />

      <div className="mx-auto max-w-6xl px-4 space-y-12">
        {/* Top Tag Pill */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-950/40 px-4 py-1.5 text-xs font-mono text-blue-300 backdrop-blur-md shadow-lg shadow-blue-500/10">
            <span className="flex h-2 w-2 rounded-full bg-blue-400 animate-ping" />
            <span>AgentWatch 2.0 with Native MCP Server & Multi-Agent Graphs</span>
            <ChevronRight size={13} className="text-blue-400" />
          </div>
        </div>

        {/* Hero Headings */}
        <div className="text-center space-y-4 max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
            The Open-Source{" "}
            <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
              Multi-Agent Observability
            </span>{" "}
            & Governance Engine
          </h1>
          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Trace hierarchical agent swarms, trap infinite tool loops with automatic cost circuit breakers, block prompt injections, and query real-time telemetry via native Model Context Protocol (MCP).
          </p>
        </div>

        {/* Action CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/dashboard">
            <Button className="h-11 px-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-2 text-sm">
              Start Tracing Free <ArrowRight size={15} />
            </Button>
          </Link>

          <Link href="/agents/graph">
            <Button className="h-11 px-5 border border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 text-slate-200 font-semibold rounded-xl text-sm flex items-center gap-2 backdrop-blur-md">
              <Play size={14} className="text-blue-400 fill-blue-400" /> Explore Agent Graph
            </Button>
          </Link>
        </div>

        {/* Split-Screen Code & Live Interactive Simulator */}
        <div id="interactive-trace" className="pt-4 grid lg:grid-cols-2 gap-6 items-stretch">
          <div className="h-[460px]">
            <CodeSwitcher />
          </div>
          <div className="h-[460px]">
            <InteractiveWaterfallSimulator />
          </div>
        </div>

        {/* Live Features Trust Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-white/5 text-center font-mono text-xs text-slate-400">
          <div className="flex items-center justify-center gap-1.5">
            <CheckCircle2 size={15} className="text-emerald-400" />
            <span>Zero-Cost Local Mode</span>
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <Bot size={15} className="text-purple-400" />
            <span>Claude & Cursor MCP</span>
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <Shield size={15} className="text-blue-400" />
            <span>SHA-256 Audit Proof</span>
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <Zap size={15} className="text-amber-400" />
            <span>50ms Circuit Breaker</span>
          </div>
        </div>
      </div>
    </section>
  );
}
