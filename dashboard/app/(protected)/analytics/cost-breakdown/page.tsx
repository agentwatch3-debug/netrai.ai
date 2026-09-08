"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bot,
  CheckCircle2,
  Code2,
  Coins,
  Copy,
  Flame,
  IndianRupee,
  Lightbulb,
  RefreshCw,
  Repeat,
  Scissors,
  Search,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatRow } from "@/components/ui/stat-row";

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

interface OptimizationOpportunity {
  advisor_type: "prompt_caching" | "context_pruning";
  agent_id: string;
  agent_name: string;
  provider: string;
  model: string;
  headline: string;
  detail: string;
  recommended_action: string;
  code_example?: string;
  repeated_prompt_pct: number;
  static_token_count: number;
  input_to_output_ratio: number;
  avg_input_tokens: number;
  avg_output_tokens: number;
  sample_call_count: number;
  estimated_monthly_calls: number;
  estimated_cost_reduction_pct: number;
  estimated_monthly_savings_usd: number;
  estimated_monthly_savings_inr: number;
}

interface CostOptimizationResponse {
  org_id: string;
  currency: string;
  usd_to_inr_rate: number;
  summary: {
    total_potential_monthly_savings_inr: number;
    total_potential_monthly_savings_usd: number;
    total_opportunities_count: number;
    prompt_caching_opportunities_count: number;
    context_pruning_opportunities_count: number;
    top_opportunity_headline: string;
    top_opportunity_savings_inr: number;
  };
  opportunities: OptimizationOpportunity[];
}

