"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Database, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatRow } from "@/components/ui/stat-row";

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

  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("open");
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

  const filtered = anomalies.filter((item) => {
    if (selectedAgent !== "all" && item.agent_id !== selectedAgent) return false;
    if (statusFilter === "open" && item.resolved) return false;
    if (statusFilter === "resolved" && !item.resolved) return false;
    if (typeFilter !== "all" && item.anomaly_type !== typeFilter) return false;
    if (
      search &&
      !item.resource_name.toLowerCase().includes(search.toLowerCase()) &&
      !item.agent_id.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  const uniqueAgents = Array.from(new Set(anomalies.map((a) => a.agent_id))).filter(Boolean);

  const statItems = [
    {
      label: "Open Scope Drift Anomalies",
      value: openCount.toString(),
      subtext: "Unbaseline tool/data accesses",
      valueClassName: openCount > 0 ? "text-bad" : "text-good",
    },
    {
      label: "Resolved & Approved",
      value: resolvedCount.toString(),
      subtext: "Incorporated into agent baseline",
      valueClassName: "text-good",
    },
    {
      label: "Active Baseline Entries",
      value: baselines.length.toString(),
      subtext: "Approved agent capability registry",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
            Scope Drift & Anomaly Detection
          </h1>
          <p className="text-xs text-inkDim mt-1">
            Detects when agents call unapproved external tools or touch unauthorized database tables outside their baseline.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1 border border-border bg-surface p-1 text-xs">
          <button
            onClick={() => setActiveTab("anomalies")}
            className={`px-3 py-1 text-xs font-mono font-medium transition-colors ${
              activeTab === "anomalies" ? "bg-ink text-paper" : "text-inkDim hover:text-ink"
            }`}
          >
            Anomalies ({anomalies.length})
          </button>
          <button
            onClick={() => setActiveTab("baselines")}
            className={`px-3 py-1 text-xs font-mono font-medium transition-colors ${
              activeTab === "baselines" ? "bg-ink text-paper" : "text-inkDim hover:text-ink"
            }`}
          >
            Baseline Registry ({baselines.length})
          </button>
        </div>
      </div>

      {/* Single Bordered Flex Container with Internal Dividers (.stat-row) */}
      <StatRow items={statItems} />

      {activeTab === "anomalies" ? (
        <>
          {/* Filters Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border border-border bg-surface p-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <input
                className="h-8 w-56 border border-border bg-paper px-3 text-xs text-ink placeholder-inkFaint focus:border-borderStrong focus:outline-none"
                placeholder="Search resource or agent..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <select
                className="h-8 border border-border bg-paper px-3 text-xs text-ink focus:border-borderStrong focus:outline-none"
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
              >
                <option value="all">All Agents</option>
                {uniqueAgents.map((agent) => (
                  <option key={agent} value={agent}>{agent}</option>
                ))}
              </select>

              <select
                className="h-8 border border-border bg-paper px-3 text-xs text-ink focus:border-borderStrong focus:outline-none"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="open">Open Incidents</option>
                <option value="resolved">Resolved Only</option>
                <option value="all">All Statuses</option>
              </select>

              <select
                className="h-8 border border-border bg-paper px-3 text-xs text-ink focus:border-borderStrong focus:outline-none"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="all">All Anomaly Types</option>
                <option value="new_tool">New Tool Calls</option>
                <option value="new_resource">New Data Resources</option>
              </select>
            </div>
          </div>

          {/* Anomaly Rows with subtle inset accent (shadow-[inset_2px_0_0_color] on first cell) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-[10.5px] font-medium uppercase tracking-wide text-inkFaint font-sans">
                Detected Scope-Drift Incidents ({filtered.length})
              </span>
            </div>

            {filtered.length > 0 ? (
              <div className="divide-y divide-border border border-border bg-surface">
                {filtered.map((item) => {
                  const isTool = item.anomaly_type === "new_tool";
                  const insetColor = item.resolved ? "#3D6B4F" : isTool ? "#8C3A32" : "#8A6A2C";

                  return (
                    <div
                      key={item.id}
                      className="p-4 space-y-3 transition-colors hover:bg-paper/60"
                      style={{
                        boxShadow: `inset 2px 0 0 ${insetColor}`,
                      }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                        <div className="flex items-center gap-3">
                          <Badge variant={item.resolved ? "good" : isTool ? "bad" : "warn"}>
                            {item.resolved ? "RESOLVED (APPROVED)" : isTool ? "UNAPPROVED TOOL" : "UNEXPECTED RESOURCE"}
                          </Badge>
                          <span className="font-mono text-xs text-ink">
                            agent: <strong className="text-accent">{item.agent_id}</strong>
                          </span>
                        </div>

                        <div className="flex items-center gap-3 font-mono text-xs text-inkDim">
                          <span className="text-[11px]">{new Date(item.detected_at).toLocaleString()}</span>
                          {item.trace_id && (
                            <Link href={`/traces/${item.trace_id}`} className="text-accent hover:underline flex items-center gap-0.5 text-xs">
                              Trace <ArrowUpRight size={11} />
                            </Link>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {isTool ? <Wrench size={13} className="text-bad" /> : <Database size={13} className="text-warn" />}
                            <span className="font-mono text-xs font-bold text-ink border border-border bg-paper px-2 py-0.5">
                              {item.resource_name}
                            </span>
                          </div>
                          {item.details?.reason && (
                            <p className="text-xs text-inkDim pt-0.5">{item.details.reason}</p>
                          )}
                        </div>

                        {!item.resolved ? (
                          <Button
                            onClick={() => void handleMarkExpected(item)}
                            disabled={resolvingId === item.id}
                            className="border border-good bg-good text-white text-xs h-7 px-3 flex items-center gap-1.5 hover:bg-good/90"
                          >
                            <CheckCircle2 size={12} className={resolvingId === item.id ? "animate-spin" : ""} />
                            {resolvingId === item.id ? "Approving..." : "Approve Baseline"}
                          </Button>
                        ) : (
                          <div className="flex items-center gap-1 text-xs text-good font-mono">
                            <CheckCircle2 size={12} /> Approved
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="border border-border bg-surface p-8 text-center text-xs text-inkDim">
                No scope-drift anomalies match the selected filter criteria.
              </div>
            )}
          </div>
        </>
      ) : (
        /* Baseline Inventory */
        <div className="border border-border bg-surface p-4 space-y-4">
          <div className="border-b border-border pb-2">
            <h2 className="text-xs uppercase tracking-wide text-inkFaint font-medium font-sans">
              Approved Capability Baseline Registry
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {baselines.map((b, idx) => (
              <div key={idx} className="border border-border bg-paper p-3 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-inkDim text-[11px]">{b.agent_id}</span>
                  <Badge variant="neutral">{b.resource_type}</Badge>
                </div>
                <div className="font-mono text-ink font-semibold break-all flex items-center gap-1.5">
                  {b.resource_type === "tool" ? <Wrench size={12} className="text-accent shrink-0" /> : <Database size={12} className="text-warn shrink-0" />}
                  <span>{b.resource_name}</span>
                </div>
                <div className="text-[10px] text-inkFaint border-t border-border pt-1 font-mono">
                  Source: {b.added_by}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
