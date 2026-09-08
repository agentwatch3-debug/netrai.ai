"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  Copy,
  Database,
  Download,
  FileText,
  Filter,
  Fingerprint,
  Hash,
  KeyRound,
  Link2,
  Lock,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  User,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface AuditLogEntry {
  id: number;
  org_id: string;
  actor_id: string;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: string;
  details: any;
  ip_address: string | null;
  user_agent: string | null;
  prev_hash: string;
  entry_hash: string;
  created_at: string;
}

interface VerificationResult {
  is_valid: boolean;
  total_entries: number;
  chain_status: "verified" | "tampered" | "empty";
  broken_entry_id: number | null;
  reason: string | null;
  head_hash?: string;
  verified_at: string;
}

type FilterType = "all" | "ai_quality" | "access";

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  async function loadData(currentFilter = filterType) {
    setLoading(true);
    try {
      const url =
        currentFilter === "all"
          ? "/api/compliance/audit-logs"
          : `/api/compliance/audit-logs?filter_type=${currentFilter}`;
      const [lRes, vRes] = await Promise.all([
        fetch(url),
        fetch("/api/compliance/verify-audit-log"),
      ]);
      if (lRes.ok) {
        const body = await lRes.json();
        setLogs(body.data || []);
      }
      if (vRes.ok) {
        const body = await vRes.json();
        setVerification(body);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData(filterType);
  }, [filterType]);

  async function handleVerifyIntegrity() {
    setVerifying(true);
    try {
      const res = await fetch("/api/compliance/verify-audit-log");
      if (res.ok) {
        const body: VerificationResult = await res.json();
        setVerification(body);
      }
    } finally {
      setVerifying(false);
    }
  }

  async function handleExportCSV() {
    setExporting(true);
    try {
      const res = await fetch("/api/compliance/audit-export?format=csv");
      if (res.ok) {
        const blob = await res.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `audit-compliance-export-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
      }
    } finally {
      setExporting(false);
    }
  }

  function copyHash(hash: string) {
    void navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  }

  const isIntact = verification?.is_valid !== false;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Tamper-Evident Cryptographic Audit Log</h1>
          <p className="text-sm text-slate-400">
            Append-only, tamper-evident security and AI compliance log secured by per-organization SHA-256 hash chains designed to support SOC 2, HIPAA, and DPDP compliance workflows.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => void handleExportCSV()}
            disabled={exporting}
            className="h-8 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 font-mono shadow-sm"
          >
            <Download size={13} className={exporting ? "animate-pulse" : ""} />
            {exporting ? "Exporting CSV..." : "Export Compliance CSV"}
          </Button>

          <Button
            onClick={() => void handleVerifyIntegrity()}
            disabled={verifying}
            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 font-mono shadow-sm"
          >
            <ShieldCheck size={14} className={verifying ? "animate-spin" : ""} />
            {verifying ? "Verifying Hash Chain..." : "Verify Integrity"}
          </Button>

          <Button
            onClick={() => void loadData(filterType)}
            className="h-8 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5"
          >
            <RefreshCw size={13} /> Refresh
          </Button>
        </div>
      </div>

      {/* Cryptographic Proof Verification Card */}
      <Card
        className={`p-5 border transition-all ${
          isIntact
            ? "border-emerald-900/60 bg-emerald-950/20"
            : "border-red-900/60 bg-red-950/20"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/60 pb-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                isIntact
                  ? "bg-emerald-950 border-emerald-700 text-emerald-400"
                  : "bg-red-950 border-red-700 text-red-400"
              }`}
            >
              {isIntact ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">
                  {isIntact ? "Cryptographic Chain Verified & Intact" : "Tamper Detected in Hash Chain!"}
                </span>
                <Badge
                  className={
                    isIntact
                      ? "bg-emerald-950 text-emerald-300 border-emerald-800 text-[10px] font-mono"
                      : "bg-red-950 text-red-300 border-red-800 text-[10px] font-mono"
                  }
                >
                  {isIntact ? "Tamper-Evident (Intact)" : "CHAIN CORRUPTED"}
                </Badge>
              </div>
              <p className="text-xs text-slate-400">
                {isIntact
                  ? `All ${verification?.total_entries || logs.length} audit entries sequentially chained with unbroken SHA-256 hashes.`
                  : verification?.reason || "Hash link mismatch detected."}
              </p>
            </div>
          </div>

          <div className="text-right font-mono text-[11px] text-slate-400">
            <span>Last Verified: </span>
            <strong className="text-slate-300">
              {verification?.verified_at ? new Date(verification.verified_at).toLocaleTimeString() : "Just now"}
            </strong>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 pt-3 text-xs font-mono">
          <div>
            <span className="text-[10px] text-slate-500 uppercase">Database Hardening</span>
            <p className="text-emerald-400 font-bold flex items-center gap-1 mt-0.5">
              <Lock size={12} /> Append-Only (REVOKE UPDATE/DELETE)
            </p>
          </div>

          <div>
            <span className="text-[10px] text-slate-500 uppercase">Cryptographic Chain Depth</span>
            <p className="text-white font-bold mt-0.5">
              {verification?.total_entries || logs.length} Sequential Blocks
            </p>
          </div>

          <div>
            <span className="text-[10px] text-slate-500 uppercase">Hash Chain Algorithm</span>
            <p className="text-blue-400 font-bold flex items-center gap-1 mt-0.5">
              <Fingerprint size={12} /> Canonical JSON SHA-256
            </p>
          </div>
        </div>
      </Card>

      {/* Filter Tabs and Audit Log Table */}
      <Card className="border-slate-800 bg-slate-900/40 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-blue-400" />
            <h2 className="text-sm font-bold text-white">
              Audit Log Entries ({logs.length})
            </h2>
          </div>

          {/* Compliance & Quality Filter Controls */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setFilterType("all")}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                filterType === "all"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              All Events
            </button>
            <button
              onClick={() => setFilterType("ai_quality")}
              className={`px-3 py-1 text-xs rounded-md font-medium flex items-center gap-1.5 transition-colors ${
                filterType === "ai_quality"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-amber-300"
              }`}
            >
              <AlertTriangle size={12} />
              AI Quality Compliance Events
            </button>
            <button
              onClick={() => setFilterType("access")}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                filterType === "access"
                  ? "bg-slate-700 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Access Logs
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-slate-400">Loading audit records...</div>
        ) : logs.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            No audit records found matching the selected filter.
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((entry) => {
              const isGenesis = entry.prev_hash === "0".repeat(64);
              const isAIQuality =
                entry.action === "ungrounded_regulated_response" ||
                entry.details?.is_ai_quality_event ||
                entry.details?.score_type;
              const details = entry.details || {};

              return (
                <div
                  key={entry.id}
                  className={`rounded-lg border p-4 text-xs space-y-3 relative transition-colors ${
                    isAIQuality
                      ? "border-amber-700/60 bg-amber-950/20 hover:border-amber-600"
                      : "border-slate-800 bg-slate-950 hover:border-slate-700"
                  }`}
                >
                  {/* Header Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-900 pb-2">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[11px] font-bold text-blue-400">
                        Block #{entry.id}
                      </span>

                      <Badge
                        className={
                          isAIQuality
                            ? "bg-amber-950 text-amber-300 border-amber-800 font-mono text-[10px]"
                            : "bg-slate-800 text-slate-200 font-mono text-[10px]"
                        }
                      >
                        {entry.action}
                      </Badge>

                      {isAIQuality && (
                        <Badge className="bg-red-950 text-red-300 border-red-800 font-mono text-[9px] flex items-center gap-1">
                          <AlertTriangle size={10} /> Regulated Interaction Alert
                        </Badge>
                      )}

                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        {isAIQuality ? <Bot size={12} className="text-amber-400" /> : <User size={12} className="text-slate-500" />}
                        <span>{entry.actor_email || entry.actor_id}</span>
                      </div>
                    </div>

                    <span className="text-[11px] text-slate-500 font-mono">
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                  </div>

                  {/* AI Quality Specialized Incident Card */}
                  {isAIQuality && (
                    <div className="rounded border border-amber-800/40 bg-slate-900/80 p-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                        <div>
                          <span className="text-slate-400">Score ({details.score_type || "faithfulness"}): </span>
                          <strong className="text-red-400 font-bold">
                            {details.score !== undefined ? details.score.toFixed(2) : "N/A"}
                          </strong>
                          {details.threshold !== undefined && (
                            <span className="text-slate-500 text-[11px]"> (Threshold: {details.threshold.toFixed(2)})</span>
                          )}
                        </div>

                        {details.action_taken && (
                          <div>
                            <span className="text-slate-400">Gating Action: </span>
                            <Badge className="bg-slate-800 text-amber-300 uppercase text-[9px]">
                              {details.action_taken}
                            </Badge>
                          </div>
                        )}

                        {details.consent_id && (
                          <div className="text-slate-400 text-[11px]">
                            Consent ID: <span className="text-slate-200">{details.consent_id}</span>
                          </div>
                        )}
                      </div>

                      {details.unsupported_claims && details.unsupported_claims.length > 0 && (
                        <div className="mt-1">
                          <span className="text-[10px] text-amber-400 font-semibold uppercase">Unsupported Claims / Hallucinations:</span>
                          <ul className="list-disc list-inside mt-0.5 space-y-0.5 text-[11px] text-red-300/90 font-mono">
                            {details.unsupported_claims.map((claim: string, i: number) => (
                              <li key={i}>{claim}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {details.uncertain_claims && details.uncertain_claims.length > 0 && (
                        <div className="mt-1">
                          <span className="text-[10px] text-amber-300 font-semibold uppercase">Uncertain / Unverified Claims:</span>
                          <ul className="list-disc list-inside mt-0.5 space-y-0.5 text-[11px] text-amber-200/90 font-mono">
                            {details.uncertain_claims.map((claim: string, i: number) => (
                              <li key={i}>{claim}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Target & Details */}
                  <div className="grid gap-3 sm:grid-cols-2 text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase">Target</span>
                      <p className="text-slate-300 font-bold mt-0.5">
                        {entry.target_type}: <span className="text-white">{entry.target_id}</span>
                      </p>
                      {entry.ip_address && (
                        <span className="text-[10px] text-slate-500 block mt-0.5">IP: {entry.ip_address}</span>
                      )}
                    </div>

                    {entry.details && !isAIQuality && (
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase">Details</span>
                        <pre className="rounded bg-slate-900/60 p-1.5 text-[10px] text-slate-400 overflow-x-auto mt-0.5">
                          {JSON.stringify(entry.details)}
                        </pre>
                      </div>
                    )}
                  </div>

                  {/* Cryptographic Hash Chain Linker */}
                  <div className="pt-2 border-t border-slate-900 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px]">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Link2 size={12} className="text-blue-400" />
                      <span>
                        Prev Hash:{" "}
                        <span className="text-slate-500">
                          {isGenesis ? "[GENESIS BLOCK: 00000000...]" : `${entry.prev_hash.substring(0, 16)}...`}
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1 rounded border border-slate-800 text-slate-300">
                      <Hash size={11} className="text-emerald-400" />
                      <span>Entry Hash: <strong className="text-emerald-300">{entry.entry_hash.substring(0, 16)}...</strong></span>
                      <button
                        onClick={() => copyHash(entry.entry_hash)}
                        className="text-slate-500 hover:text-white ml-1"
                        title="Copy full SHA-256 hash"
                      >
                        <Copy size={11} className={copiedHash === entry.entry_hash ? "text-emerald-400" : ""} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
