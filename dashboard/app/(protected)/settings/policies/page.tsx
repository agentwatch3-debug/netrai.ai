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
    return <div className="text-xs font-mono text-inkDim py-4">Loading Output Regulatory Policies...</div>;
  }

  const activeTemplatesCount = templates.filter((t) => t.is_active).length;
  const totalRulesCount = templates.reduce((acc, t) => acc + (t.rules?.length || 0), 0);

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Regulatory Output Policies & Guardrails</h1>
        <p className="mt-1 text-xs text-inkDim">
          Enforce pre-return compliance guardrails on LLM responses across Banking, Healthcare, and custom industry rules.
        </p>
      </div>

      {/* Hero Metrics Strip */}
      <div className="grid border border-border bg-surface sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
        <div className="p-4 space-y-1">
          <div className="flex items-center justify-between text-inkDim text-xs font-mono">
            <span>ACTIVE POLICY TEMPLATES</span>
            <Scale size={16} className="text-accent" />
          </div>
          <p className="text-2xl font-bold text-ink font-mono pt-1">
            {activeTemplatesCount} <span className="text-xs text-inkDim font-normal">/ {templates.length} total</span>
          </p>
          <p className="text-[10px] text-inkFaint font-mono">Live regulatory templates active in SDK perimeter</p>
        </div>

        <div className="p-4 space-y-1">
          <div className="flex items-center justify-between text-inkDim text-xs font-mono">
            <span>ENFORCED RULES</span>
            <ShieldCheck size={16} className="text-good" />
          </div>
          <p className="text-2xl font-bold text-good font-mono pt-1">{totalRulesCount}</p>
          <p className="text-[10px] text-inkFaint font-mono">Interest disclaimers, medical non-diagnosis, etc.</p>
        </div>

        <div className="p-4 space-y-1">
          <div className="flex items-center justify-between text-inkDim text-xs font-mono">
            <span>INTERCEPTED VIOLATIONS</span>
            <AlertOctagon size={16} className="text-bad" />
          </div>
          <p className="text-2xl font-bold text-bad font-mono pt-1">{violations.length}</p>
          <p className="text-[10px] text-inkFaint font-mono">Blocked before returning to end users</p>
        </div>
      </div>

      {/* Industry Templates Grid */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold text-ink uppercase tracking-wider font-mono">
          Industry Guardrail Templates
        </h2>

        <div className="grid gap-4 lg:grid-cols-2">
          {templates.map((template) => {
            const isBanking = template.industry === "banking";

            return (
              <Card
                key={template.id}
                className={`border p-5 space-y-4 transition-colors ${
                  template.is_active
                    ? "border-borderStrong bg-surface"
                    : "border-border bg-paper opacity-80"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center border border-border bg-paper text-accent">
                      {isBanking ? <Landmark size={18} /> : <HeartPulse size={18} />}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-ink">{template.name}</h3>
                      <span className="font-mono text-[10px] text-inkDim uppercase">
                        Industry: {template.industry}
                      </span>
                    </div>
                  </div>

                  <Button
                    onClick={() => void handleToggle(template.id)}
                    disabled={togglingId === template.id}
                    variant={template.is_active ? "primary" : "outline"}
                    className="h-7 text-xs px-3 font-mono font-semibold"
                  >
                    {template.is_active ? "Enabled" : "Disabled"}
                  </Button>
                </div>

                <p className="text-xs text-inkDim">{template.description}</p>

                <div className="space-y-2 pt-1">
                  <span className="text-[11px] font-mono font-bold text-inkDim uppercase">
                    Configured Rules ({template.rules?.length || 0})
                  </span>
                  <div className="space-y-2">
                    {(template.rules || []).map((r) => (
                      <div key={r.id} className="border border-border bg-paper p-3 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-ink text-[11px]">{r.name}</span>
                          <Badge
                            variant={r.action === "block" ? "bad" : "warn"}
                            className="text-[9px] uppercase font-mono"
                          >
                            {r.action}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-inkDim">{r.message}</p>
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
      <Card className="border border-border bg-surface p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-accent" />
            <h2 className="text-xs font-bold text-ink uppercase tracking-wider font-mono">Live Policy Scanner Playground</h2>
          </div>
          <span className="text-[11px] text-inkDim font-mono">Simulate LLM Output Inspection</span>
        </div>

        <div className="space-y-3">
          <label className="text-xs font-mono font-medium text-inkDim">Test Output Candidate</label>
          <textarea
            rows={3}
            className="w-full border border-border bg-paper p-3 text-xs text-ink font-mono placeholder-inkFaint focus:border-ink focus:outline-none"
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={() => setTestText("We can offer you a personal loan at 8.5% APR immediately.")}
                variant="outline"
                className="h-6 text-[10px] font-mono"
              >
                Sample: Banking (No Disclaimer)
              </Button>
              <Button
                type="button"
                onClick={() => setTestText("Based on your headache and fever, you definitely have acute sinusitis.")}
                variant="outline"
                className="h-6 text-[10px] font-mono"
              >
                Sample: Healthcare (Definitive Diagnosis)
              </Button>
            </div>

            <Button
              onClick={() => void handleTestScan()}
              disabled={testing}
              variant="primary"
              className="text-xs h-7 flex items-center gap-1.5 font-mono"
            >
              <Play size={12} /> {testing ? "Scanning..." : "Run Policy Scan"}
            </Button>
          </div>

          {testResult && (
            <div
              className={`border p-4 text-xs space-y-2 mt-3 ${
                testResult.is_blocked
                  ? "border-bad bg-bad/10"
                  : (testResult.violations || []).length > 0
                  ? "border-warn bg-warn/10"
                  : "border-good bg-good/10"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-ink font-mono">
                  {testResult.is_blocked
                    ? "🚨 BLOCKED — OutputPolicyViolation Raised"
                    : (testResult.violations || []).length > 0
                    ? "⚠️ FLAGGED & LOGGED"
                    : "✅ COMPLIANT — Passed All Enabled Industry Guardrails"}
                </span>
              </div>

              {(testResult.violations || []).map((v: any, idx: number) => (
                <div key={idx} className="bg-surface border border-border p-2.5 text-[11px] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-bad">{v.rule_name}</span>
                    <Badge variant="bad" className="text-[9px] font-mono">{v.action}</Badge>
                  </div>
                  <p className="text-inkDim">{v.message}</p>
                  <p className="text-[10px] text-inkFaint font-mono">Matched: &quot;{v.matched_text}&quot;</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Historical Output Policy Violations Table */}
      <Card className="border border-border bg-surface p-6 space-y-4">
        <h2 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-2 border-b border-border pb-3 font-mono">
          <ShieldAlert size={16} className="text-bad" /> Recent Output Policy Violations Audit Log
        </h2>

        <div className="space-y-3">
          {violations.length > 0 ? (
            violations.map((v) => (
              <div key={v.id} className="border border-border bg-paper p-4 text-xs space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="bad" className="font-mono text-[9px]">
                      {v.action_taken.toUpperCase()}
                    </Badge>
                    <span className="font-mono font-bold text-ink">{v.rule_name}</span>
                    <span className="text-inkDim font-mono">· Agent: <strong>{v.agent_id}</strong></span>
                  </div>

                  <div className="flex items-center gap-3 font-mono text-xs">
                    <span className="text-[11px] text-inkDim">{new Date(v.detected_at).toLocaleString()}</span>
                    {v.trace_id && (
                      <Link href={`/traces/${v.trace_id}`} className="text-accent hover:underline flex items-center gap-0.5 text-[10px]">
                        Inspect Trace <ArrowUpRight size={11} />
                      </Link>
                    )}
                  </div>
                </div>

                <p className="text-xs text-bad font-mono">{v.message}</p>
                <div className="border border-border bg-surface p-2.5 font-mono text-[11px] text-ink">
                  {v.output_snippet}
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-inkDim italic py-4 text-center font-mono">No output policy violations recorded.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
