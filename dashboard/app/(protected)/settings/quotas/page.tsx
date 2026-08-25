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
    return <div className="text-sm text-slate-400">Loading end-user quota metrics and rate limits...</div>;
  }

  const customConfigs = configs.filter((c) => c.end_user_id !== null);
  const totalTopSpend = topUsers.reduce((acc, u) => acc + u.total_cost_usd, 0);
  const blockedCount = configs.filter((c) => c.is_blocked).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">End-User Quotas & Rate Limiting</h1>
          <p className="text-sm text-slate-400">
            Control per-customer LLM token spend, request velocities, and prevent abusive rogue actors with sliding window counters.
          </p>
        </div>

        <Button
          onClick={() => void loadData()}
          className="h-8 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5"
        >
          <RefreshCw size={13} /> Refresh
        </Button>
      </div>

      {/* Hero Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border-slate-800 bg-slate-900/40 p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 uppercase font-semibold">Active Customers</span>
            <Users size={15} className="text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-white font-mono">{topUsers.length}</p>
          <p className="text-[10px] text-slate-500">Tracked via end_user_id</p>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 uppercase font-semibold">24h Customer Spend</span>
            <DollarSign size={15} className="text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-400 font-mono">${totalTopSpend.toFixed(2)}</p>
          <p className="text-[10px] text-slate-500">Aggregated token consumption</p>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 uppercase font-semibold">Default Daily Limit</span>
            <Gauge size={15} className="text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400 font-mono">${defaultCost.toFixed(2)}</p>
          <p className="text-[10px] text-slate-500">{defaultRequests.toLocaleString()} reqs / day</p>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 uppercase font-semibold">Blocked Customers</span>
            <Ban size={15} className={blockedCount > 0 ? "text-red-400" : "text-slate-400"} />
          </div>
          <p className={`text-2xl font-bold font-mono ${blockedCount > 0 ? "text-red-400" : "text-white"}`}>
            {blockedCount}
          </p>
          <p className="text-[10px] text-slate-500">Rogue actors throttled</p>
        </Card>
      </div>

      {/* Top End-Users by Token Spend & Velocity */}
      <Card className="border-slate-800 bg-slate-900/40 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Users size={16} className="text-blue-400" /> Top End-Users by 24h Spend & Request Volume
            </h2>
            <p className="text-xs text-slate-400">
              Live sliding window metrics. Spot anomalous, abusive, or VIP customer accounts.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-mono text-slate-400 uppercase">
                <th className="pb-2">End User ID</th>
                <th className="pb-2">24h Requests</th>
                <th className="pb-2">24h Spend</th>
                <th className="pb-2">Avg Latency</th>
                <th className="pb-2">Quota Utilization</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {topUsers.map((user) => (
                <tr key={user.end_user_id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 font-bold text-white flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    {user.end_user_id}
                  </td>
                  <td className="py-3 text-slate-300">{user.total_requests.toLocaleString()}</td>
                  <td className="py-3 text-amber-400 font-bold">${user.total_cost_usd.toFixed(2)}</td>
                  <td className="py-3 text-slate-400">{user.avg_latency_ms} ms</td>
                  <td className="py-3">
                    <div className="space-y-1 w-32">
                      <div className="flex justify-between text-[10px]">
                        <span className={user.utilization_pct > 80 ? "text-amber-400 font-bold" : "text-slate-400"}>
                          {user.utilization_pct}%
                        </span>
                        <span className="text-slate-500">${user.max_cost} cap</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            user.utilization_pct > 90
                              ? "bg-red-500"
                              : user.utilization_pct > 70
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          }`}
                          style={{ width: `${Math.min(user.utilization_pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-3">
                    {user.is_blocked ? (
                      <Badge className="bg-red-950 text-red-300 border-red-800 text-[10px]">
                        BLOCKED
                      </Badge>
                    ) : user.utilization_pct > 80 ? (
                      <Badge className="bg-amber-950 text-amber-300 border-amber-800 text-[10px]">
                        HIGH USAGE
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800 text-[10px]">
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
        <Card className="border-slate-800 bg-slate-900/40 p-5 space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Gauge size={16} className="text-emerald-400" /> Default Organization Quota
            </h3>
            <p className="text-xs text-slate-400">
              Applies to any customer without a specific custom override.
            </p>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-[11px] text-slate-400 uppercase font-semibold">
                Max Requests per Day
              </label>
              <input
                type="number"
                value={defaultRequests}
                onChange={(e) => setDefaultRequests(Number(e.target.value))}
                className="w-full mt-1 rounded bg-slate-950 border border-slate-800 p-2 font-mono text-white text-xs"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 uppercase font-semibold">
                Max Token Cost per Day ($ USD)
              </label>
              <input
                type="number"
                step="0.5"
                value={defaultCost}
                onChange={(e) => setDefaultCost(Number(e.target.value))}
                className="w-full mt-1 rounded bg-slate-950 border border-slate-800 p-2 font-mono text-white text-xs"
              />
            </div>

            <Button
              onClick={() => void saveDefaultQuota()}
              disabled={savingDefault}
              className="w-full text-xs bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1.5"
            >
              <Save size={13} /> {savingDefault ? "Saving Default..." : "Save Default Limits"}
            </Button>
          </div>
        </Card>

        {/* Add Custom User Override */}
        <Card className="border-slate-800 bg-slate-900/40 p-5 space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Plus size={16} className="text-blue-400" /> Add Per-Customer Override
            </h3>
            <p className="text-xs text-slate-400">
              Set custom limits for VIP enterprise tiers or throttle suspected scrapers.
            </p>
          </div>

          <form onSubmit={(e) => void handleAddOverride(e)} className="space-y-3 text-xs">
            <div>
              <label className="text-[11px] text-slate-400 uppercase font-semibold">
                End User ID / Customer Key
              </label>
              <input
                type="text"
                placeholder="e.g. cust_enterprise_corp_1"
                value={newUserId}
                onChange={(e) => setNewUserId(e.target.value)}
                required
                className="w-full mt-1 rounded bg-slate-950 border border-slate-800 p-2 font-mono text-white text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-semibold">
                  Max Requests / Day
                </label>
                <input
                  type="number"
                  value={newMaxRequests}
                  onChange={(e) => setNewMaxRequests(Number(e.target.value))}
                  className="w-full mt-1 rounded bg-slate-950 border border-slate-800 p-2 font-mono text-white text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-semibold">
                  Max Cost / Day ($)
                </label>
                <input
                  type="number"
                  step="1"
                  value={newMaxCost}
                  onChange={(e) => setNewMaxCost(Number(e.target.value))}
                  className="w-full mt-1 rounded bg-slate-950 border border-slate-800 p-2 font-mono text-white text-xs"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={addingOverride}
              className="w-full text-xs bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-1.5"
            >
              <Plus size={13} /> {addingOverride ? "Adding Override..." : "Save Custom Override"}
            </Button>
          </form>
        </Card>
      </div>

      {/* Active Custom Overrides List */}
      <Card className="border-slate-800 bg-slate-900/40 p-6 space-y-4">
        <h2 className="text-sm font-bold text-white border-b border-slate-800 pb-3">
          Configured Per-Customer Overrides ({customConfigs.length})
        </h2>

        <div className="space-y-3">
          {customConfigs.map((cfg) => (
            <div
              key={cfg.id}
              className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-xs flex flex-wrap items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-white font-bold text-sm">{cfg.end_user_id}</span>
                  {cfg.is_blocked ? (
                    <Badge className="bg-red-950 text-red-300 border-red-800 text-[10px]">
                      BLOCKED
                    </Badge>
                  ) : (
                    <Badge className="bg-blue-950 text-blue-300 border-blue-800 text-[10px]">
                      CUSTOM OVERRIDE
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px]">
                  <span>Daily Requests: <strong className="text-white">{cfg.max_requests_per_day.toLocaleString()}</strong></span>
                  <span>·</span>
                  <span>Daily Cap: <strong className="text-amber-400">${Number(cfg.max_cost_per_day).toFixed(2)}</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => void toggleBlockUser(cfg)}
                  className={`h-8 text-xs font-mono flex items-center gap-1 ${
                    cfg.is_blocked
                      ? "bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800"
                      : "bg-red-950 hover:bg-red-900 text-red-300 border border-red-800"
                  }`}
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
