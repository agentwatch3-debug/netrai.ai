"use client";

import Link from "next/link";
import { ArrowRight, Bot, Cpu, Github, Network, Shield, Sparkles, Terminal, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

export function LandingNavbar() {
  const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  return (
    <header className="sticky top-4 z-50 mx-auto max-w-6xl px-4">
      <div className="flex h-14 items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-5 shadow-2xl backdrop-blur-xl transition-all">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <Network className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight text-white font-mono flex items-center gap-1.5">
            NetrAI <span className="text-[10px] text-blue-400 font-semibold px-1.5 py-0.5 rounded bg-blue-950/60 border border-blue-800/60">v2.4 LTS</span>
          </span>
        </Link>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-300">
          <Link href="#features" className="hover:text-white transition-colors">
            Features
          </Link>
          <Link href="#interactive-trace" className="hover:text-white transition-colors flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live Trace Demo
          </Link>
          <Link href="#mcp" className="hover:text-white transition-colors flex items-center gap-1 text-purple-300">
            <Bot size={13} /> MCP Server
          </Link>
          <Link href="#comparison" className="hover:text-white transition-colors">
            Comparison
          </Link>
          <Link href="/dashboard" className="hover:text-white transition-colors">
            Dashboard
          </Link>
        </nav>

        {/* Right Auth & CTAs */}
        <div className="flex items-center gap-2.5">
          <a
            href="https://github.com/agentwatch3-debug/netrai.ai"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-700 hover:text-white transition-colors font-mono"
          >
            <Github size={13} />
            <span>★ Star</span>
          </a>

          {hasClerk ? (
            <>
              <SignedOut>
                <SignInButton mode="modal">
                  <Button className="h-8 text-xs bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 rounded-lg px-3">
                    Sign In
                  </Button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <Button className="h-8 text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg shadow-md shadow-indigo-600/30 font-semibold px-3.5">
                    Sign Up
                  </Button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <Link href="/dashboard">
                  <Button className="h-8 text-xs bg-blue-600/30 border border-blue-500/50 hover:bg-blue-600/40 text-blue-300 rounded-lg px-3 flex items-center gap-1">
                    Dashboard <ArrowRight size={13} />
                  </Button>
                </Link>
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
            </>
          ) : (
            <Link href="/dashboard">
              <Button className="h-8 text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg shadow-md shadow-indigo-600/30 flex items-center gap-1 font-semibold px-3.5">
                Launch App <ArrowRight size={13} />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
