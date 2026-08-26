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
          <Badge className="bg-amber-950/60 text-amber-300 border-amber-800 text-[10px] font-mono uppercase tracking-wider">
            Live Cost & Risk Simulator
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Estimate Swarm Spend & Runaway Protection
          </h2>
          <p className="text-sm text-slate-400">
            Calculate your monthly LLM token volume and simulate how AgentWatch prevents catastrophic runaway loop bills.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-center">
          {/* Sliders Form */}
          <Card className="border-white/10 bg-slate-900/40 p-6 rounded-2xl shadow-xl backdrop-blur-xl space-y-5">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-300">Active Agent Swarm Size</span>
                <span className="text-blue-400 font-bold">{agentsCount} Agents</span>
              </div>
              <input
                type="range"
                min={1}
                max={20}
                value={agentsCount}
                onChange={(e) => setAgentsCount(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-300">Request Velocity</span>
                <span className="text-purple-400 font-bold">{reqPerMin} reqs / min</span>
              </div>
              <input
                type="range"
                min={10}
                max={500}
                step={10}
                value={reqPerMin}
                onChange={(e) => setReqPerMin(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-300">Avg Tokens per Span</span>
                <span className="text-emerald-400 font-bold">{tokensPerCall} tokens</span>
              </div>
              <input
                type="range"
                min={200}
                max={8000}
                step={200}
                value={tokensPerCall}
                onChange={(e) => setTokensPerCall(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>
          </Card>

          {/* Results Summary Card */}
          <Card className="border-blue-900/50 bg-gradient-to-br from-blue-950/30 to-indigo-950/20 p-6 rounded-2xl shadow-2xl backdrop-blur-xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <span className="text-xs font-mono text-slate-400 uppercase">Estimated Monthly LLM Spend</span>
              <span className="text-3xl font-extrabold font-mono text-white">
                ${monthlySpendUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-3 rounded-lg bg-slate-950/60 border border-white/5 space-y-1">
                <span className="text-slate-500 text-[10px] uppercase">Total Spans Tracked</span>
                <p className="text-base font-bold text-slate-200">
                  {(callsPerMonth / 1000000).toFixed(1)}M spans/mo
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/60 border border-white/5 space-y-1">
                <span className="text-slate-500 text-[10px] uppercase">Breaker Protection</span>
                <p className="text-base font-bold text-emerald-400">
                  -$50 cap / loop
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-4 text-xs font-mono text-amber-200 flex items-start gap-3">
              <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={16} />
              <div>
                <strong className="block text-white font-bold">Infinite Loop Protection Active</strong>
                <span>
                  Without circuit breakers, an agent loop could burn up to ~${loopRunawayRiskUsd.toFixed(0)} before manual detection. AgentWatch kills it at $50.00.
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
