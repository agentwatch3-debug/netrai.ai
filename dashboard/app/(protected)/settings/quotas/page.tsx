"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Ban, CheckCircle2, ChevronRight, DollarSign, Edit3, Gauge, Plus, RefreshCw, Save, ShieldAlert, ShieldCheck, Sparkles, UserCheck, Users, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface UserQuotaConfig {
  id: number;
  org_id: string;
  end_user_id: string | null;
  max_requests_per_day: number;
  max_cost_per_day: number;
  is_blocked: boolean;
  created_at: string;
  updated_at: string;
}

interface TopEndUser {
  end_user_id: string;
  total_requests: number;
  total_cost_usd: number;
  avg_latency_ms: number;
  error_count: number;
  max_requests: number;
  max_cost: number;
  utilization_pct: number;
  is_blocked: boolean;
}

export default function UserQuotasPage() {
  const [configs, setConfigs] = useState<UserQuotaConfig[]>([]);
  const [topUsers, setTopUsers] = useState<TopEndUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingDefault, setSavingDefault] = useState(false);

  // Form states for Default Quota
  const [defaultRequests, setDefaultRequests] = useState(1000);
  const [defaultCost, setDefaultCost] = useState(5.0);

  // Form states for adding custom override
  const [newUserId, setNewUserId] = useState("");
  const [newMaxRequests, setNewMaxRequests] = useState(5000);
  const [newMaxCost, setNewMaxCost] = useState(25.0);
  const [addingOverride, setAddingOverride] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [cRes, uRes] = await Promise.all([
        fetch("/api/quotas/configs"),
        fetch("/api/quotas/top-users"),
      ]);
      if (cRes.ok) {
        const body = await cRes.json();
        const list: UserQuotaConfig[] = body.data || [];
        setConfigs(list);
        const def = list.find((c) => c.end_user_id === null);
        if (def) {
          setDefaultRequests(def.max_requests_per_day);
          setDefaultCost(Number(def.max_cost_per_day));
        }
      }
      if (uRes.ok) {
        const body = await uRes.json();
        setTopUsers(body.data || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function saveDefaultQuota() {
    setSavingDefault(true);
    try {
      await fetch("/api/quotas/configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          end_user_id: null,
          max_requests_per_day: Number(defaultRequests),
          max_cost_per_day: Number(defaultCost),
          is_blocked: false,
        }),
      });
      await loadData();
    } finally {
      setSavingDefault(false);
    }
  }

  async function handleAddOverride(e: React.FormEvent) {
    e.preventDefault();
    if (!newUserId.trim()) return;
    setAddingOverride(true);
    try {
      await fetch("/api/quotas/configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          end_user_id: newUserId.trim(),
          max_requests_per_day: Number(newMaxRequests),
          max_cost_per_day: Number(newMaxCost),
          is_blocked: false,
        }),
      });
      setNewUserId("");
      await loadData();
    } finally {
      setAddingOverride(false);
    }
  }

  async function toggleBlockUser(config: UserQuotaConfig) {
    await fetch("/api/quotas/configs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        end_user_id: config.end_user_id,
        max_requests_per_day: config.max_requests_per_day,
        max_cost_per_day: config.max_cost_per_day,
        is_blocked: !config.is_blocked,
      }),
    });
    await loadData();
  }

  if (loading) {
    return <div className="text-xs font-mono text-inkDim py-4">Loading end-user quota metrics and rate limits...</div>;
  }

  const customConfigs = configs.filter((c) => c.end_user_id !== null);
  const totalTopSpend = topUsers.reduce((acc, u) => acc + u.total_cost_usd, 0);
  const blockedCount = configs.filter((c) => c.is_blocked).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">End-User Quotas & Rate Limiting</h1>
          <p className="mt-1 text-xs text-inkDim">
            Control per-customer LLM token spend, request velocities, and prevent abusive rogue actors with sliding window counters.
          </p>
        </div>

        <Button
          onClick={() => void loadData()}
          variant="outline"
          className="h-8 text-xs flex items-center gap-1.5 font-mono"
        >
          <RefreshCw size={13} /> Refresh
        </Button>
      </div>

      {/* Hero Stats Strip */}
      <div className="grid border border-border bg-surface sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border">
        <div className="p-4 space-y-1">
          <div className="flex items-center justify-between text-inkDim text-xs font-mono">
            <span>ACTIVE CUSTOMERS</span>
            <Users size={15} className="text-accent" />
          </div>
          <p className="text-2xl font-bold text-ink font-mono">{topUsers.length}</p>
          <p className="text-[10px] text-inkFaint font-mono">Tracked via end_user_id</p>
        </div>

        <div className="p-4 space-y-1">
          <div className="flex items-center justify-between text-inkDim text-xs font-mono">
            <span>24H CUSTOMER SPEND</span>
            <DollarSign size={15} className="text-warn" />
          </div>
          <p className="text-2xl font-bold text-ink font-mono">${totalTopSpend.toFixed(2)}</p>
          <p className="text-[10px] text-inkFaint font-mono">Aggregated token consumption</p>
        </div>

        <div className="p-4 space-y-1">
          <div className="flex items-center justify-between text-inkDim text-xs font-mono">
            <span>DEFAULT DAILY LIMIT</span>
            <Gauge size={15} className="text-good" />
          </div>
          <p className="text-2xl font-bold text-good font-mono">${defaultCost.toFixed(2)}</p>
          <p className="text-[10px] text-inkFaint font-mono">{defaultRequests.toLocaleString()} reqs / day</p>
        </div>

        <div className="p-4 space-y-1">
          <div className="flex items-center justify-between text-inkDim text-xs font-mono">
            <span>BLOCKED CUSTOMERS</span>
            <Ban size={15} className={blockedCount > 0 ? "text-bad" : "text-inkDim"} />
          </div>
          <p className={`text-2xl font-bold font-mono ${blockedCount > 0 ? "text-bad" : "text-ink"}`}>
            {blockedCount}
          </p>
          <p className="text-[10px] text-inkFaint font-mono">Rogue actors throttled</p>
        </div>
      </div>

      {/* Top End-Users by Token Spend & Velocity */}
      <Card className="border border-border bg-surface p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h2 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-2 font-mono">
              <Users size={16} className="text-accent" /> Top End-Users by 24h Spend & Request Volume
            </h2>
            <p className="text-xs text-inkDim mt-0.5">
              Live sliding window metrics. Spot anomalous, abusive, or VIP customer accounts.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border text-[11px] font-mono text-inkDim uppercase bg-paper">
              <tr>
                <th className="py-2.5 px-3">End User ID</th>
                <th className="py-2.5 px-3">24h Requests</th>
                <th className="py-2.5 px-3">24h Spend</th>
                <th className="py-2.5 px-3">Avg Latency</th>
                <th className="py-2.5 px-3">Quota Utilization</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono">
              {topUsers.map((user) => (
                <tr key={user.end_user_id} className="hover:bg-paper transition-colors">
                  <td className="py-3 px-3 font-bold text-ink flex items-center gap-2">
                    <span className="h-2 w-2 bg-accent inline-block" />
                    {user.end_user_id}
                  </td>
                  <td className="py-3 px-3 text-inkDim">{user.total_requests.toLocaleString()}</td>
                  <td className="py-3 px-3 text-ink font-bold">${user.total_cost_usd.toFixed(2)}</td>
                  <td className="py-3 px-3 text-inkDim">{user.avg_latency_ms} ms</td>
                  <td className="py-3 px-3">
                    <div className="space-y-1 w-32">
                      <div className="flex justify-between text-[10px]">
                        <span className={user.utilization_pct > 80 ? "text-warn font-bold" : "text-inkDim"}>
                          {user.utilization_pct}%
                        </span>
                        <span className="text-inkFaint">${user.max_cost} cap</span>
                      </div>
                      <div className="h-1.5 w-full bg-paper border border-border overflow-hidden">
                        <div
                          className={`h-full ${
                            user.utilization_pct > 90
                              ? "bg-bad"
                              : user.utilization_pct > 70
                              ? "bg-warn"
                              : "bg-good"
                          }`}
                          style={{ width: `${Math.min(user.utilization_pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    {user.is_blocked ? (
                      <Badge variant="bad" className="text-[10px]">
                        BLOCKED
                      </Badge>
                    ) : user.utilization_pct > 80 ? (
                      <Badge variant="warn" className="text-[10px]">
                        HIGH USAGE
                      </Badge>
                    ) : (
                      <Badge variant="good" className="text-[10px]">
                        NORMAL
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Quota Rules & Overrides Management */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Org Default Quota Card */}
        <Card className="border border-border bg-surface p-5 space-y-4">
          <div className="border-b border-border pb-3">
            <h3 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-2 font-mono">
              <Gauge size={16} className="text-good" /> Default Organization Quota
            </h3>
            <p className="text-xs text-inkDim mt-0.5">
              Applies to any customer without a specific custom override.
            </p>
          </div>

          <div className="space-y-3 text-xs font-mono">
            <div>
              <label className="text-[11px] text-inkDim uppercase font-semibold">
                Max Requests per Day
              </label>
              <input
                type="number"
                value={defaultRequests}
                onChange={(e) => setDefaultRequests(Number(e.target.value))}
                className="w-full mt-1 border border-border bg-surface p-2 text-ink focus:border-ink focus:outline-none text-xs font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] text-inkDim uppercase font-semibold">
                Max Token Cost per Day ($ USD)
              </label>
              <input
                type="number"
                step="0.5"
                value={defaultCost}
                onChange={(e) => setDefaultCost(Number(e.target.value))}
                className="w-full mt-1 border border-border bg-surface p-2 text-ink focus:border-ink focus:outline-none text-xs font-mono"
              />
            </div>

            <Button
              onClick={() => void saveDefaultQuota()}
              disabled={savingDefault}
              variant="primary"
              className="w-full text-xs h-8 flex items-center justify-center gap-1.5 font-mono"
            >
              <Save size={13} /> {savingDefault ? "Saving Default..." : "Save Default Limits"}
            </Button>
          </div>
        </Card>

        {/* Add Custom User Override */}
        <Card className="border border-border bg-surface p-5 space-y-4">
          <div className="border-b border-border pb-3">
            <h3 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-2 font-mono">
              <Plus size={16} className="text-accent" /> Add Per-Customer Override
            </h3>
            <p className="text-xs text-inkDim mt-0.5">
              Set custom limits for VIP enterprise tiers or throttle suspected scrapers.
            </p>
          </div>

          <form onSubmit={(e) => void handleAddOverride(e)} className="space-y-3 text-xs font-mono">
            <div>
              <label className="text-[11px] text-inkDim uppercase font-semibold">
                End User ID / Customer Key
              </label>
              <input
                type="text"
                placeholder="e.g. cust_enterprise_corp_1"
                value={newUserId}
                onChange={(e) => setNewUserId(e.target.value)}
                required
                className="w-full mt-1 border border-border bg-surface p-2 text-ink placeholder-inkFaint focus:border-ink focus:outline-none text-xs font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-inkDim uppercase font-semibold">
                  Max Requests / Day
                </label>
                <input
                  type="number"
                  value={newMaxRequests}
                  onChange={(e) => setNewMaxRequests(Number(e.target.value))}
                  className="w-full mt-1 border border-border bg-surface p-2 text-ink focus:border-ink focus:outline-none text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] text-inkDim uppercase font-semibold">
                  Max Cost / Day ($)
                </label>
                <input
                  type="number"
                  step="1"
                  value={newMaxCost}
                  onChange={(e) => setNewMaxCost(Number(e.target.value))}
                  className="w-full mt-1 border border-border bg-surface p-2 text-ink focus:border-ink focus:outline-none text-xs font-mono"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={addingOverride}
              variant="outline"
              className="w-full text-xs h-8 flex items-center justify-center gap-1.5 font-mono"
            >
              <Plus size={13} /> {addingOverride ? "Adding Override..." : "Save Custom Override"}
            </Button>
          </form>
        </Card>
      </div>

      {/* Active Custom Overrides List */}
      <Card className="border border-border bg-surface p-6 space-y-4">
        <h2 className="text-xs font-bold text-ink uppercase tracking-wider border-b border-border pb-3 font-mono">
          Configured Per-Customer Overrides ({customConfigs.length})
        </h2>

        <div className="space-y-3">
          {customConfigs.map((cfg) => (
            <div
              key={cfg.id}
              className="border border-border bg-paper p-4 text-xs flex flex-wrap items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-ink font-bold text-sm">{cfg.end_user_id}</span>
                  {cfg.is_blocked ? (
                    <Badge variant="bad" className="text-[10px]">
                      BLOCKED
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">
                      CUSTOM OVERRIDE
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-inkDim font-mono text-[11px]">
                  <span>Daily Requests: <strong className="text-ink">{cfg.max_requests_per_day.toLocaleString()}</strong></span>
                  <span>·</span>
                  <span>Daily Cap: <strong className="text-ink font-bold">${Number(cfg.max_cost_per_day).toFixed(2)}</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => void toggleBlockUser(cfg)}
                  variant={cfg.is_blocked ? "outline" : "destructive"}
                  className="h-8 text-xs font-mono flex items-center gap-1"
                >
                  <Ban size={12} /> {cfg.is_blocked ? "Unblock Customer" : "Block Customer"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
