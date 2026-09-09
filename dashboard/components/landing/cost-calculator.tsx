"use client";

import { useState } from "react";
import { AlertTriangle, Calculator, DollarSign, ShieldAlert, Sparkles, Zap, ZapOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function CostCalculator() {
  const [agentsCount, setAgentsCount] = useState(4);
  const [reqPerMin, setReqPerMin] = useState(60);
  const [tokensPerCall, setTokensPerCall] = useState(1200);

  // Model pricing approximation: $0.002 per 1k tokens (blend)
  const tokenRatePerThousand = 0.002;
  const callsPerMonth = reqPerMin * 60 * 24 * 30 * agentsCount;
  const tokensPerMonth = callsPerMonth * tokensPerCall;
  const monthlySpendUsd = (tokensPerMonth / 1000) * tokenRatePerThousand;
  const loopRunawayRiskUsd = agentsCount * 125.0; // Estimated runaway without breaker

  return (
    <section className="py-20 relative">
      <div className="mx-auto max-w-6xl px-4 space-y-10">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <Badge variant="neutral" className="border-borderStrong text-ink bg-surface text-[10px] font-mono uppercase tracking-wider">
            Live Cost & Risk Simulator
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-ink font-display tracking-tight">
            Estimate Swarm Spend & Runaway Protection
          </h2>
          <p className="text-sm text-inkDim">
            Calculate your monthly LLM token volume and simulate how NetrAI prevents catastrophic runaway loop bills.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-center">
          {/* Sliders Form */}
          <Card className="border border-border bg-surface p-6 rounded-sm shadow-none space-y-5">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-inkDim font-semibold">Active Agent Swarm Size</span>
                <span className="text-ink font-bold">{agentsCount} Agents</span>
              </div>
              <input
                type="range"
                min={1}
                max={20}
                value={agentsCount}
                onChange={(e) => setAgentsCount(Number(e.target.value))}
                className="w-full h-2 bg-paper rounded-none appearance-none cursor-pointer accent-ink border border-border"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-inkDim font-semibold">Request Velocity</span>
                <span className="text-ink font-bold">{reqPerMin} reqs / min</span>
              </div>
              <input
                type="range"
                min={10}
                max={500}
                step={10}
                value={reqPerMin}
                onChange={(e) => setReqPerMin(Number(e.target.value))}
                className="w-full h-2 bg-paper rounded-none appearance-none cursor-pointer accent-ink border border-border"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-inkDim font-semibold">Avg Tokens per Span</span>
                <span className="text-ink font-bold">{tokensPerCall} tokens</span>
              </div>
              <input
                type="range"
                min={200}
                max={8000}
                step={200}
                value={tokensPerCall}
                onChange={(e) => setTokensPerCall(Number(e.target.value))}
                className="w-full h-2 bg-paper rounded-none appearance-none cursor-pointer accent-ink border border-border"
              />
            </div>
          </Card>

          {/* Results Summary Card */}
          <Card className="border border-borderStrong bg-paper p-6 rounded-sm shadow-none space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <span className="text-xs font-mono text-inkDim uppercase font-semibold">Estimated Monthly LLM Spend</span>
              <span className="text-3xl font-extrabold font-mono text-ink">
                ${monthlySpendUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-3 rounded-none bg-surface border border-border space-y-1">
                <span className="text-inkDim text-[10px] uppercase font-semibold">Total Spans Tracked</span>
                <p className="text-base font-bold text-ink">
                  {(callsPerMonth / 1000000).toFixed(1)}M spans/mo
                </p>
              </div>

              <div className="p-3 rounded-none bg-surface border border-border space-y-1">
                <span className="text-inkDim text-[10px] uppercase font-semibold">Monthly Tokens</span>
                <p className="text-base font-bold text-ink">
                  {(tokensPerMonth / 1000000000).toFixed(2)}B tokens
                </p>
              </div>
            </div>

            {/* Runaway Danger Shield Alert */}
            <div className="p-4 rounded-none bg-surface border border-warn/40 text-xs font-mono space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-warn flex items-center gap-1.5 uppercase">
                  <ZapOff size={14} /> Runaway Loss Protected
                </span>
                <span className="font-extrabold text-good">
                  -${loopRunawayRiskUsd.toFixed(2)} Risk Trapped
                </span>
              </div>
              <p className="text-[11px] text-inkDim">
                Circuit breaker triggers within 50ms if loop frequency surpasses 30 tool calls or spend exceeds $50.00.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
