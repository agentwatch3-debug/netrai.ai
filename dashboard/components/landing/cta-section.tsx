"use client";

import Link from "next/link";
import { ArrowRight, Bot, Github, Sparkles, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CTASection() {
  return (
    <section className="py-20 relative">
      <div className="mx-auto max-w-5xl px-4">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-blue-950/40 via-indigo-950/30 to-purple-950/40 p-8 sm:p-14 text-center space-y-6 shadow-2xl backdrop-blur-2xl relative overflow-hidden">
          {/* Subtle Accent Glow */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 bg-blue-500/20 blur-3xl pointer-events-none" />

          <div className="space-y-3 max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              Ready to Observe & Secure Your Agent Swarms?
            </h2>
            <p className="text-sm sm:text-base text-slate-300">
              Start tracing in less than 3 minutes. Zero credit card required. Run 100% free locally with Ollama or connect your production swarms.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link href="/dashboard">
              <Button className="h-11 px-7 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/30 text-sm flex items-center gap-2">
                Open Dashboard <ArrowRight size={15} />
              </Button>
            </Link>

            <a
              href="https://github.com/agentwatch/agentwatch"
              target="_blank"
              rel="noreferrer"
              className="h-11 px-6 border border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 text-slate-200 font-semibold rounded-xl text-sm flex items-center gap-2 font-mono backdrop-blur-md"
            >
              <Github size={15} /> View on GitHub
            </a>
          </div>

          {/* Quick Terminal Snippet */}
          <div className="pt-4 max-w-md mx-auto">
            <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-3 font-mono text-xs text-slate-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal size={14} className="text-blue-400" />
                <span>pip install agentwatch-sdk && agentwatch mcp</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-semibold">● stdio</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
