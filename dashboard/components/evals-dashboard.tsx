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
    return <div className="text-xs font-mono text-inkDim py-4">Loading evaluation scorecards...</div>;
  }

  const passRate = summary?.overall_pass_rate ?? 95.0;

  return (
    <div className="space-y-8">
      {/* Top Level Scorecards */}
      <div className="grid border border-border bg-surface sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
        <div className="p-4 space-y-1">
          <div className="flex items-center justify-between text-xs font-mono text-inkDim">
            <span>TOTAL EVALUATIONS</span>
            <Sparkles size={16} className="text-accent" />
          </div>
          <p className="text-2xl font-bold font-mono text-ink">{(summary?.total_evaluations ?? scores.length).toLocaleString()}</p>
          <p className="text-[10px] text-inkFaint font-mono">Automated, rule, & human judges</p>
        </div>

        <div className="p-4 space-y-1">
          <div className="flex items-center justify-between text-xs font-mono text-inkDim">
            <span>QUALITY PASS RATE</span>
            <CheckCircle2 size={16} className="text-good" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-good">{passRate}%</span>
            <span className="text-xs text-inkDim font-mono">threshold ≥ 0.70</span>
          </div>
          <div className="h-1.5 w-full bg-paper border border-border overflow-hidden mt-2">
            <div className="h-full bg-good" style={{ width: `${passRate}%` }} />
          </div>
        </div>

        <div className="p-4 space-y-1">
          <div className="flex items-center justify-between text-xs font-mono text-inkDim">
            <span>ACTIVE EVALUATORS</span>
            <Shield size={16} className="text-accent" />
          </div>
          <div className="flex items-center gap-1.5 pt-1">
            <Badge variant="secondary" className="font-mono text-[9px]">LLM Judge</Badge>
            <Badge variant="good" className="font-mono text-[9px]">Groundedness</Badge>
            <Badge variant="accent" className="font-mono text-[9px]">Tool Accuracy</Badge>
          </div>
          <p className="text-[10px] text-inkFaint font-mono mt-1">Sampling 100% of newly ingested spans</p>
        </div>
      </div>

      {/* Evaluator Breakdown Table */}
      <Card className="border border-border bg-surface p-6">
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
          <div>
            <h2 className="text-xs font-bold text-ink uppercase tracking-wider font-mono">Evaluation Dimensions</h2>
            <p className="text-xs text-inkDim mt-0.5">Aggregated quality performance by criteria</p>
          </div>
          <Button onClick={() => setShowCreateRule(!showCreateRule)} variant="primary" className="flex items-center gap-1.5 text-xs h-8 font-mono">
            <Plus size={14} /> New Eval Rule
          </Button>
        </div>

        {showCreateRule && (
          <form onSubmit={handleCreateRule} className="mb-6 border border-border bg-paper p-4 space-y-3">
            <h3 className="text-xs font-bold text-ink uppercase tracking-wider font-mono">Configure Automated Evaluation Rule</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <input
                className="h-8 border border-border bg-surface px-3 text-xs text-ink placeholder-inkFaint focus:border-ink focus:outline-none font-mono"
                placeholder="Rule Name (e.g. Toxicity Check)"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
              />
              <select
                className="h-8 border border-border bg-surface px-3 text-xs text-ink focus:border-ink focus:outline-none font-mono"
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
                className="h-8 border border-border bg-surface px-3 text-xs text-ink focus:border-ink focus:outline-none font-mono"
                value={ruleModel}
                onChange={(e) => setRuleModel(e.target.value)}
              >
                <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                <option value="gpt-4o">gpt-4o</option>
                <option value="claude-3-5-haiku">claude-3-5-haiku</option>
                <option value="rule_engine">Rule / Heuristic Engine</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" onClick={() => setShowCreateRule(false)} variant="outline" className="text-xs h-7 font-mono">Cancel</Button>
              <Button type="submit" variant="primary" className="text-xs h-7 font-mono">Save Rule</Button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="border-b border-border text-inkDim uppercase bg-paper">
              <tr>
                <th className="py-2.5 px-3">Criteria</th>
                <th className="py-2.5 px-3">Judge Type</th>
                <th className="py-2.5 px-3">Total Evals</th>
                <th className="py-2.5 px-3">Average Score</th>
                <th className="py-2.5 px-3">Pass Rate</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(summary?.breakdown || []).map((row) => (
                <tr key={row.score_name} className="hover:bg-paper transition-colors">
                  <td className="py-3 px-3 font-semibold capitalize text-ink flex items-center gap-2">
                    {row.score_name.includes("tool") ? (
                      <Wrench size={14} className="text-accent" />
                    ) : row.score_name.includes("human") ? (
                      <User size={14} className="text-warn" />
                    ) : (
                      <Sparkles size={14} className="text-accent" />
                    )}
                    {row.score_name.replace("_", " ")}
                  </td>
                  <td className="py-3 px-3">
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      {row.evaluator_type}
                    </Badge>
                  </td>
                  <td className="py-3 px-3 text-inkDim">{row.total_count}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-ink">{(row.avg_score * 100).toFixed(0)}/100</span>
                      <div className="h-1.5 w-16 bg-paper border border-border overflow-hidden">
                        <div
                          className={`h-full ${row.avg_score >= 0.9 ? "bg-good" : row.avg_score >= 0.7 ? "bg-accent" : "bg-bad"}`}
                          style={{ width: `${row.avg_score * 100}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 font-bold text-good">{row.pass_rate}%</td>
                  <td className="py-3 px-3">
                    <span className="inline-flex items-center gap-1 text-[11px] text-good font-semibold">
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
      <Card className="border border-border bg-surface p-6">
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
          <div>
            <h2 className="text-xs font-bold text-ink uppercase tracking-wider font-mono">Recent Evaluation Scorecards</h2>
            <p className="text-xs text-inkDim mt-0.5">Individual span quality assertions and judge reasoning</p>
          </div>
          <Button onClick={() => void loadData()} variant="outline" className="flex items-center gap-1 text-xs h-7 font-mono">
            <RefreshCw size={13} /> Refresh
          </Button>
        </div>

        <div className="space-y-3 font-mono">
          {scores.map((s) => (
            <div key={s.id || s.span_id + s.score_name} className="border border-border bg-paper p-3 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-ink capitalize">{s.score_name.replace("_", " ")}</span>
                  <span className="text-inkDim">·</span>
                  <span className="text-inkDim">Span: {s.span_id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={s.score_value >= 0.8 ? "good" : s.score_value >= 0.5 ? "warn" : "bad"}>
                    Score: {(s.score_value * 100).toFixed(0)}%
                  </Badge>
                  <span className="text-[10px] text-inkDim">{new Date(s.created_at).toLocaleTimeString()}</span>
                </div>
              </div>
              {s.reasoning && (
                <p className="text-ink bg-surface p-2 border border-border text-[11px]">
                  <span className="font-bold text-inkDim">Judge Reasoning:</span> {s.reasoning}
                </p>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
