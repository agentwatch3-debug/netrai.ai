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
    return <div className="text-xs font-mono text-inkDim py-4">Loading Circuit Breaker status...</div>;
  }

  const isThrottled = status?.is_throttled;
  const currentBurn = status?.current_cost_velocity_5m || 0;
  const maxBurn = status?.max_cost_velocity_5m || 50;
  const burnPercent = Math.min(Math.round((currentBurn / maxBurn) * 100), 100);

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Automated Cost Runaway Circuit Breaker</h1>
        <p className="mt-1 text-xs text-inkDim">
          Real-time runaway cost detection, infinite tool loop kill-switch, emergency webhooks, and automatic throttling.
        </p>
      </div>

      {/* Main Status Hero Banner */}
      {isThrottled ? (
        <div className="border border-bad bg-bad/10 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center border border-bad bg-bad text-paper">
                <AlertOctagon size={28} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-bad font-mono">CIRCUIT BREAKER TRIPPED — ORG THROTTLED</h2>
                  <Badge variant="bad" className="text-xs font-mono">HTTP 429 Active</Badge>
                </div>
                <p className="text-xs text-ink mt-1">
                  Reason: <strong>{status?.throttled_reason || "Runaway cost spike exceeded safety threshold"}</strong>
                </p>
                {status?.throttled_at && (
                  <p className="text-[11px] text-inkDim font-mono mt-0.5">
                    Tripped At: {new Date(status.throttled_at).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            <Button
              onClick={() => void handleReset()}
              disabled={resetting}
              variant="destructive"
              className="font-bold text-xs h-9 px-4 flex items-center gap-2 font-mono"
            >
              <RefreshCw size={14} className={resetting ? "animate-spin" : ""} />
              {resetting ? "Resetting..." : "Reset Circuit Breaker & Resume Traffic"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="border border-good/40 bg-good/5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center border border-good bg-good/10 text-good">
                <ShieldCheck size={28} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-ink">Circuit Breaker Armed & Monitoring</h2>
                  <Badge variant="good" className="text-[10px] font-mono">Normal (Active Guard)</Badge>
                </div>
                <p className="text-xs text-inkDim mt-0.5">
                  Continuously inspecting 5-minute spend velocity and infinite loop patterns across all agent spans.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6 font-mono text-xs">
              <div className="text-right">
                <span className="text-[10px] text-inkDim block uppercase">5-Min Burn Velocity</span>
                <span className="text-base font-bold text-good">${currentBurn.toFixed(2)}</span>
                <span className="text-inkFaint text-[11px]"> / ${maxBurn.toFixed(2)} limit</span>
              </div>
              <div className="w-32 space-y-1">
                <div className="h-2 bg-paper border border-border overflow-hidden">
                  <div
                    className={`h-full transition-all ${burnPercent > 75 ? "bg-bad" : burnPercent > 40 ? "bg-warn" : "bg-good"}`}
                    style={{ width: `${Math.max(burnPercent, 5)}%` }}
                  />
                </div>
                <div className="text-[10px] text-inkDim text-right">{burnPercent}% of limit</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings & Configuration Form */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-6">
          <Card className="border border-border bg-surface p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-2 font-mono">
                <Zap size={16} className="text-accent" /> Threshold & Trigger Settings
              </h2>
              {saveSuccess && <span className="text-xs text-good flex items-center gap-1 font-mono"><CheckCircle2 size={12} /> Saved</span>}
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4 text-xs font-mono">
              <div className="space-y-1">
                <label className="font-semibold text-inkDim flex items-center justify-between">
                  <span>5-Minute Cost Runaway Limit ($ USD)</span>
                  <span className="text-[10px] text-inkFaint">Default: $50.00</span>
                </label>
                <div className="relative">
                  <DollarSign size={14} className="absolute left-3 top-2.5 text-inkDim" />
                  <input
                    type="number"
                    step="1"
                    min="1"
                    className="w-full h-8 border border-border bg-surface pl-8 pr-3 text-xs text-ink placeholder-inkFaint focus:border-ink focus:outline-none font-mono"
                    value={maxCost}
                    onChange={(e) => setMaxCost(e.target.value)}
                    required
                  />
                </div>
                <p className="text-[10px] text-inkDim">
                  If total span spend across all agents exceeds this amount within any 5-minute rolling window, the circuit breaker automatically throttles the org.
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-inkDim flex items-center justify-between">
                  <span>Max Consecutive Tool Calls in Single Trace</span>
                  <span className="text-[10px] text-inkFaint">Default: 30 calls</span>
                </label>
                <input
                  type="number"
                  step="1"
                  min="5"
                  className="w-full h-8 border border-border bg-surface px-3 text-xs text-ink placeholder-inkFaint focus:border-ink focus:outline-none font-mono"
                  value={maxLoop}
                  onChange={(e) => setMaxLoop(e.target.value)}
                  required
                />
                <p className="text-[10px] text-inkDim">
                  Prevents infinite recursive agent loops (e.g. an agent endlessly re-executing search tools).
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-inkDim">
                  Emergency Alert Webhook URL (Slack / PagerDuty)
                </label>
                <input
                  type="url"
                  className="w-full h-8 border border-border bg-surface px-3 text-xs text-ink font-mono placeholder-inkFaint focus:border-ink focus:outline-none"
                  placeholder="https://hooks.slack.com/services/..."
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                />
                <p className="text-[10px] text-inkDim">
                  An immediate alert payload is dispatched to this endpoint the millisecond the breaker trips.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={saving} variant="primary" className="text-xs h-8 flex items-center gap-1.5 font-mono">
                  <Save size={14} /> {saving ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </form>
          </Card>
        </div>

        {/* Incident Audit Log Table */}
        <div className="space-y-6 lg:col-span-6">
          <Card className="border border-border bg-surface p-6 space-y-4">
            <h2 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-2 border-b border-border pb-3 font-mono">
              <History size={16} className="text-accent" /> Circuit Breaker Incident Audit Log
            </h2>

            <div className="space-y-3">
              {(status?.events || []).length > 0 ? (
                (status?.events || []).map((ev) => (
                  <div key={ev.id} className="border border-border bg-paper p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="bad" className="font-mono text-[9px]">
                          {ev.trigger_type}
                        </Badge>
                        <span className="font-bold text-ink font-mono text-[11px]">
                          {ev.cost_at_trigger ? `$${Number(ev.cost_at_trigger).toFixed(2)} in 5m` : `${ev.loop_count} tool calls`}
                        </span>
                      </div>
                      <span className="text-[10px] text-inkDim font-mono">
                        {new Date(ev.created_at).toLocaleString()}
                      </span>
                    </div>
                    {ev.details?.reason && (
                      <p className="text-[11px] text-inkDim font-mono">{ev.details.reason}</p>
                    )}
                    <div className="text-[10px] text-inkDim flex items-center gap-2 border-t border-border pt-1 font-mono">
                      <span>Action: <strong className="text-ink">{ev.action_taken}</strong></span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-inkDim italic py-4 text-center font-mono">No circuit breaker incidents recorded.</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
