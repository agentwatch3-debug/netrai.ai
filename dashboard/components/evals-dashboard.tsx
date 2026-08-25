"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Shield, Sparkles, User, Wrench, Plus, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EvalScore, EvalSummary } from "@/lib/types";

export function EvalsDashboard() {
  const [summary, setSummary] = useState<EvalSummary | null>(null);
  const [scores, setScores] = useState<EvalScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateRule, setShowCreateRule] = useState(false);
  const [ruleName, setRuleName] = useState("");
  const [ruleType, setRuleType] = useState("hallucination");
  const [ruleModel, setRuleModel] = useState("gpt-4.1-mini");

  async function loadData() {
    try {
      const [sumRes, scoresRes] = await Promise.all([
        fetch("/api/evals/summary"),
        fetch("/api/evals/scores"),
      ]);
      if (sumRes.ok) setSummary(await sumRes.json());
      if (scoresRes.ok) setScores(await scoresRes.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleCreateRule(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/evals/configs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: ruleName || `${ruleType.replace("_", " ")} Eval`,
        eval_type: ruleType,
        model: ruleModel,
        sampling_rate: 1.0,
      }),
    });
    if (res.ok) {
      setShowCreateRule(false);
      setRuleName("");
      void loadData();
    }
  }

  if (loading) {
    return <div className="text-sm text-slate-400">Loading evaluation scorecards...</div>;
  }

  const passRate = summary?.overall_pass_rate ?? 95.0;

  return (
    <div className="space-y-8">
      {/* Top Level Scorecards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-800 bg-slate-900/50 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Total Evaluations</span>
            <Sparkles size={16} className="text-blue-400" />
          </div>
          <p className="mt-3 text-3xl font-bold text-white">{(summary?.total_evaluations ?? scores.length).toLocaleString()}</p>
          <p className="mt-1 text-xs text-slate-400">Across automated, rule, & human judges</p>
        </Card>

        <Card className="border-slate-800 bg-slate-900/50 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Overall Quality Pass Rate</span>
            <CheckCircle2 size={16} className="text-emerald-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-emerald-400">{passRate}%</span>
            <span className="text-xs text-slate-400">threshold ≥ 0.70</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div className="h-full bg-emerald-500" style={{ width: `${passRate}%` }} />
          </div>
        </Card>

        <Card className="border-slate-800 bg-slate-900/50 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Active Evaluators</span>
            <Shield size={16} className="text-purple-400" />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Badge className="bg-blue-950 text-blue-300">LLM Judge</Badge>
            <Badge className="bg-emerald-950 text-emerald-300">Groundedness</Badge>
            <Badge className="bg-purple-950 text-purple-300">Tool Accuracy</Badge>
          </div>
          <p className="mt-3 text-xs text-slate-400">Sampling 100% of newly ingested spans</p>
        </Card>
      </div>

      {/* Evaluator Breakdown Table */}
      <Card className="border-slate-800 bg-slate-900/40 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Evaluation Dimensions</h2>
            <p className="text-xs text-slate-400">Aggregated quality performance by criteria</p>
          </div>
          <Button onClick={() => setShowCreateRule(!showCreateRule)} className="flex items-center gap-1.5 bg-blue-600 text-xs hover:bg-blue-500">
            <Plus size={14} /> New Eval Rule
          </Button>
        </div>

        {showCreateRule && (
          <form onSubmit={handleCreateRule} className="mb-6 rounded-lg border border-blue-900/60 bg-slate-950/80 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-blue-300">Configure Automated Evaluation Rule</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <input
                className="h-9 rounded border border-slate-800 bg-slate-900 px-3 text-xs text-white"
                placeholder="Rule Name (e.g. Toxicity Check)"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
              />
              <select
                className="h-9 rounded border border-slate-800 bg-slate-900 px-3 text-xs text-white"
                value={ruleType}
                onChange={(e) => setRuleType(e.target.value)}
              >
                <option value="hallucination">Hallucination / Groundedness</option>
                <option value="relevancy">Answer Relevancy</option>
                <option value="tool_correctness">Tool Call Correctness</option>
                <option value="json_validity">JSON Schema Validity</option>
                <option value="llm_judge">Custom LLM Judge</option>
              </select>
              <select
                className="h-9 rounded border border-slate-800 bg-slate-900 px-3 text-xs text-white"
                value={ruleModel}
                onChange={(e) => setRuleModel(e.target.value)}
              >
                <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                <option value="gpt-4o">gpt-4o</option>
                <option value="claude-3-5-haiku">claude-3-5-haiku</option>
                <option value="rule_engine">Rule / Heuristic Engine</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" onClick={() => setShowCreateRule(false)} className="bg-slate-800 text-xs">Cancel</Button>
              <Button type="submit" className="bg-blue-600 text-xs hover:bg-blue-500">Save Rule</Button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 text-slate-400 uppercase">
              <tr>
                <th className="py-2.5 px-3">Criteria</th>
                <th>Judge Type</th>
                <th>Total Evals</th>
                <th>Average Score</th>
                <th>Pass Rate</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {(summary?.breakdown || []).map((row) => (
                <tr key={row.score_name} className="hover:bg-slate-800/30">
                  <td className="py-3 px-3 font-medium capitalize text-white flex items-center gap-2">
                    {row.score_name.includes("tool") ? (
                      <Wrench size={14} className="text-purple-400" />
                    ) : row.score_name.includes("human") ? (
                      <User size={14} className="text-amber-400" />
                    ) : (
                      <Sparkles size={14} className="text-blue-400" />
                    )}
                    {row.score_name.replace("_", " ")}
                  </td>
                  <td>
                    <Badge className="bg-slate-800 text-slate-300 font-mono text-[10px]">
                      {row.evaluator_type}
                    </Badge>
                  </td>
                  <td className="text-slate-300">{row.total_count}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{(row.avg_score * 100).toFixed(0)}/100</span>
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className={`h-full ${row.avg_score >= 0.9 ? "bg-emerald-500" : row.avg_score >= 0.7 ? "bg-blue-500" : "bg-red-500"}`}
                          style={{ width: `${row.avg_score * 100}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="font-medium text-emerald-400">{row.pass_rate}%</td>
                  <td>
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                      <CheckCircle2 size={12} /> Healthy
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Recent Evaluation Log */}
      <Card className="border-slate-800 bg-slate-900/40 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Recent Evaluation Scorecards</h2>
            <p className="text-xs text-slate-400">Individual span quality assertions and judge reasoning</p>
          </div>
          <Button onClick={() => void loadData()} className="flex items-center gap-1 bg-slate-800 text-xs text-slate-300 hover:bg-slate-700">
            <RefreshCw size={13} /> Refresh
          </Button>
        </div>

        <div className="space-y-3">
          {scores.map((s) => (
            <div key={s.id || s.span_id + s.score_name} className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-3 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono">
                  <span className="font-semibold text-white capitalize">{s.score_name.replace("_", " ")}</span>
                  <span className="text-slate-500">·</span>
                  <span className="text-slate-400">Span: {s.span_id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={s.score_value >= 0.8 ? "bg-emerald-950 text-emerald-300" : s.score_value >= 0.5 ? "bg-amber-950 text-amber-300" : "bg-red-950 text-red-300"}>
                    Score: {(s.score_value * 100).toFixed(0)}%
                  </Badge>
                  <span className="text-[10px] text-slate-500">{new Date(s.created_at).toLocaleTimeString()}</span>
                </div>
              </div>
              {s.reasoning && (
                <p className="text-slate-300 bg-slate-900/70 p-2 rounded border border-slate-800/50">
                  <span className="font-semibold text-slate-400">Judge Reasoning:</span> {s.reasoning}
                </p>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
