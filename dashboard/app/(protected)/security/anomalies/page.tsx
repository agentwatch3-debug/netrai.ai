"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowUpRight, CheckCircle2, Database, Eye, Layers, PlusCircle, Radio, RefreshCw, Search, ShieldCheck, Wrench } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Anomaly {
  id: number;
  org_id: string;
  agent_id: string;
  trace_id: string;
  span_id: string;
  anomaly_type: "new_tool" | "new_resource" | string;
  resource_name: string;
  details: {
    reason?: string;
  };
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  detected_at: string;
}

interface BaselineItem {
  agent_id: string;
  resource_type: string;
  resource_name: string;
  added_by: string;
}

export default function ScopeDriftAnomaliesPage() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [baselines, setBaselines] = useState<BaselineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  // Filters
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("open"); // 'all' | 'open' | 'resolved'
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"anomalies" | "baselines">("anomalies");

  async function loadData() {
    try {
      const [anomRes, baseRes] = await Promise.all([
        fetch("/api/security/anomalies"),
        fetch("/api/security/baselines"),
      ]);
      if (anomRes.ok) {
        const body = await anomRes.json();
        setAnomalies(body.data || []);
      }
      if (baseRes.ok) {
        const body = await baseRes.json();
        setBaselines(body.data || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleMarkExpected(anomaly: Anomaly) {
    setResolvingId(anomaly.id);
    try {
      const res = await fetch(`/api/security/anomalies/${anomaly.id}/resolve`, {
        method: "POST",
      });
      if (res.ok) {
        setAnomalies((prev) =>
          prev.map((a) =>
            a.id === anomaly.id
              ? { ...a, resolved: true, resolved_at: new Date().toISOString(), resolved_by: "user_approved" }
              : a
          )
        );
        // Also add to active baselines list
        setBaselines((prev) => [
          ...prev,
          {
            agent_id: anomaly.agent_id,
            resource_type: anomaly.anomaly_type === "new_tool" ? "tool" : "resource",
            resource_name: anomaly.resource_name,
            added_by: "user_approved",
          },
        ]);
      }
    } finally {
      setResolvingId(null);
    }
  }

  const openCount = anomalies.filter((a) => !a.resolved).length;
  const resolvedCount = anomalies.filter((a) => a.resolved).length;
  const uniqueAgents = Array.from(new Set(anomalies.map((a) => a.agent_id))).filter(Boolean);

  const filtered = anomalies.filter((item) => {
    if (selectedAgent !== "all" && item.agent_id !== selectedAgent) return false;
    if (statusFilter === "open" && item.resolved) return false;
    if (statusFilter === "resolved" && !item.resolved) return false;
    if (typeFilter !== "all" && item.anomaly_type !== typeFilter) return false;
    if (search && !item.resource_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return <div className="text-sm text-slate-400">Loading scope drift anomalies & 30-day baselines...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Scope-Drift & Behavioral Anomalies</h1>
          <p className="text-sm text-slate-400">
            30-day rolling baseline tracker detecting unapproved agent tool executions and unexpected data resource access.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setActiveTab("anomalies")}
            className={`h-8 text-xs ${activeTab === "anomalies" ? "bg-blue-600 text-white" : "bg-slate-900 text-slate-400 hover:text-white"}`}
          >
            <Radio size={13} className="mr-1.5" /> Anomalies ({openCount} Open)
          </Button>
          <Button
            onClick={() => setActiveTab("baselines")}
            className={`h-8 text-xs ${activeTab === "baselines" ? "bg-blue-600 text-white" : "bg-slate-900 text-slate-400 hover:text-white"}`}
          >
            <ShieldCheck size={13} className="mr-1.5" /> Approved Baselines ({baselines.length})
          </Button>
        </div>
      </div>

      {/* Hero Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-slate-800 bg-slate-900/40 p-5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase font-semibold">Open Scope Anomalies</span>
            <AlertCircle size={16} className={openCount > 0 ? "text-amber-400" : "text-emerald-400"} />
          </div>
          <p className="text-2xl font-bold text-white font-mono pt-1">{openCount}</p>
          <p className="text-[11px] text-slate-500">Unapproved tools or tables outside 30-day baseline</p>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 p-5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase font-semibold">Resolved & Approved</span>
            <CheckCircle2 size={16} className="text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400 font-mono pt-1">{resolvedCount}</p>
          <p className="text-[11px] text-slate-500">Marked as expected and incorporated into baseline</p>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 p-5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase font-semibold">Active Baseline Inventory</span>
            <Layers size={16} className="text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-blue-400 font-mono pt-1">{baselines.length}</p>
          <p className="text-[11px] text-slate-500">Verified tools and data assets across {uniqueAgents.length || 3} agents</p>
        </Card>
      </div>

      {activeTab === "anomalies" ? (
        <>
          {/* Filters Bar */}
          <Card className="border-slate-800 bg-slate-900/40 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative w-64">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
                  <input
                    className="w-full h-8 rounded border border-slate-800 bg-slate-950 pl-8 pr-3 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                    placeholder="Search tool or table name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                {/* Agent Dropdown */}
                <select
                  className="h-8 rounded border border-slate-800 bg-slate-950 px-3 text-xs text-white focus:border-blue-500 focus:outline-none"
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                >
                  <option value="all">All Agents</option>
                  {uniqueAgents.map((agent) => (
                    <option key={agent} value={agent}>{agent}</option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  className="h-8 rounded border border-slate-800 bg-slate-950 px-3 text-xs text-white focus:border-blue-500 focus:outline-none"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="open">Open Incidents Only</option>
                  <option value="resolved">Resolved / Expected Only</option>
                  <option value="all">All Anomalies</option>
                </select>

                {/* Type Filter */}
                <select
                  className="h-8 rounded border border-slate-800 bg-slate-950 px-3 text-xs text-white focus:border-blue-500 focus:outline-none"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="all">All Anomaly Types</option>
                  <option value="new_tool">New Tool Calls</option>
                  <option value="new_resource">New Data Resources</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Anomaly Cards List */}
          <div className="space-y-4">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Detected Scope-Drift Incidents ({filtered.length})
            </span>

            {filtered.length > 0 ? (
              <div className="space-y-3">
                {filtered.map((item) => {
                  const isTool = item.anomaly_type === "new_tool";

                  return (
                    <Card
                      key={item.id}
                      className={`border p-4 space-y-3 transition-all ${
                        item.resolved
                          ? "border-slate-800/60 bg-slate-950/40 opacity-75"
                          : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/60 pb-2.5">
                        <div className="flex items-center gap-2">
                          <Badge
                            className={
                              item.resolved
                                ? "bg-slate-900 text-slate-400 border-slate-700 font-mono text-[10px]"
                                : isTool
                                ? "bg-red-950 text-red-300 border-red-800 font-mono text-[10px]"
                                : "bg-amber-950 text-amber-300 border-amber-800 font-mono text-[10px]"
                            }
                          >
                            {item.resolved ? "RESOLVED (APPROVED)" : isTool ? "🚨 UNAPPROVED TOOL" : "🚨 UNEXPECTED RESOURCE"}
                          </Badge>
                          <span className="font-mono text-xs text-slate-300">
                            Agent: <strong className="text-white">{item.agent_id}</strong>
                          </span>
                        </div>

                        <div className="flex items-center gap-3 font-mono text-xs">
                          <span className="text-[11px] text-slate-500">{new Date(item.detected_at).toLocaleString()}</span>
                          {item.trace_id && (
                            <Link href={`/traces/${item.trace_id}`} className="text-blue-400 hover:underline flex items-center gap-0.5 text-[10px]">
                              Waterfall <ArrowUpRight size={11} />
                            </Link>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {isTool ? <Wrench size={14} className="text-red-400" /> : <Database size={14} className="text-amber-400" />}
                            <span className="font-mono text-xs font-bold text-white bg-slate-950 border border-slate-800 px-2 py-0.5 rounded">
                              {item.resource_name}
                            </span>
                          </div>
                          {item.details?.reason && (
                            <p className="text-xs text-slate-400 pt-0.5">{item.details.reason}</p>
                          )}
                        </div>

                        {!item.resolved ? (
                          <Button
                            onClick={() => void handleMarkExpected(item)}
                            disabled={resolvingId === item.id}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 px-3 flex items-center gap-1.5 font-semibold"
                          >
                            <CheckCircle2 size={13} className={resolvingId === item.id ? "animate-spin" : ""} />
                            {resolvingId === item.id ? "Approving..." : "Mark as Expected (Add to Baseline)"}
                          </Button>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                            <CheckCircle2 size={14} /> Approved into baseline
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-12 text-center text-slate-400 text-sm">
                No scope-drift anomalies match the selected filter criteria.
              </div>
            )}
          </div>
        </>
      ) : (
        /* Baseline Inventory Tab */
        <Card className="border-slate-800 bg-slate-900/40 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Learned & Approved Baseline Inventory</h2>
              <p className="text-xs text-slate-400">Tools and data tables currently approved for execution by each agent.</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {baselines.map((b, idx) => (
              <div key={idx} className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-slate-400 text-[11px]">{b.agent_id}</span>
                  <Badge className="bg-slate-900 text-slate-300 border-slate-700 text-[9px] uppercase">
                    {b.resource_type}
                  </Badge>
                </div>
                <div className="font-mono text-white font-semibold break-all flex items-center gap-1.5">
                  {b.resource_type === "tool" ? <Wrench size={13} className="text-blue-400 shrink-0" /> : <Database size={13} className="text-amber-400 shrink-0" />}
                  <span>{b.resource_name}</span>
                </div>
                <div className="text-[10px] text-slate-500 border-t border-slate-900 pt-1">
                  Source: <strong>{b.added_by}</strong>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
