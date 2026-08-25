"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, CheckCircle2, Filter, Lock, Radio, Search, ShieldAlert, ShieldCheck, Sliders, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
      // Ignored in preview
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

  if (loading) {
    return <div className="text-sm text-slate-400">Loading prompt security telemetry...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Prompt Injection Shield & Security Incidents</h1>
          <p className="text-sm text-slate-400">
            Real-time pre-execution prompt injection defense, jailbreak prevention, and incident audit log.
          </p>
        </div>
      </div>

      {/* Security Shield Hero Metrics */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-slate-800 bg-slate-900/40 p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase font-semibold">Active Protection Policy</span>
            <ShieldAlert size={16} className={config.injection_policy_mode === "block" ? "text-red-400" : "text-amber-400"} />
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-base font-bold text-white font-mono">
              {config.injection_policy_mode === "block" ? "Strict (Block & Protect)" : "Audit & Alert Only"}
            </span>
            <Badge className={config.injection_policy_mode === "block" ? "bg-red-950 text-red-300 border-red-800" : "bg-amber-950 text-amber-300 border-amber-800"}>
              {config.injection_policy_mode.toUpperCase()}
            </Badge>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Button
              onClick={() => void handleTogglePolicy(config.injection_policy_mode === "block" ? "alert" : "block")}
              disabled={updatingPolicy}
              className="h-7 text-xs bg-slate-800 hover:bg-slate-700 w-full"
            >
              Switch to {config.injection_policy_mode === "block" ? "Alert Mode" : "Block Mode"}
            </Button>
          </div>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase font-semibold">Total Attacks Blocked</span>
            <Lock size={16} className="text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400 font-mono pt-1">{totalBlocked}</p>
          <p className="text-[11px] text-slate-500">Prevented from executing against LLM models</p>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase font-semibold">High-Risk Interceptions (&ge;0.85)</span>
            <AlertTriangle size={16} className="text-red-400" />
          </div>
          <p className="text-2xl font-bold text-red-400 font-mono pt-1">{highRiskCount}</p>
          <p className="text-[11px] text-slate-500">Jailbreak / instruction-override attempts</p>
        </Card>
      </div>

      {/* Filter and Sensitivity Toolbar */}
      <Card className="border-slate-800 bg-slate-900/40 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative w-64">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
              <input
                className="w-full h-8 rounded border border-slate-800 bg-slate-950 pl-8 pr-3 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                placeholder="Search prompt payload..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Agent Selector */}
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

            {/* Min Score Selector */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
              <span>Min Score:</span>
              <select
                className="h-8 rounded border border-slate-800 bg-slate-950 px-2 text-xs text-white focus:border-blue-500 focus:outline-none"
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

          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <span>Detection Threshold:</span>
            <input
              type="range"
              min="0.4"
              max="0.95"
              step="0.05"
              value={config.injection_threshold}
              onChange={(e) => void handleUpdateThreshold(parseFloat(e.target.value))}
              className="accent-blue-500 w-24 cursor-pointer"
            />
            <strong className="text-white font-bold">{config.injection_threshold.toFixed(2)}</strong>
          </div>
        </div>
      </Card>

      {/* Incident Log Cards */}
      <div className="space-y-4">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Detected Prompt Injection Incidents ({filtered.length})
        </span>

        {filtered.length > 0 ? (
          <div className="space-y-3">
            {filtered.map((item) => {
              const isBlocked = item.action_taken === "blocked";

              return (
                <Card key={item.id} className="border-slate-800 bg-slate-900/30 p-4 space-y-3 hover:border-slate-700 transition-all">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/60 pb-2">
                    <div className="flex items-center gap-2">
                      <Badge className={isBlocked ? "bg-red-950 text-red-300 border-red-800 font-mono text-[10px]" : "bg-amber-950 text-amber-300 border-amber-800 font-mono text-[10px]"}>
                        {isBlocked ? "BLOCKED (403)" : "FLAGGED & MONITORED"}
                      </Badge>
                      <span className="font-mono text-xs text-slate-300">
                        Agent: <strong className="text-white">{item.agent_id}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-3 font-mono text-xs">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-500 text-[10px] uppercase">Risk Score:</span>
                        <span className={`font-bold ${item.risk_score >= 0.85 ? "text-red-400" : "text-amber-400"}`}>
                          {(item.risk_score * 100).toFixed(0)}%
                        </span>
                      </div>
                      <span>·</span>
                      <span className="text-[11px] text-slate-500">{new Date(item.created_at).toLocaleString()}</span>
                      {item.trace_id && (
                        <Link href={`/traces/${item.trace_id}`} className="text-blue-400 hover:underline flex items-center gap-0.5 text-[10px]">
                          Waterfall <ArrowUpRight size={11} />
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Flag Badges */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {item.flags.map((flag) => (
                      <span key={flag} className="rounded bg-slate-950 border border-slate-800 px-2 py-0.5 font-mono text-[10px] text-red-300">
                        🚩 {flag}
                      </span>
                    ))}
                  </div>

                  {/* Flagged Payload Snippet */}
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-200">
                    <p className="line-clamp-3">{item.user_input}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-12 text-center text-slate-400 text-sm">
            No injection attempts match the selected filter criteria.
          </div>
        )}
      </div>
    </div>
  );
}