export default function CostBreakdownPage() {
  const [activeTab, setActiveTab] = useState<"breakdown" | "optimization">("breakdown");
  const [data, setData] = useState<CostBreakdownResponse | null>(null);
  const [optData, setOptData] = useState<CostOptimizationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeWindow, setTimeWindow] = useState<"24h" | "7d" | "30d">("24h");
  const [threshold, setThreshold] = useState<number>(40);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<MonthlyTrend | null>(null);
  const [advisorFilter, setAdvisorFilter] = useState<"all" | "prompt_caching" | "context_pruning">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function loadData(tw = timeWindow, th = threshold) {
    setLoading(true);
    try {
      const [breakdownRes, optRes] = await Promise.all([
        fetch(`/api/analytics/cost-breakdown?time_window=${tw}&overhead_threshold_pct=${th}`),
        fetch(`/api/analytics/cost-optimization`),
      ]);

      if (breakdownRes.ok) {
        const body: CostBreakdownResponse = await breakdownRes.json();
        setData(body);
        if (body.monthly_retry_loop_trends && body.monthly_retry_loop_trends.length > 0) {
          setSelectedMonth(body.monthly_retry_loop_trends[body.monthly_retry_loop_trends.length - 1]);
        }
      }

      if (optRes.ok) {
        const optBody: CostOptimizationResponse = await optRes.json();
        setOptData(optBody);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData(timeWindow, threshold);
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

  const filteredOpportunities = (optData?.opportunities || []).filter((o) => {
    const matchesFilter = advisorFilter === "all" || o.advisor_type === advisorFilter;
    const matchesSearch =
      o.agent_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.agent_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.headline.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.model.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  function handleCopy(text: string, id: string) {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const breakdownStatItems = [
    {
      label: "Total Spend",
      value: `$${summary?.total_cost.toFixed(2) || "0.00"}`,
      subtext: "Across all agent traces",
    },
    {
      label: "Clean Inference",
      value: `$${summary?.total_original_llm_cost.toFixed(2) || "0.00"}`,
      subtext: summary?.total_cost
        ? `${Math.round(((summary.total_original_llm_cost / summary.total_cost) * 100))}% of total spend`
        : "0%",
      valueClassName: "text-accent",
    },
    {
      label: "Eval Judges",
      value: `$${summary?.total_eval_judge_cost.toFixed(2) || "0.00"}`,
      subtext: "Faithfulness & factuality",
      valueClassName: "text-warn",
    },
    {
      label: "Consistency Checks",
      value: `$${summary?.total_consistency_check_cost.toFixed(2) || "0.00"}`,
      subtext: "Multi-sample reruns",
    },
    {
      label: "Loop Waste",
      value: `$${summary?.total_misunderstanding_cost.toFixed(2) || "0.00"}`,
      subtext: `${summary?.total_misunderstanding_pct || 0}% wasted in loops`,
      valueClassName: "text-bad",
    },
    {
      label: "Cost / Success",
      value: `$${summary?.org_cost_per_successful_outcome.toFixed(3) || "0.000"}`,
      subtext: `${summary?.org_success_rate_pct || 0}% success rate`,
      valueClassName: "text-good",
    },
  ];

  const optStatItems = [
    {
      label: "Prompt Caching Savings",
      value: "₹82,990/mo",
      subtext: "Anthropic & OpenAI preambles",
      valueClassName: "text-accent",
    },
    {
      label: "RAG & Context Pruning",
      value: "₹62,792/mo",
      subtext: "Oversized chunk reduction",
      valueClassName: "text-warn",
    },
    {
      label: "Avg. Cost Reduction",
      value: "39.1%",
      subtext: "Projected compute reduction",
      valueClassName: "text-good",
    },
    {
      label: "Implementation Effort",
      value: "< 30 mins",
      subtext: "Zero model retraining needed",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Main Page Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
              Cost-Efficiency & Optimization Advisor
            </h1>
            <Badge variant="good" dot={false} className="border border-border bg-paper px-1.5 py-0.5 text-[10px] font-mono">
              Indian Engineering ROI (₹)
            </Badge>
          </div>
          <p className="text-xs text-inkDim mt-1">
            Distinguish model inference from evaluation overhead, monitor customer misunderstanding loop waste, and activate automated prompt caching & context pruning recommendations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Main Tab Switcher */}
          <div className="flex items-center gap-1 border border-border bg-surface p-1 text-xs">
            <button
              onClick={() => setActiveTab("breakdown")}
              className={`px-3 py-1 text-xs font-mono font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === "breakdown"
                  ? "bg-ink text-paper"
                  : "text-inkDim hover:text-ink"
              }`}
            >
              <Coins size={13} /> Spend Breakdown
            </button>
            <button
              onClick={() => setActiveTab("optimization")}
              className={`px-3 py-1 text-xs font-mono font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === "optimization"
                  ? "bg-ink text-paper"
                  : "text-inkDim hover:text-ink"
              }`}
            >
              <Lightbulb size={13} /> Cost Optimization Advisor
              {optData && (
                <span className="text-accentSoft bg-accent text-[9px] px-1 font-mono ml-0.5">
                  ₹{(optData.summary.total_potential_monthly_savings_inr / 1000).toFixed(0)}k/mo
                </span>
              )}
            </button>
          </div>

          <Button
            onClick={() => void loadData(timeWindow, threshold)}
            className="h-8 text-xs border border-border bg-surface hover:bg-paper flex items-center gap-1.5"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
          </Button>
        </div>
      </div>

      {activeTab === "breakdown" ? (
        <>
          {/* Single Bordered Flex Container with Internal Dividers (.stat-row) */}
          <StatRow items={breakdownStatItems} />

          {/* MONTHLY TREND CHART: Wasted Spend from Retry Loops */}
          <div className="border border-border bg-surface p-6 space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <BarChart3 size={16} className="text-bad" />
                  <h2 className="text-sm font-bold text-ink font-display uppercase tracking-wide">
                    Wasted Spend from Retry Loops (Monthly Trend)
                  </h2>
                  <Badge variant="bad">Customer Confusion Cost</Badge>
                </div>
                <p className="text-xs text-inkDim max-w-2xl">
                  Tracks token and dollar spend lost to repetitive user rephrasings and tool argument thrashing where queries remained unresolved.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-right font-mono text-xs">
                <div className="border border-border bg-paper p-2.5">
                  <span className="text-[10px] text-inkFaint uppercase block">Total Historical Waste</span>
                  <strong className="text-sm text-bad">${retrySummary?.historical_wasted_cost.toFixed(2) || "826.00"}</strong>
                  <span className="text-[10px] text-inkDim block font-sans">Across {retrySummary?.total_flagged_loops || 311} loops</span>
                </div>

                <div className="border border-border bg-accentSoft p-2.5">
                  <span className="text-[10px] text-accent uppercase block flex items-center justify-end gap-1 font-sans font-medium">
                    <Sparkles size={11} /> Clarification Savings
                  </span>
                  <strong className="text-sm text-good">
                    +${retrySummary?.estimated_savings_with_clarification.toFixed(2) || "578.20"}
                  </strong>
                  <span className="text-[10px] text-inkDim block font-sans">With intent confidence gating</span>
                </div>
              </div>
            </div>

            {/* Visual Monthly Histogram / Bar Trend */}
            <div className="space-y-3">
              <div className="grid grid-cols-6 gap-3 pt-4 items-end h-48">
                {monthlyTrends.map((trend) => {
                  const heightPct = Math.max(12, Math.round((trend.wasted_cost / maxMonthlyWaste) * 100));
                  const isSelected = selectedMonth?.month_key === trend.month_key;

                  return (
                    <div
                      key={trend.month_key}
                      onClick={() => setSelectedMonth(trend)}
                      className={`group relative flex flex-col items-center justify-end h-full cursor-pointer p-2 transition-all border ${
                        isSelected
                          ? "bg-paper border-ink"
                          : "bg-surface border-border hover:border-borderStrong hover:bg-paper"
                      }`}
                    >
                      <span className="text-[11px] font-mono font-bold text-ink mb-2">
                        ${trend.wasted_cost.toFixed(1)}
                      </span>

                      <div className="w-full max-w-[40px] bg-border rounded-none overflow-hidden relative" style={{ height: `${heightPct}%` }}>
                        <div
                          className={`w-full h-full transition-all ${
                            isSelected ? "bg-bad" : "bg-inkDim group-hover:bg-bad"
                          }`}
                        />
                      </div>

                      <div className="mt-3 text-center">
                        <span className={`text-[11px] font-mono font-semibold block ${isSelected ? "text-bad" : "text-ink"}`}>
                          {trend.month}
                        </span>
                        <span className="text-[9px] text-inkFaint font-mono">
                          {trend.loop_count} loops
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Selected Month Inspector Callout */}
              {selectedMonth && (
                <div className="border border-border bg-paper p-3.5 text-xs flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Repeat size={16} className="text-bad shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink">{selectedMonth.month} Retry Waste Breakdown</span>
                        <span className="font-mono text-[10px] text-inkDim border border-border bg-surface px-1.5 py-0.5">
                          {selectedMonth.total_tokens_wasted.toLocaleString()} Tokens
                        </span>
                      </div>
                      <p className="text-[11px] text-inkDim mt-0.5 font-mono">
                        Primary driver: <strong className="text-ink">{selectedMonth.top_agent}</strong> (${selectedMonth.top_agent_wasted_cost.toFixed(2)} wasted)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 font-mono text-xs">
                    <div>
                      <span className="text-[10px] text-inkFaint block uppercase font-sans font-medium">Wasted in Month</span>
                      <strong className="text-bad font-bold">${selectedMonth.wasted_cost.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-inkFaint block uppercase font-sans font-medium">Recoverable via Gate</span>
                      <strong className="text-good font-bold">${selectedMonth.savings_with_clarification.toFixed(2)}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Threshold Slider Card */}
          <div className="border border-border bg-surface p-3.5 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-ink">Tuning Candidate Overhead Threshold:</span>
                <span className="font-mono text-xs font-bold text-warn border border-border bg-paper px-1.5 py-0.2">
                  {threshold}%
                </span>
              </div>
              <p className="text-[11px] text-inkDim">
                Flags agents where evaluation overhead (judge calls + consistency checks) exceeds this percentage of total cost.
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-64">
              <span className="text-[11px] font-mono text-inkFaint">10%</span>
              <input
                type="range"
                min="10"
                max="80"
                step="5"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full accent-accent cursor-pointer"
              />
              <span className="text-[11px] font-mono text-inkFaint">80%</span>
            </div>
          </div>

          {/* Breakdown Table & Legend */}
          <div className="border border-border bg-surface p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-3">
              <div>
                <h2 className="text-xs uppercase tracking-wide text-inkFaint font-medium font-sans">
                  Per-Agent Cost & Efficiency Distribution
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-3 text-xs font-mono">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-accent inline-block" />
                    <span className="text-inkDim text-[11px]">LLM</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-warn inline-block" />
                    <span className="text-inkDim text-[11px]">Judge</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-inkDim inline-block" />
                    <span className="text-inkDim text-[11px]">Consistency</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-bad inline-block" />
                    <span className="text-bad text-[11px]">Loop Waste</span>
                  </div>
                </div>

                <div className="relative w-48">
                  <Search className="absolute left-2.5 top-2.5 text-inkFaint" size={13} />
                  <input
                    type="text"
                    placeholder="Search agents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 w-full border border-border bg-paper pl-8 pr-3 text-xs text-ink placeholder-inkFaint focus:border-borderStrong focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* List */}
            <div className="space-y-3">
              {loading ? (
                <div className="py-6 text-center text-xs text-inkDim font-mono">Loading cost analytics...</div>
              ) : filteredAgents.length === 0 ? (
                <div className="py-6 text-center text-xs text-inkDim">No agent cost records found.</div>
              ) : (
                filteredAgents.map((agent) => {
                  const llmPct = agent.total_cost > 0 ? (agent.original_llm_cost / agent.total_cost) * 100 : 0;
                  const evalPct = agent.total_cost > 0 ? (agent.eval_judge_cost / agent.total_cost) * 100 : 0;
                  const consPct = agent.total_cost > 0 ? (agent.consistency_check_cost / agent.total_cost) * 100 : 0;
                  const misPct = agent.total_cost > 0 ? (agent.misunderstanding_cost / agent.total_cost) * 100 : 0;

                  return (
                    <div
                      key={agent.agent_id}
                      className="border border-border bg-paper/50 p-4 text-xs space-y-3 transition-colors hover:bg-paper"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                        <div className="flex items-center gap-3">
                          <Bot size={15} className="text-accent shrink-0" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-ink">{agent.agent_name}</span>
                              <span className="text-[11px] text-inkFaint font-mono">({agent.agent_id})</span>
                              {agent.is_tuning_candidate && (
                                <Badge variant="warn">Tuning Candidate ({agent.eval_overhead_pct}% Overhead)</Badge>
                              )}
                              {agent.misunderstanding_pct > 15 && (
                                <Badge variant="bad">High Loop Waste ({agent.misunderstanding_pct}%)</Badge>
                              )}
                            </div>
                            <span className="text-[11px] text-inkDim">{agent.role}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-right font-mono">
                          <div>
                            <span className="text-[10px] text-inkFaint block uppercase font-sans font-medium">Total Cost</span>
                            <strong className="text-xs text-ink">${agent.total_cost.toFixed(2)}</strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-inkFaint block uppercase font-sans font-medium">Cost / Success</span>
                            <strong className="text-xs text-good">${agent.cost_per_successful_outcome.toFixed(3)}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Stacked Cost Bar */}
                      <div className="h-2 w-full bg-border flex overflow-hidden">
                        {llmPct > 0 && <div style={{ width: `${llmPct}%` }} className="bg-accent h-full" />}
                        {evalPct > 0 && <div style={{ width: `${evalPct}%` }} className="bg-warn h-full" />}
                        {consPct > 0 && <div style={{ width: `${consPct}%` }} className="bg-inkDim h-full" />}
                        {misPct > 0 && <div style={{ width: `${misPct}%` }} className="bg-bad h-full" />}
                      </div>

                      {/* Metric Columns */}
                      <div className="grid gap-2 sm:grid-cols-5 font-mono text-xs">
                        <div className="border border-border bg-surface p-2">
                          <span className="text-[10px] text-inkFaint uppercase block font-sans font-medium">LLM Inference</span>
                          <p className="text-ink font-bold mt-0.5">${agent.original_llm_cost.toFixed(2)}</p>
                          <span className="text-[10px] text-inkDim">{llmPct.toFixed(1)}%</span>
                        </div>
                        <div className="border border-border bg-surface p-2">
                          <span className="text-[10px] text-inkFaint uppercase block font-sans font-medium">Judge Calls</span>
                          <p className="text-warn font-bold mt-0.5">${agent.eval_judge_cost.toFixed(2)}</p>
                          <span className="text-[10px] text-inkDim">{evalPct.toFixed(1)}%</span>
                        </div>
                        <div className="border border-border bg-surface p-2">
                          <span className="text-[10px] text-inkFaint uppercase block font-sans font-medium">Consistency</span>
                          <p className="text-inkDim font-bold mt-0.5">${agent.consistency_check_cost.toFixed(2)}</p>
                          <span className="text-[10px] text-inkDim">{consPct.toFixed(1)}%</span>
                        </div>
                        <div className="border border-border bg-surface p-2">
                          <span className="text-[10px] text-bad uppercase block font-sans font-medium">Loop Waste</span>
                          <p className="text-bad font-bold mt-0.5">${agent.misunderstanding_cost.toFixed(2)}</p>
                          <span className="text-[10px] text-bad">{misPct.toFixed(1)}%</span>
                        </div>
                        <div className="border border-border bg-surface p-2">
                          <span className="text-[10px] text-inkFaint uppercase block font-sans font-medium">Success Rate</span>
                          <p className="text-good font-bold mt-0.5">{agent.success_rate_pct}%</p>
                          <span className="text-[10px] text-inkDim">{agent.successful_outcomes}/{agent.total_sessions}</span>
                        </div>
                      </div>

                      {agent.tuning_recommendation && (
                        <div className="border border-warn/40 bg-accentSoft p-2 text-[11px] text-ink font-sans">
                          {agent.tuning_recommendation}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      ) : (
        /* COST OPTIMIZATION ADVISOR TAB */
        <div className="space-y-6">
          {/* Top Hero ROI Banner */}
          <div className="border border-border bg-accentSoft p-6 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <IndianRupee size={20} className="text-good" />
                  <h2 className="font-display text-xl font-bold tracking-tight text-ink">
                    Projected Infrastructure Cost Savings:{" "}
                    <span className="text-good font-mono">
                      ₹{optData?.summary.total_potential_monthly_savings_inr.toLocaleString("en-IN") || "1,45,782"}/mo
                    </span>
                  </h2>
                </div>
                <p className="text-xs text-inkDim max-w-3xl leading-relaxed">
                  Static analysis detected repeated prompt preambles and bloated RAG contexts across your agent fleet. Implementing prompt caching and context pruning directly reduces monthly LLM cloud invoices without altering model intelligence or agent responses.
                </p>
              </div>

              <div className="font-mono text-xs text-inkDim border border-border bg-surface p-2">
                Equivalent: <strong>${optData?.summary.total_potential_monthly_savings_usd.toFixed(2) || "1,745.90"}/mo</strong>
              </div>
            </div>
          </div>

          {/* Single Bordered Flex Container with Internal Dividers (.stat-row) */}
          <StatRow items={optStatItems} />

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border border-border bg-surface p-3 text-xs">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setAdvisorFilter("all")}
                className={`px-3 py-1 text-xs font-mono font-medium transition-colors ${
                  advisorFilter === "all" ? "bg-ink text-paper" : "text-inkDim hover:text-ink"
                }`}
              >
                All Opportunities ({optData?.opportunities.length || 0})
              </button>
              <button
                onClick={() => setAdvisorFilter("prompt_caching")}
                className={`px-3 py-1 text-xs font-mono font-medium transition-colors flex items-center gap-1 ${
                  advisorFilter === "prompt_caching" ? "bg-ink text-paper" : "text-inkDim hover:text-ink"
                }`}
              >
                <Zap size={11} /> Prompt Caching ({optData?.summary.prompt_caching_opportunities_count || 2})
              </button>
              <button
                onClick={() => setAdvisorFilter("context_pruning")}
                className={`px-3 py-1 text-xs font-mono font-medium transition-colors flex items-center gap-1 ${
                  advisorFilter === "context_pruning" ? "bg-ink text-paper" : "text-inkDim hover:text-ink"
                }`}
              >
                <Scissors size={11} /> Context Pruning ({optData?.summary.context_pruning_opportunities_count || 2})
              </button>
            </div>

            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 text-inkFaint" size={13} />
              <input
                type="text"
                placeholder="Search recommendations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-full border border-border bg-paper pl-8 pr-3 text-xs text-ink placeholder-inkFaint focus:border-borderStrong focus:outline-none"
              />
            </div>
          </div>

          {/* Recommendations List */}
          <div className="space-y-4">
            {filteredOpportunities.length === 0 ? (
              <div className="border border-border bg-surface p-8 text-center text-xs text-inkDim">
                No optimization opportunities found matching your search.
              </div>
            ) : (
              filteredOpportunities.map((op, idx) => {
                const isCaching = op.advisor_type === "prompt_caching";

                return (
                  <div
                    key={`${op.agent_id}-${idx}`}
                    className="border border-border bg-surface p-5 space-y-4 transition-colors hover:bg-paper/30"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                      <div className="flex items-center gap-3">
                        {isCaching ? <Zap size={18} className="text-accent" /> : <Scissors size={18} className="text-warn" />}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-ink text-sm">{op.agent_name}</span>
                            <span className="text-[11px] text-inkFaint font-mono">({op.agent_id})</span>
                            <Badge variant={isCaching ? "accent" : "warn"}>
                              {isCaching ? "Prompt Caching Candidate" : "Context Pruning Candidate"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-inkDim font-mono mt-0.5">
                            <span className="capitalize">{op.provider}</span>
                            <span>•</span>
                            <span>{op.model}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right font-mono">
                        <div className="flex items-center justify-end gap-1 text-good font-bold text-base">
                          <IndianRupee size={15} />
                          {op.estimated_monthly_savings_inr.toLocaleString("en-IN")}/mo
                        </div>
                        <span className="text-[10px] text-inkDim block">
                          ${op.estimated_monthly_savings_usd.toFixed(2)}/mo (-{op.estimated_cost_reduction_pct}% cost)
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-xs font-bold text-ink">{op.headline}</h3>
                      <p className="text-xs text-inkDim leading-relaxed">{op.detail}</p>
                    </div>

                    {/* Metric Tiles */}
                    <div className="grid gap-2 sm:grid-cols-4 text-xs font-mono">
                      {isCaching ? (
                        <>
                          <div className="border border-border bg-paper p-2">
                            <span className="text-[10px] text-inkFaint uppercase block font-sans font-medium">Repeated Prompt %</span>
                            <strong className="text-ink">{op.repeated_prompt_pct}% of calls</strong>
                          </div>
                          <div className="border border-border bg-paper p-2">
                            <span className="text-[10px] text-inkFaint uppercase block font-sans font-medium">Static Tokens</span>
                            <strong className="text-ink">{op.static_token_count.toLocaleString()} tokens</strong>
                          </div>
                          <div className="border border-border bg-paper p-2">
                            <span className="text-[10px] text-inkFaint uppercase block font-sans font-medium">Cache Discount</span>
                            <strong className="text-good">{op.provider === "anthropic" ? "90% off" : "50% off"}</strong>
                          </div>
                          <div className="border border-border bg-paper p-2">
                            <span className="text-[10px] text-inkFaint uppercase block font-sans font-medium">Monthly Volume</span>
                            <strong className="text-ink">{op.estimated_monthly_calls.toLocaleString()} calls</strong>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="border border-border bg-paper p-2">
                            <span className="text-[10px] text-inkFaint uppercase block font-sans font-medium">Input:Output Ratio</span>
                            <strong className="text-warn">{op.input_to_output_ratio}:1</strong>
                          </div>
                          <div className="border border-border bg-paper p-2">
                            <span className="text-[10px] text-inkFaint uppercase block font-sans font-medium">Avg. Input Tokens</span>
                            <strong className="text-ink">{op.avg_input_tokens.toLocaleString()} tokens</strong>
                          </div>
                          <div className="border border-border bg-paper p-2">
                            <span className="text-[10px] text-inkFaint uppercase block font-sans font-medium">Avg. Output Tokens</span>
                            <strong className="text-ink">{op.avg_output_tokens} tokens</strong>
                          </div>
                          <div className="border border-border bg-paper p-2">
                            <span className="text-[10px] text-inkFaint uppercase block font-sans font-medium">Trimmable Context</span>
                            <strong className="text-good">~{op.estimated_cost_reduction_pct}% volume</strong>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="border border-border bg-accentSoft p-2.5 text-xs flex items-start gap-2">
                      <CheckCircle2 size={13} className="text-good shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-ink">Action: </span>
                        <span className="text-inkDim">{op.recommended_action}</span>
                      </div>
                    </div>

                    {op.code_example && (
                      <div className="border border-border bg-paper p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono text-inkDim flex items-center gap-1.5">
                            <Code2 size={12} /> Integration Snippet
                          </span>
                          <button
                            onClick={() => handleCopy(op.code_example || "", `${op.agent_id}-${idx}`)}
                            className="text-[10px] text-inkDim hover:text-ink flex items-center gap-1 font-mono transition-colors border border-border bg-surface px-2 py-0.5"
                          >
                            <Copy size={11} />
                            {copiedId === `${op.agent_id}-${idx}` ? "Copied!" : "Copy"}
                          </button>
                        </div>
                        <pre className="overflow-x-auto text-[11px] font-mono text-ink p-2 bg-surface border border-border leading-relaxed">
                          {op.code_example}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
