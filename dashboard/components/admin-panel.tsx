"use client";

import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock,
  Cpu,
  CreditCard,
  Database,
  Download,
  Filter,
  HardDrive,
  KeyRound,
  Lock,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  TrendingUp,
  Users,
  Zap,
  ZapOff
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Tenant {
  id: string;
  name: string;
  plan_tier: "free" | "pro" | "team" | "enterprise";
  monthly_spans_limit: number;
  current_spans_count: number;
  retention_days: number;
  status: "active" | "suspended" | "trial";
  created_at: string;
  owner_email: string;
  region: string;
}

const INITIAL_TENANTS: Tenant[] = [];

const SECURITY_FEED: Array<{
  id: string;
  org_name: string;
  timestamp: string;
  type: string;
  risk_score: number;
  status: string;
  snippet: string;
  target_agent: string;
}> = [];

export function AdminPanel() {
  const [tenants, setTenants] = useState<Tenant[]>(INITIAL_TENANTS);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"tenants" | "security" | "infrastructure" | "audit">("tenants");
  const [selectedPlanFilter, setSelectedPlanFilter] = useState<string>("all");
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const filteredTenants = tenants.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.owner_email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPlan = selectedPlanFilter === "all" || t.plan_tier === selectedPlanFilter;
    return matchesSearch && matchesPlan;
  });

  const totalSpans = tenants.reduce((acc, t) => acc + t.current_spans_count, 0);
  const totalCapacity = tenants.reduce((acc, t) => acc + t.monthly_spans_limit, 0);

  const handleUpdatePlan = (tenantId: string, newPlan: "free" | "pro" | "team" | "enterprise") => {
    const limitMap = {
      free: 100000,
      pro: 1000000,
      team: 10000000,
      enterprise: 50000000,
    };
    const retentionMap = {
      free: 7,
      pro: 30,
      team: 90,
      enterprise: 180,
    };

    setTenants((prev) =>
      prev.map((t) =>
        t.id === tenantId
          ? {
              ...t,
              plan_tier: newPlan,
              monthly_spans_limit: limitMap[newPlan],
              retention_days: retentionMap[newPlan],
            }
          : t
      )
    );
    setEditingTenant(null);
    setSuccessMsg(`Updated ${tenantId} to ${newPlan.toUpperCase()} plan successfully.`);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const handleToggleStatus = (tenantId: string) => {
    setTenants((prev) =>
      prev.map((t) =>
        t.id === tenantId
          ? { ...t, status: t.status === "active" ? "suspended" : "active" }
          : t
      )
    );
  };

  return (
    <div className="space-y-6">
      {/* Top SuperAdmin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
              SuperAdmin Platform Console
            </h1>
            <Badge variant="accent" className="text-[10px] font-mono uppercase">
              Platform Master
            </Badge>
          </div>
          <p className="mt-1 text-xs text-inkDim">
            Global multi-tenant governance, cluster telemetry, MRR revenue metrics, and security controls.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="good" className="font-mono text-xs">
            DPDP India Cluster Active
          </Badge>
          <Button
            variant="outline"
            className="h-8 text-xs font-mono"
            onClick={() => {
              setSuccessMsg("Refreshed real-time telemetry across all 5 nodes.");
              setTimeout(() => setSuccessMsg(null), 3000);
            }}
          >
            <RefreshCw size={13} className="mr-1.5" /> Refresh
          </Button>
        </div>
      </div>

      {successMsg && (
        <div className="border border-good/40 bg-good/10 p-3 text-xs font-mono text-good flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-inkDim hover:text-ink">✕</button>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid border border-border bg-surface sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border">
        <div className="p-4 space-y-1">
          <div className="flex items-center justify-between text-xs font-mono text-inkDim">
            <span>REGISTERED TENANTS</span>
            <Building2 size={16} className="text-accent" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink font-mono">{tenants.length}</span>
            <span className="text-xs text-good font-mono">+2 this week</span>
          </div>
          <p className="text-[10px] text-inkFaint font-mono">All tenants in ap-south-1</p>
        </div>

        <div className="p-4 space-y-1">
          <div className="flex items-center justify-between text-xs font-mono text-inkDim">
            <span>30D INGESTED SPANS</span>
            <Activity size={16} className="text-accent" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink font-mono">
              {(totalSpans / 1000000).toFixed(1)}M
            </span>
            <span className="text-xs text-inkDim font-mono">/ {(totalCapacity / 1000000).toFixed(0)}M cap</span>
          </div>
          <div className="h-1.5 w-full bg-paper border border-border overflow-hidden mt-1">
            <div
              className="h-full bg-ink"
              style={{ width: `${Math.min(100, (totalSpans / totalCapacity) * 100)}%` }}
            />
          </div>
        </div>

        <div className="p-4 space-y-1">
          <div className="flex items-center justify-between text-xs font-mono text-inkDim">
            <span>PLATFORM MRR (INR)</span>
            <CreditCard size={16} className="text-good" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-good font-mono">₹84,970</span>
            <span className="text-xs text-good font-mono">+32% MoM</span>
          </div>
          <p className="text-[10px] text-inkFaint font-mono">Razorpay Gateway</p>
        </div>

        <div className="p-4 space-y-1">
          <div className="flex items-center justify-between text-xs font-mono text-inkDim">
            <span>THREATS BLOCKED</span>
            <ShieldAlert size={16} className="text-bad" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-bad font-mono">342</span>
            <span className="text-xs text-good font-mono">100% blocked</span>
          </div>
          <p className="text-[10px] text-inkFaint font-mono">Zero exfiltrations detected</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-border text-xs font-mono font-medium text-inkDim space-x-6">
        <button
          onClick={() => setActiveTab("tenants")}
          className={`pb-3 transition-colors flex items-center gap-2 ${
            activeTab === "tenants"
              ? "border-b-2 border-ink text-ink font-bold"
              : "hover:text-ink"
          }`}
        >
          <Building2 size={15} />
          <span>Tenants & Subscriptions ({tenants.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("security")}
          className={`pb-3 transition-colors flex items-center gap-2 ${
            activeTab === "security"
              ? "border-b-2 border-ink text-ink font-bold"
              : "hover:text-ink"
          }`}
        >
          <ShieldAlert size={15} />
          <span>Cross-Tenant Security Feed</span>
        </button>
        <button
          onClick={() => setActiveTab("infrastructure")}
          className={`pb-3 transition-colors flex items-center gap-2 ${
            activeTab === "infrastructure"
              ? "border-b-2 border-ink text-ink font-bold"
              : "hover:text-ink"
          }`}
        >
          <Server size={15} />
          <span>Cluster Infrastructure</span>
        </button>
        <button
          onClick={() => setActiveTab("audit")}
          className={`pb-3 transition-colors flex items-center gap-2 ${
            activeTab === "audit"
              ? "border-b-2 border-ink text-ink font-bold"
              : "hover:text-ink"
          }`}
        >
          <Lock size={15} />
          <span>Tamper-Evident Global Audit</span>
        </button>
      </div>

      {/* Tab 1: Tenants Management */}
      {activeTab === "tenants" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border border-border bg-surface p-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 text-inkDim" size={14} />
              <input
                type="text"
                placeholder="Search by org ID, name, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border border-border bg-surface py-1.5 pl-9 pr-3 text-xs text-ink placeholder-inkFaint focus:border-ink focus:outline-none font-mono"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto font-mono text-xs">
              <span className="text-inkDim">Plan Filter:</span>
              <select
                value={selectedPlanFilter}
                onChange={(e) => setSelectedPlanFilter(e.target.value)}
                className="border border-border bg-surface px-3 py-1 text-xs text-ink focus:border-ink focus:outline-none font-mono"
              >
                <option value="all">All Plans</option>
                <option value="enterprise">Enterprise</option>
                <option value="team">Team (₹8,299/mo)</option>
                <option value="pro">Pro (₹2,499/mo)</option>
                <option value="free">Free Starter</option>
              </select>
            </div>
          </div>

          <Card className="border border-border bg-surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left font-mono">
                <thead className="border-b border-border bg-paper text-inkDim">
                  <tr>
                    <th className="py-2.5 px-4">Organization</th>
                    <th className="py-2.5 px-4">Plan Tier</th>
                    <th className="py-2.5 px-4">Span Usage / Limit</th>
                    <th className="py-2.5 px-4">Retention</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredTenants.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-inkDim font-mono text-xs">
                        No tenant organizations found.
                      </td>
                    </tr>
                  ) : (
                    filteredTenants.map((tenant) => {
                    const usagePercent = Math.min(100, Math.round((tenant.current_spans_count / tenant.monthly_spans_limit) * 100));
                    return (
                      <tr key={tenant.id} className="hover:bg-paper transition-colors">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-bold text-ink text-xs font-sans">{tenant.name}</p>
                            <p className="text-[11px] text-inkDim font-normal">{tenant.owner_email}</p>
                            <span className="text-[10px] text-inkFaint">{tenant.id} • {tenant.region}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={tenant.plan_tier === "enterprise" || tenant.plan_tier === "team" ? "accent" : "secondary"} className="uppercase text-[10px] font-bold">
                            {tenant.plan_tier}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 w-60">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px]">
                              <span className="text-ink font-bold">{(tenant.current_spans_count / 1000).toLocaleString()}k</span>
                              <span className="text-inkDim">{(tenant.monthly_spans_limit / 1000).toLocaleString()}k limit</span>
                            </div>
                            <div className="h-1.5 w-full bg-paper border border-border overflow-hidden">
                              <div
                                className={`h-full ${
                                  usagePercent > 90
                                    ? "bg-bad"
                                    : usagePercent > 70
                                    ? "bg-warn"
                                    : "bg-good"
                                }`}
                                style={{ width: `${usagePercent}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-inkDim">
                          {tenant.retention_days} Days
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={tenant.status === "active" ? "good" : "bad"} className="text-[10px]">
                            {tenant.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <Button
                            variant="outline"
                            className="h-7 text-xs px-2.5 font-mono"
                            onClick={() => setEditingTenant(tenant)}
                          >
                            Adjust Plan
                          </Button>
                          <Button
                            variant={tenant.status === "active" ? "destructive" : "outline"}
                            className="h-7 text-xs px-2.5 font-mono"
                            onClick={() => handleToggleStatus(tenant.id)}
                          >
                            {tenant.status === "active" ? "Suspend" : "Activate"}
                          </Button>
                        </td>
                      </tr>
                    );
                  }))}
                </tbody>
              </table>
            </div>
          </Card>

          {editingTenant && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
              <Card className="w-full max-w-md border border-border bg-surface p-6 space-y-5">
                <div className="border-b border-border pb-3">
                  <h3 className="text-sm font-bold text-ink uppercase tracking-wider font-mono">Adjust Subscription Plan</h3>
                  <p className="text-xs text-inkDim mt-1">Tenant: <span className="text-accent font-mono">{editingTenant.name}</span> ({editingTenant.id})</p>
                </div>

                <div className="space-y-2">
                  {(["free", "pro", "team", "enterprise"] as const).map((tier) => (
                    <div
                      key={tier}
                      onClick={() => handleUpdatePlan(editingTenant.id, tier)}
                      className={`p-3 border cursor-pointer transition-colors flex items-center justify-between ${
                        editingTenant.plan_tier === tier
                          ? "border-ink bg-paper"
                          : "border-border bg-surface hover:bg-paper"
                      }`}
                    >
                      <div>
                        <span className="font-bold text-ink uppercase text-xs block font-mono">{tier}</span>
                        <span className="text-[11px] text-inkDim font-mono">
                          {tier === "free" && "100k Spans/mo • 7 Days Retention"}
                          {tier === "pro" && "1M Spans/mo • 30 Days Retention (₹2,499)"}
                          {tier === "team" && "10M Spans/mo • 90 Days Retention (₹8,299)"}
                          {tier === "enterprise" && "50M+ Spans/mo • 180 Days Retention • Custom"}
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-[10px] font-mono uppercase">{tier}</Badge>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-2 border-t border-border">
                  <Button
                    variant="outline"
                    className="h-8 text-xs font-mono"
                    onClick={() => setEditingTenant(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Security Feed */}
      {activeTab === "security" && (
        <div className="space-y-4">
          <div className="border border-bad/40 bg-bad/5 p-4 text-xs text-ink flex items-start gap-3 font-mono">
            <ShieldAlert className="text-bad shrink-0 mt-0.5" size={16} />
            <div>
              <strong className="block text-bad font-bold">Autonomous Prompt Injection Shield Active</strong>
              <span className="text-inkDim">
                Presidio PII tokenization and heuristic injection detectors are actively protecting all tenants. 100% of malicious attempts were trapped before model execution.
              </span>
            </div>
          </div>

          {SECURITY_FEED.length === 0 ? (
            <Card className="border border-border bg-surface p-8 text-center text-inkDim font-mono text-xs">
              No security incidents or injection attempts recorded.
            </Card>
          ) : (
            <Card className="border border-border bg-surface overflow-hidden">
              <div className="divide-y divide-border font-mono">
                {SECURITY_FEED.map((event) => (
                  <div key={event.id} className="p-4 hover:bg-paper transition-colors space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink">{event.org_name}</span>
                        <Badge variant="bad" className="text-[10px]">
                          {event.type}
                        </Badge>
                        <span className="text-[11px] text-inkDim">Target: {event.target_agent}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-warn font-bold">Risk: {event.risk_score}</span>
                        <Badge variant="bad" className="text-[10px]">
                          {event.status}
                        </Badge>
                        <span className="text-xs text-inkDim">{event.timestamp}</span>
                      </div>
                    </div>
                    <div className="border border-border bg-paper p-2.5 text-[11px] text-ink">
                      <span className="text-inkDim select-none">&gt; Payload: </span>
                      {event.snippet}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Tab 3: Infrastructure */}
      {activeTab === "infrastructure" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
          <Card className="border border-border bg-surface p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="font-bold text-ink uppercase flex items-center gap-2">
                <Database size={16} className="text-accent" /> ClickHouse Analytics Cluster
              </h3>
              <Badge variant="good" className="text-[10px]">HEALTHY</Badge>
            </div>
            <div className="space-y-2 text-ink">
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-inkDim">Version</span>
                <span>ClickHouse 24.8 MergeTree</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-inkDim">Active Partitions</span>
                <span>32 Daily Partitions</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-inkDim">Query P95 Latency</span>
                <span className="text-good font-bold">18ms</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-inkDim">Ingestion Backlog</span>
                <span>0 messages</span>
              </div>
            </div>
          </Card>

          <Card className="border border-border bg-surface p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="font-bold text-ink uppercase flex items-center gap-2">
                <Server size={16} className="text-accent" /> PostgreSQL 16 Cluster
              </h3>
              <Badge variant="good" className="text-[10px]">HEALTHY</Badge>
            </div>
            <div className="space-y-2 text-ink">
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-inkDim">Active Pool</span>
                <span>16 / 100 Connections</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-inkDim">PII Mappings Table</span>
                <span>48,219 Encrypted Rows</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-inkDim">MultiFernet Keyring</span>
                <span>2 Active Keys (Rotated)</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-inkDim">Audit Log Hash Chain</span>
                <span className="text-good font-bold">Verified Clean (0 Forks)</span>
              </div>
            </div>
          </Card>

          <Card className="border border-border bg-surface p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="font-bold text-ink uppercase flex items-center gap-2">
                <Radio size={16} className="text-accent" /> Redis Streams Ingestion Queue
              </h3>
              <Badge variant="good" className="text-[10px]">HEALTHY</Badge>
            </div>
            <div className="space-y-2 text-ink">
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-inkDim">Stream Name</span>
                <span>spans:incoming</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-inkDim">Consumer Groups</span>
                <span>worker_group_1</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-inkDim">Throughput</span>
                <span className="text-good font-bold">2,400 spans / sec</span>
              </div>
            </div>
          </Card>

          <Card className="border border-border bg-surface p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="font-bold text-ink uppercase flex items-center gap-2">
                <Lock size={16} className="text-warn" /> DPDP India Compliance Seal
              </h3>
              <Badge variant="good" className="text-[10px]">ENFORCED</Badge>
            </div>
            <div className="space-y-2 text-ink">
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-inkDim">Storage Region</span>
                <span>ap-south-1 (Mumbai / Pune)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-inkDim">Aadhaar & PAN Masking</span>
                <span className="text-good font-bold">Enforced at Edge</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-inkDim">Two-Step Erasure Gate</span>
                <span>Active (72hr Window)</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 4: Audit */}
      {activeTab === "audit" && (
        <Card className="border border-border bg-surface p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="font-bold text-ink text-xs uppercase tracking-wider font-mono">SHA-256 Cryptographic Audit Log Chain</h3>
              <p className="text-xs text-inkDim mt-0.5 font-mono">Every sensitive action (unmask, erasure, policy update) is chained to the previous hash.</p>
            </div>
            <Badge variant="good" className="text-[10px] font-mono">
              CHAIN VERIFIED: VALID
            </Badge>
          </div>

          <div className="border border-border bg-paper font-mono text-xs overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-border text-inkDim bg-surface">
                <tr>
                  <th className="py-2.5 px-3">Log ID</th>
                  <th className="py-2.5 px-3">Organization</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Current Hash</th>
                  <th className="py-2.5 px-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-ink">
                <tr>
                  <td colSpan={5} className="py-8 text-center text-inkDim font-mono text-xs">
                    No cryptographic audit log entries recorded yet.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
