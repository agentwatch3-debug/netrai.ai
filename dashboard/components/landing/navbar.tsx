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
      <div className="flex h-14 items-center justify-between rounded-sm border border-borderStrong bg-surface/95 px-5 shadow-none backdrop-blur-md transition-all">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-7 w-7 items-center justify-center rounded-none bg-ink text-surface">
            <Network className="h-4 w-4" />
          </div>
          <span className="text-sm font-bold tracking-tight text-ink font-mono flex items-center gap-1.5">
            NetrAI <span className="text-[10px] text-inkDim font-semibold px-1.5 py-0.5 rounded-none bg-paper border border-border">v2.4 LTS</span>
          </span>
        </Link>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-mono font-medium text-inkDim">
          <Link href="#features" className="hover:text-ink transition-colors">
            Features
          </Link>
          <Link href="#interactive-trace" className="hover:text-ink transition-colors flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-none bg-good" />
            Live Trace Demo
          </Link>
          <Link href="#mcp" className="hover:text-ink transition-colors flex items-center gap-1 text-accent font-semibold">
            <Bot size={13} /> MCP Server
          </Link>
          <Link href="#comparison" className="hover:text-ink transition-colors">
            Comparison
          </Link>
          <Link href="/dashboard" className="hover:text-ink transition-colors">
            Dashboard
          </Link>
        </nav>

        {/* Right Auth & CTAs */}
        <div className="flex items-center gap-2.5">
          <a
            href="https://github.com/agentwatch3-debug/netrai.ai"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:flex items-center gap-1.5 rounded-sm border border-border bg-paper px-3 py-1.5 text-xs text-ink hover:border-ink hover:bg-surface transition-colors font-mono"
          >
            <Github size={13} />
            <span>★ Star</span>
          </a>

          {hasClerk ? (
            <>
              <SignedOut>
                <SignInButton mode="modal">
                  <Button className="h-8 text-xs bg-surface border border-border hover:bg-paper text-ink rounded-sm px-3 font-mono">
                    Sign In
                  </Button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <Button className="h-8 text-xs bg-ink hover:bg-ink/90 text-surface rounded-sm font-semibold px-3.5 border border-ink font-mono">
                    Sign Up
                  </Button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <Link href="/dashboard">
                  <Button className="h-8 text-xs bg-accent text-white hover:bg-accent/90 rounded-sm px-3 flex items-center gap-1 font-mono">
                    Dashboard <ArrowRight size={13} />
                  </Button>
                </Link>
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
            </>
          ) : (
            <Link href="/dashboard">
              <Button className="h-8 text-xs bg-ink hover:bg-ink/90 text-surface rounded-sm flex items-center gap-1 font-semibold px-3.5 border border-ink font-mono">
                Launch App <ArrowRight size={13} />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
