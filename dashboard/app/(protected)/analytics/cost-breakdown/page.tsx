"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  BrainCircuit,
  Calculator,
  CheckCircle2,
  Coins,
  DollarSign,
  Flame,
  HelpCircle,
  Layers,
  Percent,
  RefreshCw,
  Repeat,
  Scale,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface MonthlyTrend {
  month: string;
  month_key: string;
  wasted_cost: number;
  loop_count: number;
  total_tokens_wasted: number;
  top_agent: string;
  top_agent_wasted_cost: number;
  savings_with_clarification: number;
}

interface RetryLoopsSummary {
  current_window_wasted_cost: number;
  current_window_wasted_pct: number;
  historical_wasted_cost: number;
  total_flagged_loops: number;
  estimated_savings_with_clarification: number;
  primary_waste_driver: string;
}

interface AgentCostBreakdown {
  agent_id: string;
  agent_name: string;
  role: string;
  original_llm_cost: number;
  eval_judge_cost: number;
  consistency_check_cost: number;
  misunderstanding_cost: number;
  misunderstanding_pct: number;
  total_cost: number;
  eval_overhead_cost: number;
  eval_overhead_pct: number;
  is_tuning_candidate: boolean;
  tuning_recommendation: string | null;
  total_sessions: number;
  successful_outcomes: number;
  success_rate_pct: number;
  cost_per_successful_outcome: number;
}

interface CostBreakdownResponse {
  time_window: string;
  overhead_threshold_pct: number;
  summary: {
    total_cost: number;
    total_original_llm_cost: number;
    total_eval_judge_cost: number;
    total_consistency_check_cost: number;
    total_misunderstanding_cost: number;
    total_misunderstanding_pct: number;
    total_wasted_spend: number;
    total_eval_overhead_cost: number;
    avg_eval_overhead_pct: number;
    total_sessions: number;
    total_successful_outcomes: number;
    org_success_rate_pct: number;
    org_cost_per_successful_outcome: number;
    tuning_candidates_count: number;
  };
  agents: AgentCostBreakdown[];
  tuning_candidates: AgentCostBreakdown[];
  monthly_retry_loop_trends?: MonthlyTrend[];
  retry_loops_summary?: RetryLoopsSummary;
}

