"use client";

import Link from "next/link";
import { ArrowRight, Bot, Github, Sparkles, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CTASection() {
  return (
    <section className="py-20 relative">
      <div className="mx-auto max-w-5xl px-4">
        <div className="rounded-sm border border-borderStrong bg-surface p-8 sm:p-14 text-center space-y-6 shadow-none relative overflow-hidden">
          <div className="space-y-3 max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-5xl font-bold text-ink tracking-tight font-display">
              Ready to Observe & Secure Your Agent Swarms?
            </h2>
            <p className="text-sm sm:text-base text-inkDim">
              Start tracing in less than 3 minutes. Zero credit card required. Run 100% free locally with Ollama or connect your production swarms.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link href="/dashboard">
              <Button className="h-11 px-7 bg-ink hover:bg-ink/90 text-surface font-mono font-bold rounded-sm border border-ink shadow-none text-sm flex items-center gap-2">
                Open Dashboard <ArrowRight size={15} />
              </Button>
            </Link>

            <a
              href="https://github.com/agentwatch3-debug/netrai.ai"
              target="_blank"
              rel="noreferrer"
              className="h-11 px-6 border border-borderStrong bg-surface hover:bg-paper text-ink font-mono font-semibold rounded-sm text-sm flex items-center gap-2 shadow-none"
            >
              <Github size={15} /> View on GitHub
            </a>
          </div>

          {/* Quick Terminal Snippet */}
          <div className="pt-4 max-w-md mx-auto">
            <div className="rounded-sm border border-border bg-ink p-3 font-mono text-xs text-[#F4F3EE] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal size={14} className="text-accentSoft" />
                <span>pip install agentwatch-sdk && agentwatch mcp</span>
              </div>
              <span className="text-[10px] text-good font-semibold">● stdio</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
