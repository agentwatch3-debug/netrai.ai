"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertOctagon, AlertTriangle, ArrowUpRight, CheckCircle2, HeartPulse, Landmark, Play, PlusCircle, Scale, ShieldAlert, ShieldCheck, Sparkles, ToggleLeft, ToggleRight, Wrench } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Rule {
  id: string;
  name: string;
  pattern_type: string;
  trigger_pattern?: string;
  required_disclaimer?: string;
  pattern?: string;
  action: "block" | "flag" | string;
  message: string;
}

interface PolicyTemplate {
  id: number;
  org_id: string;
  industry: "banking" | "healthcare" | "insurance" | "generic" | string;
  name: string;
  description: string;
  is_active: boolean;
  rules: Rule[];
}

interface PolicyViolation {
  id: number;
  org_id: string;
  agent_id: string;
  trace_id: string;
  span_id: string;
  rule_name: string;
  action_taken: string;
  matched_text: string;
  message: string;
  output_snippet: string;
  detected_at: string;
}

export default function OutputPoliciesPage() {
  const [templates, setTemplates] = useState<PolicyTemplate[]>([]);
  const [violations, setViolations] = useState<PolicyViolation[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // Playground state
  const [testText, setTestText] = useState("We can offer you a personal loan at 8.5% APR immediately.");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  async function loadData() {
    try {
      const [tRes, vRes] = await Promise.all([
        fetch("/api/policies/templates"),
        fetch("/api/policies/violations"),
      ]);
      if (tRes.ok) {
        const body = await tRes.json();
        setTemplates(body.data || []);
      }
      if (vRes.ok) {
        const body = await vRes.json();
        setViolations(body.data || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleToggle(templateId: number) {
    setTogglingId(templateId);
    try {
      const res = await fetch(`/api/policies/templates/${templateId}/toggle`, { method: "POST" });
      if (res.ok) {
        setTemplates((prev) =>
          prev.map((t) => (t.id === templateId ? { ...t, is_active: !t.is_active } : t))
        );
      }
    } finally {
      setTogglingId(null);
    }
  }

  async function handleTestScan() {
    setTesting(true);
    try {
      const res = await fetch("/api/policies/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: testText }),
      });
      if (res.ok) {
        const data = await res.json();
        setTestResult(data);
      }
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-slate-400">Loading Output Regulatory Policies...</div>;
  }

  const activeTemplatesCount = templates.filter((t) => t.is_active).length;
  const totalRulesCount = templates.reduce((acc, t) => acc + (t.rules?.length || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Regulatory Output Policies & Guardrails</h1>
        <p className="text-sm text-slate-400">
          Enforce pre-return compliance guardrails on LLM responses across Banking, Healthcare, and custom industry rules.
        </p>
      </div>

      {/* Hero Metrics */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-slate-800 bg-slate-900/40 p-5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase font-semibold">Active Policy Templates</span>
            <Scale size={16} className="text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-white font-mono pt-1">
            {activeTemplatesCount} <span className="text-xs text-slate-500 font-normal">/ {templates.length} total</span>
          </p>
          <p className="text-[11px] text-slate-500">Live regulatory templates active in SDK perimeter</p>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 p-5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase font-semibold">Enforced Compliance Rules</span>
            <ShieldCheck size={16} className="text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400 font-mono pt-1">{totalRulesCount}</p>
          <p className="text-[11px] text-slate-500">Interest rate disclaimers, medical non-diagnosis, etc.</p>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 p-5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase font-semibold">Total Violations Intercepted</span>
            <AlertOctagon size={16} className="text-red-400" />
          </div>
          <p className="text-2xl font-bold text-red-400 font-mono pt-1">{violations.length}</p>
          <p className="text-[11px] text-slate-500">Blocked before returning to end users</p>
        </Card>
      </div>

      {/* Industry Templates Grid */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
          Industry Guardrail Templates
        </h2>

        <div className="grid gap-4 lg:grid-cols-2">
          {templates.map((template) => {
            const isBanking = template.industry === "banking";

            return (
              <Card
                key={template.id}
                className={`border p-6 space-y-4 transition-all ${
                  template.is_active
                    ? "border-blue-900/50 bg-slate-900/50"
                    : "border-slate-800 bg-slate-950/30 opacity-70"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-950 border border-blue-800/60 text-blue-400">
                      {isBanking ? <Landmark size={18} /> : <HeartPulse size={18} />}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">{template.name}</h3>
                      <span className="font-mono text-[10px] text-slate-400 uppercase">
                        Industry: {template.industry}
                      </span>
                    </div>
                  </div>

                  <Button
                    onClick={() => void handleToggle(template.id)}
                    disabled={togglingId === template.id}
                    className={`h-7 text-xs px-3 font-semibold ${
                      template.is_active
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-400"
                    }`}
                  >
                    {template.is_active ? "Enabled (Active)" : "Disabled"}
                  </Button>
                </div>

                <p className="text-xs text-slate-300">{template.description}</p>

                <div className="space-y-2 pt-1">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">
                    Configured Rules ({template.rules?.length || 0})
                  </span>
                  <div className="space-y-2">
                    {(template.rules || []).map((r) => (
                      <div key={r.id} className="rounded-lg border border-slate-800/80 bg-slate-950 p-3 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-white text-[11px]">{r.name}</span>
                          <Badge
                            className={
                              r.action === "block"
                                ? "bg-red-950 text-red-300 border-red-800 text-[9px] uppercase"
                                : "bg-amber-950 text-amber-300 border-amber-800 text-[9px] uppercase"
                            }
                          >
                            {r.action}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-400">{r.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Live Policy Testing Playground */}
      <Card className="border-slate-800 bg-slate-900/40 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-amber-400" />
            <h2 className="text-sm font-semibold text-white">Live Policy Scanner Playground</h2>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">Simulate LLM Output Inspection</span>
        </div>

        <div className="space-y-3">
          <label className="text-xs font-medium text-slate-300">Test Output Candidate</label>
          <textarea
            rows={3}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-white font-mono focus:border-blue-500 focus:outline-none"
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
          />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={() => setTestText("We can offer you a personal loan at 8.5% APR immediately.")}
                className="h-6 text-[10px] bg-slate-800 text-slate-400 hover:text-white"
              >
                Sample: Banking (No Disclaimer)
              </Button>
              <Button
                type="button"
                onClick={() => setTestText("Based on your headache and fever, you definitely have acute sinusitis.")}
                className="h-6 text-[10px] bg-slate-800 text-slate-400 hover:text-white"
              >
                Sample: Healthcare (Definitive Diagnosis)
              </Button>
            </div>

            <Button
              onClick={() => void handleTestScan()}
              disabled={testing}
              className="bg-blue-600 hover:bg-blue-500 text-xs flex items-center gap-1.5"
            >
              <Play size={12} /> {testing ? "Scanning..." : "Run Policy Scan"}
            </Button>
          </div>

          {testResult && (
            <div
              className={`rounded-lg border p-4 text-xs space-y-2 mt-3 ${
                testResult.is_blocked
                  ? "border-red-500/80 bg-red-950/30"
                  : (testResult.violations || []).length > 0
                  ? "border-amber-500/80 bg-amber-950/30"
                  : "border-emerald-500/80 bg-emerald-950/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">
                  {testResult.is_blocked
                    ? "🚨 BLOCKED — OutputPolicyViolation Raised"
                    : (testResult.violations || []).length > 0
                    ? "⚠️ FLAGGED & LOGGED"
                    : "✅ COMPLIANT — Passed All Enabled Industry Guardrails"}
                </span>
              </div>

              {(testResult.violations || []).map((v: any, idx: number) => (
                <div key={idx} className="rounded bg-slate-950/80 border border-slate-800 p-2 text-[11px] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-red-300">{v.rule_name}</span>
                    <Badge className="bg-red-950 text-red-300 border-red-800 text-[9px]">{v.action}</Badge>
                  </div>
                  <p className="text-slate-300">{v.message}</p>
                  <p className="text-[10px] text-slate-500 font-mono">Matched: &quot;{v.matched_text}&quot;</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Historical Output Policy Violations Table */}
      <Card className="border-slate-800 bg-slate-900/40 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <ShieldAlert size={16} className="text-red-400" /> Recent Output Policy Violations Audit Log
        </h2>

        <div className="space-y-3">
          {violations.length > 0 ? (
            violations.map((v) => (
              <div key={v.id} className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-xs space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-900 pb-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-red-950 text-red-300 border-red-800 font-mono text-[9px]">
                      {v.action_taken.toUpperCase()}
                    </Badge>
                    <span className="font-mono font-bold text-white">{v.rule_name}</span>
                    <span className="text-slate-400">· Agent: <strong>{v.agent_id}</strong></span>
                  </div>

                  <div className="flex items-center gap-3 font-mono text-xs">
                    <span className="text-[11px] text-slate-500">{new Date(v.detected_at).toLocaleString()}</span>
                    {v.trace_id && (
                      <Link href={`/traces/${v.trace_id}`} className="text-blue-400 hover:underline flex items-center gap-0.5 text-[10px]">
                        Inspect Trace <ArrowUpRight size={11} />
                      </Link>
                    )}
                  </div>
                </div>

                <p className="text-xs text-red-300">{v.message}</p>
                <div className="rounded bg-slate-900/80 border border-slate-800/80 p-2.5 font-mono text-[11px] text-slate-300">
                  {v.output_snippet}
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-500 italic py-4 text-center">No output policy violations recorded.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