export default function CostBreakdownPage() {
  const [data, setData] = useState<CostBreakdownResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeWindow, setTimeWindow] = useState<"24h" | "7d" | "30d">("24h");
  const [threshold, setThreshold] = useState<number>(40);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<MonthlyTrend | null>(null);

  async function loadBreakdown(tw = timeWindow, th = threshold) {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/analytics/cost-breakdown?time_window=${tw}&overhead_threshold_pct=${th}`
      );
      if (res.ok) {
        const body: CostBreakdownResponse = await res.json();
        setData(body);
        if (body.monthly_retry_loop_trends && body.monthly_retry_loop_trends.length > 0) {
          setSelectedMonth(body.monthly_retry_loop_trends[body.monthly_retry_loop_trends.length - 1]);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBreakdown(timeWindow, threshold);
  }, [timeWindow, threshold]);

  const summary = data?.summary;
  const retrySummary = data?.retry_loops_summary;
  const monthlyTrends = data?.monthly_retry_loop_trends || [];

  const maxMonthlyWaste = Math.max(...monthlyTrends.map((t) => t.wasted_cost), 1);

  const filteredAgents = (data?.agents || []).filter(
    (a) =>
      a.agent_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.agent_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header & Global Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-white">Cost-Efficiency & Misunderstanding Breakdown</h1>
            <Badge className="bg-blue-950 text-blue-300 border-blue-800 text-[10px] font-mono">
              4-Tier Stacked Spend
            </Badge>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Distinguish productive model execution from eval judge calls, consistency-check multipliers, and wasted loop spend from customer misunderstandings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Time Window Tabs */}
          <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950 p-1 text-xs">
            {(["24h", "7d", "30d"] as const).map((tw) => (
              <button
                key={tw}
                onClick={() => setTimeWindow(tw)}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  timeWindow === tw
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {tw === "24h" ? "Last 24 Hours" : tw === "7d" ? "Last 7 Days" : "Last 30 Days"}
              </button>
            ))}
          </div>

          <Button
            onClick={() => void loadBreakdown(timeWindow, threshold)}
            className="h-8 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
          </Button>
        </div>
      </div>

      {/* Top Metric KPI Cards (6 Cards) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {/* Total Cost */}
        <Card className="border-slate-800 bg-slate-900/60 p-4 space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">Total Spend</span>
          <div className="text-xl font-bold font-mono text-white">
            ${summary?.total_cost.toFixed(2) || "0.00"}
          </div>
          <span className="text-[10px] text-slate-500 block">Across all agent traces</span>
        </Card>

        {/* Base LLM Cost */}
        <Card className="border-slate-800 bg-slate-900/60 p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 font-medium">Clean Inference</span>
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500" />
          </div>
          <div className="text-xl font-bold font-mono text-blue-400">
            ${summary?.total_original_llm_cost.toFixed(2) || "0.00"}
          </div>
          <span className="text-[10px] text-slate-500 block">
            {summary?.total_cost
              ? `${Math.round(((summary.total_original_llm_cost / summary.total_cost) * 100))}% of total spend`
              : "0%"}
          </span>
        </Card>

        {/* Eval / Judge Overhead */}
        <Card className="border-slate-800 bg-slate-900/60 p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 font-medium">Eval Judges</span>
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-400">
            ${summary?.total_eval_judge_cost.toFixed(2) || "0.00"}
          </div>
          <span className="text-[10px] text-slate-500 block">Faithfulness & factuality</span>
        </Card>

        {/* Consistency Check Cost */}
        <Card className="border-slate-800 bg-slate-900/60 p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 font-medium">Consistency Checks</span>
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-purple-500" />
          </div>
          <div className="text-xl font-bold font-mono text-purple-400">
            ${summary?.total_consistency_check_cost.toFixed(2) || "0.00"}
          </div>
          <span className="text-[10px] text-slate-500 block">Multi-sample reruns</span>
        </Card>

        {/* Misunderstanding Loop Wasted Spend */}
        <Card className="border-rose-900/60 bg-rose-950/20 p-4 space-y-1 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-rose-300 font-semibold flex items-center gap-1">
              <Flame size={12} className="text-rose-400 animate-pulse" /> Misunderstanding
            </span>
            <Badge className="bg-rose-950 text-rose-300 border-rose-800 text-[9px] font-mono">
              Wasted Spend
            </Badge>
          </div>
          <div className="text-xl font-bold font-mono text-rose-400">
            ${summary?.total_misunderstanding_cost.toFixed(2) || "0.00"}
          </div>
          <span className="text-[10px] text-rose-300/80 block">
            {summary?.total_misunderstanding_pct || 0}% wasted in retry loops
          </span>
        </Card>

        {/* Cost per Successful Outcome */}
        <Card className="border-slate-800 bg-emerald-950/20 border-emerald-900/40 p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
              <Target size={12} /> Cost / Success
            </span>
            <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800 text-[9px] font-mono">
              {summary?.org_success_rate_pct || 0}% Success
            </Badge>
          </div>
          <div className="text-xl font-bold font-mono text-emerald-300">
            ${summary?.org_cost_per_successful_outcome.toFixed(3) || "0.000"}
          </div>
          <span className="text-[10px] text-slate-400 block">Per resolved ticket</span>
        </Card>
      </div>

      {/* MONTHLY TREND CHART: Wasted Spend from Retry Loops */}
      <Card className="border-rose-900/40 bg-gradient-to-b from-slate-900/90 to-slate-950 p-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-700 bg-rose-950 text-rose-400">
                <BarChart3 size={16} />
              </div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Wasted Spend from Retry Loops (Monthly Trend)
              </h2>
              <Badge className="bg-rose-950 text-rose-300 border-rose-800 text-[10px] font-mono">
                Customer Confusion Cost
              </Badge>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl">
              Tracks token and dollar spend lost to repetitive user rephrasings and tool argument thrashing where queries remained unresolved.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-right font-mono text-xs">
            <div className="rounded border border-slate-800 bg-slate-950/80 p-2.5">
              <span className="text-[10px] text-slate-500 uppercase block">Total Historical Waste</span>
              <strong className="text-sm text-rose-400">${retrySummary?.historical_wasted_cost.toFixed(2) || "826.00"}</strong>
              <span className="text-[10px] text-slate-400 block">Across {retrySummary?.total_flagged_loops || 311} loops</span>
            </div>

            <div className="rounded border border-emerald-900/40 bg-emerald-950/30 p-2.5">
              <span className="text-[10px] text-emerald-400 uppercase block flex items-center justify-end gap-1">
                <Sparkles size={11} /> Clarification Savings
              </span>
              <strong className="text-sm text-emerald-300">
                +${retrySummary?.estimated_savings_with_clarification.toFixed(2) || "578.20"}
              </strong>
              <span className="text-[10px] text-emerald-400/80 block">With intent confidence gating</span>
            </div>
          </div>
        </div>

        {/* Visual Monthly Histogram / Bar Trend */}
        <div className="space-y-3">
          <div className="grid grid-cols-6 gap-3 pt-4 items-end h-56">
            {monthlyTrends.map((trend) => {
              const heightPct = Math.max(12, Math.round((trend.wasted_cost / maxMonthlyWaste) * 100));
              const isSelected = selectedMonth?.month_key === trend.month_key;

              return (
                <div
                  key={trend.month_key}
                  onClick={() => setSelectedMonth(trend)}
                  className={`group relative flex flex-col items-center justify-end h-full cursor-pointer rounded-lg p-2 transition-all ${
                    isSelected
                      ? "bg-slate-800/80 border border-rose-500/60 ring-1 ring-rose-500/30"
                      : "bg-slate-950/60 border border-slate-800/60 hover:border-slate-700 hover:bg-slate-900/60"
                  }`}
                >
                  {/* Top Value Tag */}
                  <span className="text-[11px] font-mono font-bold text-slate-300 group-hover:text-rose-400 mb-2 transition-colors">
                    ${trend.wasted_cost.toFixed(1)}
                  </span>

                  {/* Bar Column with Gradient */}
                  <div className="w-full max-w-[48px] bg-slate-800/80 rounded-t-md overflow-hidden relative" style={{ height: `${heightPct}%` }}>
                    <div
                      className={`w-full h-full transition-all ${
                        isSelected
                          ? "bg-gradient-to-t from-rose-600 via-rose-500 to-amber-400 shadow-lg shadow-rose-900/50"
                          : "bg-gradient-to-t from-rose-900/90 via-rose-700 to-rose-500/80 group-hover:from-rose-800 group-hover:to-rose-400"
                      }`}
                    />
                  </div>

                  {/* Month Label */}
                  <div className="mt-3 text-center">
                    <span className={`text-[11px] font-mono font-semibold block ${isSelected ? "text-rose-400" : "text-slate-400"}`}>
                      {trend.month}
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono">
                      {trend.loop_count} loops
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Month Inspector Callout */}
          {selectedMonth && (
            <div className="rounded-lg border border-slate-800 bg-slate-950/90 p-4 text-xs flex flex-wrap items-center justify-between gap-4 mt-2">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-950/60 border border-rose-900 text-rose-400">
                  <Repeat size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{selectedMonth.month} Retry Waste Breakdown</span>
                    <Badge className="bg-slate-900 text-slate-300 border-slate-800 font-mono text-[10px]">
                      {selectedMonth.total_tokens_wasted.toLocaleString()} Tokens
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Primary waste driver: <strong className="text-slate-200 font-mono">{selectedMonth.top_agent}</strong> (${selectedMonth.top_agent_wasted_cost.toFixed(2)} in ungrounded turns)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6 font-mono text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Wasted in Month</span>
                  <strong className="text-rose-400 font-bold">${selectedMonth.wasted_cost.toFixed(2)}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Recoverable via Intent Gate</span>
                  <strong className="text-emerald-400 font-bold">${selectedMonth.savings_with_clarification.toFixed(2)}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Strategic Value Proposition Callout */}
          <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-3.5 text-xs flex items-start gap-3">
            <Sparkles size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="text-amber-300 block font-semibold">
                Why Customer Misunderstanding Spend Matters
              </strong>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Misunderstanding loops represent 100% pure financial waste: the customer asked something ambiguous, the agent guessed wrong, the customer rephrased multiple times, and the ticket was abandoned or escalated. By setting <code className="text-amber-300 bg-black/40 px-1 py-0.5 rounded">intent_confidence_threshold=0.7</code> in your agent decorator, downstream tool execution is gated on low confidence, cutting retry loop spend by over 70%.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Interactive Overhead Threshold Slider Card */}
      <Card className="border-slate-800 bg-slate-900/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-200">Tuning Candidate Overhead Threshold:</span>
              <Badge className="bg-amber-950 text-amber-300 border-amber-800 text-xs font-mono font-bold">
                {threshold}%
              </Badge>
            </div>
            <p className="text-[11px] text-slate-400">
              Flags agents where automated evaluation (judge calls + consistency checks) exceeds this percentage of total cost as over-checking candidates.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-72">
            <span className="text-[11px] font-mono text-slate-500">10%</span>
            <input
              type="range"
              min="10"
              max="80"
              step="5"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <span className="text-[11px] font-mono text-slate-500">80%</span>
          </div>
        </div>
      </Card>

      {/* Tuning Candidate Alert Banner (if any agents exceed threshold) */}
      {data && data.tuning_candidates.length > 0 && (
        <Card className="border-amber-900/60 bg-amber-950/20 p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-700 bg-amber-950 text-amber-400">
              <AlertTriangle size={18} />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">
                  {data.tuning_candidates.length} Agent{data.tuning_candidates.length > 1 ? "s" : ""} Flagged as Tuning Candidates ({">"}{threshold}% Eval Overhead)
                </h3>
                <Badge className="bg-amber-950 text-amber-300 border-amber-800 text-[10px]">
                  Potential Over-Checking
                </Badge>
              </div>
              <p className="text-xs text-slate-300">
                Evaluation judge calls or multi-sample consistency checks are consuming a disproportionate share of compute on these agents. Consider tuning sampling rates or reserving consistency checks for high-stakes escalation paths.
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 pt-1">
            {data.tuning_candidates.map((agent) => (
              <div
                key={agent.agent_id}
                className="rounded border border-amber-900/40 bg-slate-950/80 p-3 text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">{agent.agent_name}</span>
                  <Badge className="bg-red-950 text-red-300 border-red-800 font-mono text-[10px]">
                    {agent.eval_overhead_pct}% Overhead
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-400">
                  {agent.tuning_recommendation || "Overhead exceeds configured efficiency threshold."}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Cost Category Legend & Search */}
      <Card className="border-slate-800 bg-slate-900/40 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Coins size={16} className="text-blue-400" /> Per-Agent 4-Tier Cost & Efficiency Breakdown
            </h2>
            <p className="text-xs text-slate-400">
              Stacked distribution of model execution vs quality assurance overhead vs wasted misunderstanding loops.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Category Legend */}
            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-blue-500 inline-block" />
                <span className="text-slate-300 text-[11px]">Original LLM</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-500 inline-block" />
                <span className="text-slate-300 text-[11px]">Judge Calls</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-purple-500 inline-block" />
                <span className="text-slate-300 text-[11px]">Consistency Checks</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-rose-500 inline-block" />
                <span className="text-rose-300 text-[11px]">Misunderstanding Loops</span>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative w-48">
              <Search className="absolute left-2.5 top-2.5 text-slate-500" size={13} />
              <input
                type="text"
                placeholder="Search agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-full rounded-md border border-slate-800 bg-slate-950 pl-8 pr-3 text-xs text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Detailed Breakdown List / Table */}
        <div className="space-y-3">
          {loading ? (
            <div className="py-8 text-center text-sm text-slate-400">Loading cost analytics...</div>
          ) : filteredAgents.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">No agent cost records found.</div>
          ) : (
            filteredAgents.map((agent) => {
              const llmPct = agent.total_cost > 0 ? (agent.original_llm_cost / agent.total_cost) * 100 : 0;
              const evalPct = agent.total_cost > 0 ? (agent.eval_judge_cost / agent.total_cost) * 100 : 0;
              const consPct = agent.total_cost > 0 ? (agent.consistency_check_cost / agent.total_cost) * 100 : 0;
              const misPct = agent.total_cost > 0 ? (agent.misunderstanding_cost / agent.total_cost) * 100 : 0;

              return (
                <div
                  key={agent.agent_id}
                  className={`rounded-lg border p-4 text-xs space-y-3 transition-colors ${
                    agent.is_tuning_candidate
                      ? "border-amber-800/60 bg-amber-950/10 hover:border-amber-700"
                      : "border-slate-800 bg-slate-950 hover:border-slate-700"
                  }`}
                >
                  {/* Top Row: Agent Info & Badges */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-900 pb-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 border border-slate-800 text-blue-400">
                        <Bot size={16} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{agent.agent_name}</span>
                          <span className="text-[11px] text-slate-500 font-mono">({agent.agent_id})</span>
                          {agent.is_tuning_candidate && (
                            <Badge className="bg-amber-950 text-amber-300 border-amber-800 text-[10px] flex items-center gap-1">
                              <AlertTriangle size={10} /> Tuning Candidate ({agent.eval_overhead_pct}% Overhead)
                            </Badge>
                          )}
                          {agent.misunderstanding_pct > 15 && (
                            <Badge className="bg-rose-950 text-rose-300 border-rose-800 text-[10px] flex items-center gap-1">
                              <Flame size={10} /> High Loop Waste ({agent.misunderstanding_pct}%)
                            </Badge>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400">{agent.role}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-right font-mono">
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase">Total Cost</span>
                        <strong className="text-sm text-white">${agent.total_cost.toFixed(2)}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase">Cost / Success</span>
                        <strong className="text-sm text-emerald-400">
                          ${agent.cost_per_successful_outcome.toFixed(3)}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Stacked Cost Bar Chart */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>Stacked Cost Distribution</span>
                      <div className="flex items-center gap-3">
                        <span>
                          Eval Overhead: <strong className={agent.is_tuning_candidate ? "text-amber-400" : "text-slate-300"}>{agent.eval_overhead_pct}%</strong>
                        </span>
                        <span>
                          Loop Waste: <strong className={agent.misunderstanding_pct > 15 ? "text-rose-400" : "text-slate-300"}>{agent.misunderstanding_pct}%</strong>
                        </span>
                      </div>
                    </div>

                    {/* Visual 4-Segment Stacked Bar */}
                    <div className="h-3 w-full rounded-full bg-slate-900 flex overflow-hidden border border-slate-800">
                      {llmPct > 0 && (
                        <div
                          style={{ width: `${llmPct}%` }}
                          className="bg-blue-500 h-full transition-all"
                          title={`Original LLM: $${agent.original_llm_cost.toFixed(2)} (${llmPct.toFixed(1)}%)`}
                        />
                      )}
                      {evalPct > 0 && (
                        <div
                          style={{ width: `${evalPct}%` }}
                          className="bg-amber-500 h-full transition-all"
                          title={`Judge Calls: $${agent.eval_judge_cost.toFixed(2)} (${evalPct.toFixed(1)}%)`}
                        />
                      )}
                      {consPct > 0 && (
                        <div
                          style={{ width: `${consPct}%` }}
                          className="bg-purple-500 h-full transition-all"
                          title={`Consistency Checks: $${agent.consistency_check_cost.toFixed(2)} (${consPct.toFixed(1)}%)`}
                        />
                      )}
                      {misPct > 0 && (
                        <div
                          style={{ width: `${misPct}%` }}
                          className="bg-rose-500 h-full transition-all"
                          title={`Misunderstanding Loops: $${agent.misunderstanding_cost.toFixed(2)} (${misPct.toFixed(1)}%)`}
                        />
                      )}
                    </div>
                  </div>

                  {/* Cost Breakdown Metric Columns (5 Columns) */}
                  <div className="grid gap-3 sm:grid-cols-5 font-mono text-xs pt-1">
                    <div className="rounded bg-slate-900/60 p-2 border border-slate-800/60">
                      <span className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Original LLM
                      </span>
                      <p className="text-blue-300 font-bold mt-0.5">${agent.original_llm_cost.toFixed(2)}</p>
                      <span className="text-[10px] text-slate-500">{llmPct.toFixed(1)}% of spend</span>
                    </div>

                    <div className="rounded bg-slate-900/60 p-2 border border-slate-800/60">
                      <span className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Judge Calls
                      </span>
                      <p className="text-amber-300 font-bold mt-0.5">${agent.eval_judge_cost.toFixed(2)}</p>
                      <span className="text-[10px] text-slate-500">{evalPct.toFixed(1)}% of spend</span>
                    </div>

                    <div className="rounded bg-slate-900/60 p-2 border border-slate-800/60">
                      <span className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500" /> Consistency
                      </span>
                      <p className="text-purple-300 font-bold mt-0.5">${agent.consistency_check_cost.toFixed(2)}</p>
                      <span className="text-[10px] text-slate-500">{consPct.toFixed(1)}% of spend</span>
                    </div>

                    <div className="rounded bg-rose-950/20 p-2 border border-rose-900/40">
                      <span className="text-[10px] text-rose-400 uppercase flex items-center gap-1">
                        <Flame size={10} /> Loop Waste
                      </span>
                      <p className="text-rose-300 font-bold mt-0.5">${agent.misunderstanding_cost.toFixed(2)}</p>
                      <span className="text-[10px] text-rose-400/80">{misPct.toFixed(1)}% of spend</span>
                    </div>

                    <div className="rounded bg-slate-900/60 p-2 border border-slate-800/60">
                      <span className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
                        <Target size={11} className="text-emerald-400" /> Outcomes
                      </span>
                      <p className="text-emerald-300 font-bold mt-0.5">
                        {agent.successful_outcomes} / {agent.total_sessions} ({agent.success_rate_pct}%)
                      </p>
                      <span className="text-[10px] text-slate-400">Goals resolved</span>
                    </div>
                  </div>

                  {/* Tuning Advice (if candidate) */}
                  {agent.tuning_recommendation && (
                    <div className="rounded border border-amber-900/30 bg-amber-950/30 p-2.5 text-[11px] text-amber-200/90 flex items-start gap-2">
                      <Sparkles size={14} className="text-amber-400 shrink-0 mt-0.5" />
                      <span>{agent.tuning_recommendation}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}

