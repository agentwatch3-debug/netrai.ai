"use client";

import { useEffect, useState } from "react";
import { AlertOctagon, CheckCircle2, DollarSign, History, RefreshCw, Save, ShieldAlert, ShieldCheck, Zap, ZapOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface CircuitBreakerEvent {
  id: number;
  trigger_type: string;
  cost_at_trigger: number;
  loop_count: number;
  details: Record<string, any>;
  action_taken: string;
  created_at: string;
}

interface CircuitBreakerStatus {
  is_throttled: boolean;
  throttled_reason: string | null;
  throttled_at: string | null;
  max_cost_velocity_5m: number;
  current_cost_velocity_5m: number;
  max_tool_call_loop_count: number;
  emergency_webhook_url: string | null;
  events: CircuitBreakerEvent[];
}

export default function CircuitBreakerPage() {
  const [status, setStatus] = useState<CircuitBreakerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form edit state
  const [maxCost, setMaxCost] = useState("50.0");
  const [maxLoop, setMaxLoop] = useState("30");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  async function loadStatus() {
    try {
      const res = await fetch("/api/circuit-breaker/status");
      if (res.ok) {
        const data: CircuitBreakerStatus = await res.json();
        setStatus(data);
        setMaxCost(String(data.max_cost_velocity_5m || 50.0));
        setMaxLoop(String(data.max_tool_call_loop_count || 30));
        setWebhookUrl(data.emergency_webhook_url || "");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  async function handleReset() {
    setResetting(true);
    try {
      const res = await fetch("/api/circuit-breaker/reset", { method: "POST" });
      if (res.ok) {
        await loadStatus();
      }
    } finally {
      setResetting(false);
    }
  }

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch("/api/circuit-breaker/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          max_cost_velocity_5m: parseFloat(maxCost),
          max_tool_call_loop_count: parseInt(maxLoop, 10),
          emergency_webhook_url: webhookUrl || null,
        }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        await loadStatus();
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-slate-400">Loading Circuit Breaker status...</div>;
  }

  const isThrottled = status?.is_throttled;
  const currentBurn = status?.current_cost_velocity_5m || 0;
  const maxBurn = status?.max_cost_velocity_5m || 50;
  const burnPercent = Math.min(Math.round((currentBurn / maxBurn) * 100), 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Automated Cost Runaway Circuit Breaker</h1>
        <p className="text-sm text-slate-400">
          Real-time runaway cost detection, infinite tool loop kill-switch, emergency webhooks, and automatic throttling.
        </p>
      </div>

      {/* Main Status Hero Banner */}
      {isThrottled ? (
        <div className="rounded-xl border border-red-500/80 bg-red-950/40 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-600 text-white">
                <AlertOctagon size={28} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white">CIRCUIT BREAKER TRIPPED — ORG THROTTLED</h2>
                  <Badge className="bg-red-900 text-red-200 border-red-700 text-xs">HTTP 429 Active</Badge>
                </div>
                <p className="text-xs text-red-200 mt-1">
                  Reason: <strong>{status?.throttled_reason || "Runaway cost spike exceeded safety threshold"}</strong>
                </p>
                {status?.throttled_at && (
                  <p className="text-[11px] text-red-300/80 font-mono mt-0.5">
                    Tripped At: {new Date(status.throttled_at).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            <Button
              onClick={() => void handleReset()}
              disabled={resetting}
              className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs h-10 px-5 flex items-center gap-2"
            >
              <RefreshCw size={15} className={resetting ? "animate-spin" : ""} />
              {resetting ? "Resetting..." : "Reset Circuit Breaker & Resume Traffic"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-400">
                <ShieldCheck size={28} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white">Circuit Breaker Armed & Monitoring</h2>
                  <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800 text-[10px]">Normal (Active Guard)</Badge>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Continuously inspecting 5-minute spend velocity and infinite loop patterns across all agent spans.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6 font-mono text-xs">
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block uppercase">5-Min Burn Velocity</span>
                <span className="text-base font-bold text-emerald-400">${currentBurn.toFixed(2)}</span>
                <span className="text-slate-500 text-[11px]"> / ${maxBurn.toFixed(2)} limit</span>
              </div>
              <div className="w-32 space-y-1">
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full transition-all ${burnPercent > 75 ? "bg-red-500" : burnPercent > 40 ? "bg-amber-500" : "bg-emerald-500"}`}
                    style={{ width: `${Math.max(burnPercent, 5)}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-500 text-right">{burnPercent}% of limit</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings & Configuration Form */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-6">
          <Card className="border-slate-800 bg-slate-900/40 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Zap size={16} className="text-amber-400" /> Threshold & Trigger Settings
              </h2>
              {saveSuccess && <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 size={12} /> Saved</span>}
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                  <span>5-Minute Cost Runaway Limit ($ USD)</span>
                  <span className="text-[11px] text-slate-500 font-mono">Default: $50.00</span>
                </label>
                <div className="relative">
                  <DollarSign size={14} className="absolute left-3 top-3 text-slate-500" />
                  <input
                    type="number"
                    step="1"
                    min="1"
                    className="w-full h-9 rounded-lg border border-slate-800 bg-slate-950 pl-8 pr-3 text-xs text-white focus:border-blue-500 focus:outline-none"
                    value={maxCost}
                    onChange={(e) => setMaxCost(e.target.value)}
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  If total span spend across all agents exceeds this amount within any 5-minute rolling window, the circuit breaker automatically throttles the org.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                  <span>Max Consecutive Tool Calls in Single Trace</span>
                  <span className="text-[11px] text-slate-500 font-mono">Default: 30 calls</span>
                </label>
                <input
                  type="number"
                  step="1"
                  min="5"
                  className="w-full h-9 rounded-lg border border-slate-800 bg-slate-950 px-3 text-xs text-white focus:border-blue-500 focus:outline-none"
                  value={maxLoop}
                  onChange={(e) => setMaxLoop(e.target.value)}
                  required
                />
                <p className="text-[11px] text-slate-500">
                  Prevents infinite recursive agent loops (e.g. an agent endlessly re-executing search tools).
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Emergency Alert Webhook URL (Slack / PagerDuty)
                </label>
                <input
                  type="url"
                  className="w-full h-9 rounded-lg border border-slate-800 bg-slate-950 px-3 text-xs text-white font-mono placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                  placeholder="https://hooks.slack.com/services/..."
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                />
                <p className="text-[11px] text-slate-500">
                  An immediate high-priority alert payload is dispatched to this endpoint the millisecond the breaker trips.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-500 text-xs flex items-center gap-1.5">
                  <Save size={14} /> {saving ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </form>
          </Card>
        </div>

        {/* Incident Audit Log Table */}
        <div className="space-y-6 lg:col-span-6">
          <Card className="border-slate-800 bg-slate-900/40 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <History size={16} className="text-slate-400" /> Circuit Breaker Incident Audit Log
            </h2>

            <div className="space-y-3">
              {(status?.events || []).length > 0 ? (
                (status?.events || []).map((ev) => (
                  <div key={ev.id} className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-red-950 text-red-300 border-red-800 font-mono text-[9px]">
                          {ev.trigger_type}
                        </Badge>
                        <span className="font-bold text-white font-mono text-[11px]">
                          {ev.cost_at_trigger ? `$${Number(ev.cost_at_trigger).toFixed(2)} in 5m` : `${ev.loop_count} tool calls`}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(ev.created_at).toLocaleString()}
                      </span>
                    </div>
                    {ev.details?.reason && (
                      <p className="text-[11px] text-slate-400">{ev.details.reason}</p>
                    )}
                    <div className="text-[10px] text-slate-500 flex items-center gap-2 border-t border-slate-900 pt-1">
                      <span>Action: <strong>{ev.action_taken}</strong></span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 italic py-4 text-center">No circuit breaker incidents recorded.</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
