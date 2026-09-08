"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Search, ShieldAlert, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatRow } from "@/components/ui/stat-row";

interface InjectionAttempt {
  id: number;
  org_id: string;
  agent_id: string;
  trace_id: string;
  span_id: string;
  user_input: string;
  risk_score: number;
  flags: string[];
  action_taken: string;
  created_at: string;
}

interface InjectionConfig {
  injection_threshold: number;
  injection_policy_mode: string;
}

export default function InjectionAttemptsPage() {
  const [attempts, setAttempts] = useState<InjectionAttempt[]>([]);
  const [config, setConfig] = useState<InjectionConfig>({ injection_threshold: 0.7, injection_policy_mode: "block" });
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [minScore, setMinScore] = useState<number>(0.5);
  const [search, setSearch] = useState<string>("");
  const [updatingPolicy, setUpdatingPolicy] = useState(false);

  async function loadData() {
    try {
      const [attRes, cfgRes] = await Promise.all([
        fetch("/api/security/injection-attempts"),
        fetch("/api/security/injection-config"),
      ]);
      if (attRes.ok) {
        const body = await attRes.json();
        setAttempts(body.data || []);
      }
      if (cfgRes.ok) {
        const cfg = await cfgRes.json();
        setConfig(cfg);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleTogglePolicy(newMode: string) {
    setUpdatingPolicy(true);
    try {
      const res = await fetch("/api/security/injection-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ injection_policy_mode: newMode, injection_threshold: config.injection_threshold }),
      });
      if (res.ok) {
        setConfig((prev) => ({ ...prev, injection_policy_mode: newMode }));
      }
    } finally {
      setUpdatingPolicy(false);
    }
  }

  async function handleUpdateThreshold(newThreshold: number) {
    try {
      const res = await fetch("/api/security/injection-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ injection_threshold: newThreshold, injection_policy_mode: config.injection_policy_mode }),
      });
      if (res.ok) {
        setConfig((prev) => ({ ...prev, injection_threshold: newThreshold }));
      }
    } catch {
      // Ignored
    }
  }

  const filtered = attempts.filter((item) => {
    if (selectedAgent !== "all" && item.agent_id !== selectedAgent) return false;
    if (item.risk_score < minScore) return false;
    if (search && !item.user_input.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalBlocked = attempts.filter((a) => a.action_taken === "blocked").length;
  const highRiskCount = attempts.filter((a) => a.risk_score >= 0.85).length;
  const uniqueAgents = Array.from(new Set(attempts.map((a) => a.agent_id))).filter(Boolean);

  const statItems = [
    {
      label: "Interception Policy",
      value: config.injection_policy_mode === "block" ? "Inline Block (403)" : "Alert & Monitor",
      subtext: `Sensitivity threshold: ${(config.injection_threshold * 100).toFixed(0)}%`,
      badge: (
        <Badge variant={config.injection_policy_mode === "block" ? "good" : "warn"}>
          {config.injection_policy_mode.toUpperCase()}
        </Badge>
      ),
    },
    {
      label: "Total Blocked Threats",
      value: totalBlocked.toString(),
      subtext: "Malicious payloads prevented",
      valueClassName: "text-bad",
    },
    {
      label: "High-Risk Attacks (>=0.85)",
      value: highRiskCount.toString(),
      subtext: "Instruction override / jailbreaks",
      valueClassName: highRiskCount > 0 ? "text-bad" : "text-good",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
            Prompt Security & Injection Shield
          </h1>
          <p className="text-xs text-inkDim mt-1">
            Real-time heuristic & Presidio pattern detection intercepting prompt injections, jailbreaks, and system prompt leaks.
          </p>
        </div>

        {/* Policy Toggle Controls */}
        <div className="flex items-center gap-2 border border-border bg-surface p-1 text-xs">
          <button
            onClick={() => void handleTogglePolicy("block")}
            disabled={updatingPolicy}
            className={`px-3 py-1 text-xs font-mono font-medium transition-colors ${
              config.injection_policy_mode === "block"
                ? "bg-ink text-paper"
                : "text-inkDim hover:text-ink"
            }`}
          >
            Block Mode
          </button>
          <button
            onClick={() => void handleTogglePolicy("alert")}
            disabled={updatingPolicy}
            className={`px-3 py-1 text-xs font-mono font-medium transition-colors ${
              config.injection_policy_mode === "alert"
                ? "bg-ink text-paper"
                : "text-inkDim hover:text-ink"
            }`}
          >
            Alert Mode
          </button>
        </div>
      </div>

      {/* Single Bordered Flex Container with Internal Dividers (.stat-row) */}
      <StatRow items={statItems} />

      {/* Filter and Sensitivity Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border border-border bg-surface p-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-64">
            <Search size={13} className="absolute left-2.5 top-2.5 text-inkFaint" />
            <input
              className="w-full h-8 border border-border bg-paper pl-8 pr-3 text-xs text-ink placeholder-inkFaint focus:border-borderStrong focus:outline-none"
              placeholder="Search prompt payload..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

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

          <div className="flex items-center gap-1.5 text-xs text-inkDim font-mono">
            <span>Min Score:</span>
            <select
              className="h-8 border border-border bg-paper px-2 text-xs text-ink focus:border-borderStrong focus:outline-none"
              value={minScore}
              onChange={(e) => setMinScore(parseFloat(e.target.value))}
            >
              <option value={0.5}>&ge; 0.50 (All Flagged)</option>
              <option value={0.7}>&ge; 0.70 (Standard Threshold)</option>
              <option value={0.85}>&ge; 0.85 (High Risk)</option>
              <option value={0.95}>&ge; 0.95 (Critical)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-inkDim font-mono">
          <span>Threshold:</span>
          <input
            type="range"
            min="0.4"
            max="0.95"
            step="0.05"
            value={config.injection_threshold}
            onChange={(e) => void handleUpdateThreshold(parseFloat(e.target.value))}
            className="w-24 cursor-pointer accent-accent"
          />
          <strong className="text-ink font-bold">{config.injection_threshold.toFixed(2)}</strong>
        </div>
      </div>

      {/* Incident Log Rows with subtle inset accent (shadow-[inset_2px_0_0_color] on first cell) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <span className="text-[10.5px] font-medium uppercase tracking-wide text-inkFaint font-sans">
            Detected Prompt Injection Incidents ({filtered.length})
          </span>
        </div>

        {filtered.length > 0 ? (
          <div className="divide-y divide-border border border-border bg-surface">
            {filtered.map((item) => {
              const isBlocked = item.action_taken === "blocked";
              const isHigh = item.risk_score >= 0.85;
              const insetColor = isHigh || isBlocked ? "#8C3A32" : "#8A6A2C";

              return (
                <div
                  key={item.id}
                  className="p-4 space-y-2.5 transition-colors hover:bg-paper/60"
                  style={{
                    boxShadow: `inset 2px 0 0 ${insetColor}`,
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <Badge variant={isBlocked ? "bad" : "warn"}>
                        {isBlocked ? "BLOCKED" : "FLAGGED"}
                      </Badge>
                      <span className="font-mono text-xs text-ink">
                        agent: <strong className="text-accent">{item.agent_id}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-3 font-mono text-xs text-inkDim">
                      <div>
                        risk: <strong className={isHigh ? "text-bad font-bold" : "text-warn"}>{(item.risk_score * 100).toFixed(0)}%</strong>
                      </div>
                      <span>•</span>
                      <span className="text-[11px]">{new Date(item.created_at).toLocaleString()}</span>
                      {item.trace_id && (
                        <Link href={`/traces/${item.trace_id}`} className="text-accent hover:underline flex items-center gap-0.5 text-xs">
                          Trace <ArrowUpRight size={11} />
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Flag Tags */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {item.flags.map((flag) => (
                      <span key={flag} className="border border-border bg-paper px-1.5 py-0.5 font-mono text-[10px] text-bad">
                        {flag}
                      </span>
                    ))}
                  </div>

                  {/* Flagged Payload Box */}
                  <div className="border border-border bg-paper p-2.5 font-mono text-xs text-ink">
                    <p className="line-clamp-2">{item.user_input}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="border border-border bg-surface p-8 text-center text-xs text-inkDim">
            No injection attempts match the selected filter criteria.
          </div>
        )}
      </div>
    </div>
  );
}
