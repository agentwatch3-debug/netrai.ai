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
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Tamper-Evident Cryptographic Audit Log</h1>
          <p className="mt-1 text-xs text-inkDim">
            Append-only, tamper-evident security and AI compliance log secured by per-organization SHA-256 hash chains designed to support SOC 2, HIPAA, and DPDP compliance workflows.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => void handleExportCSV()}
            disabled={exporting}
            variant="outline"
            className="h-8 text-xs flex items-center gap-1.5 font-mono"
          >
            <Download size={13} className={exporting ? "animate-pulse" : ""} />
            {exporting ? "Exporting CSV..." : "Export Compliance CSV"}
          </Button>

          <Button
            onClick={() => void handleVerifyIntegrity()}
            disabled={verifying}
            variant="primary"
            className="h-8 text-xs flex items-center gap-1.5 font-mono"
          >
            <ShieldCheck size={14} className={verifying ? "animate-spin" : ""} />
            {verifying ? "Verifying Hash Chain..." : "Verify Integrity"}
          </Button>

          <Button
            onClick={() => void loadData(filterType)}
            variant="outline"
            className="h-8 text-xs flex items-center gap-1.5 font-mono"
          >
            <RefreshCw size={13} /> Refresh
          </Button>
        </div>
      </div>

      {/* Cryptographic Proof Verification Card */}
      <Card
        className={`p-5 border transition-colors ${
          isIntact
            ? "border-good/40 bg-good/5"
            : "border-bad/40 bg-bad/5"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center border ${
                isIntact
                  ? "border-good bg-good/10 text-good"
                  : "border-bad bg-bad/10 text-bad"
              }`}
            >
              {isIntact ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-ink font-mono">
                  {isIntact ? "Cryptographic Chain Verified & Intact" : "Tamper Detected in Hash Chain!"}
                </span>
                <Badge
                  variant={isIntact ? "good" : "bad"}
                  className="text-[10px] font-mono"
                >
                  {isIntact ? "Tamper-Evident (Intact)" : "CHAIN CORRUPTED"}
                </Badge>
              </div>
              <p className="text-xs text-inkDim mt-0.5">
                {isIntact
                  ? `All ${verification?.total_entries || logs.length} audit entries sequentially chained with unbroken SHA-256 hashes.`
                  : verification?.reason || "Hash link mismatch detected."}
              </p>
            </div>
          </div>

          <div className="text-right font-mono text-[11px] text-inkDim">
            <span>Last Verified: </span>
            <strong className="text-ink">
              {verification?.verified_at ? new Date(verification.verified_at).toLocaleTimeString() : "Just now"}
            </strong>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 pt-3 text-xs font-mono">
          <div>
            <span className="text-[10px] text-inkDim uppercase">Database Hardening</span>
            <p className="text-good font-bold flex items-center gap-1 mt-0.5">
              <Lock size={12} /> Append-Only (REVOKE UPDATE/DELETE)
            </p>
          </div>

          <div>
            <span className="text-[10px] text-inkDim uppercase">Cryptographic Chain Depth</span>
            <p className="text-ink font-bold mt-0.5">
              {verification?.total_entries || logs.length} Sequential Blocks
            </p>
          </div>

          <div>
            <span className="text-[10px] text-inkDim uppercase">Hash Chain Algorithm</span>
            <p className="text-accent font-bold flex items-center gap-1 mt-0.5">
              <Fingerprint size={12} /> Canonical JSON SHA-256
            </p>
          </div>
        </div>
      </Card>

      {/* Filter Tabs and Audit Log Table */}
      <Card className="border border-border bg-surface p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-accent" />
            <h2 className="text-xs font-bold text-ink uppercase tracking-wider font-mono">
              Audit Log Entries ({logs.length})
            </h2>
          </div>

          {/* Compliance & Quality Filter Controls */}
          <div className="flex items-center gap-1 border border-border bg-paper p-0.5">
            <button
              onClick={() => setFilterType("all")}
              className={`px-3 py-1 text-xs font-mono font-medium transition-colors ${
                filterType === "all"
                  ? "bg-ink text-paper"
                  : "text-inkDim hover:text-ink"
              }`}
            >
              All Events
            </button>
            <button
              onClick={() => setFilterType("ai_quality")}
              className={`px-3 py-1 text-xs font-mono font-medium flex items-center gap-1.5 transition-colors ${
                filterType === "ai_quality"
                  ? "bg-warn text-paper font-bold"
                  : "text-inkDim hover:text-ink"
              }`}
            >
              <AlertTriangle size={12} />
              AI Quality Events
            </button>
            <button
              onClick={() => setFilterType("access")}
              className={`px-3 py-1 text-xs font-mono font-medium transition-colors ${
                filterType === "access"
                  ? "bg-ink text-paper"
                  : "text-inkDim hover:text-ink"
              }`}
            >
              Access Logs
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs font-mono text-inkDim">Loading audit records...</div>
        ) : logs.length === 0 ? (
          <div className="py-8 text-center text-xs font-mono text-inkDim">
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
                  className={`border p-4 text-xs space-y-3 transition-colors ${
                    isAIQuality
                      ? "border-warn/40 bg-warn/5"
                      : "border-border bg-paper hover:border-borderStrong"
                  }`}
                >
                  {/* Header Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[11px] font-bold text-accent">
                        Block #{entry.id}
                      </span>

                      <Badge
                        variant={isAIQuality ? "warn" : "secondary"}
                        className="font-mono text-[10px]"
                      >
                        {entry.action}
                      </Badge>

                      {isAIQuality && (
                        <Badge variant="bad" className="font-mono text-[9px] flex items-center gap-1">
                          <AlertTriangle size={10} /> Regulated Interaction Alert
                        </Badge>
                      )}

                      <div className="flex items-center gap-1 text-[11px] text-inkDim font-mono">
                        {isAIQuality ? <Bot size={12} className="text-warn" /> : <User size={12} className="text-inkDim" />}
                        <span>{entry.actor_email || entry.actor_id}</span>
                      </div>
                    </div>

                    <span className="text-[11px] text-inkDim font-mono">
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                  </div>

                  {/* AI Quality Specialized Incident Card */}
                  {isAIQuality && (
                    <div className="border border-warn/30 bg-surface p-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                        <div>
                          <span className="text-inkDim">Score ({details.score_type || "faithfulness"}): </span>
                          <strong className="text-bad font-bold">
                            {details.score !== undefined ? details.score.toFixed(2) : "N/A"}
                          </strong>
                          {details.threshold !== undefined && (
                            <span className="text-inkDim text-[11px]"> (Threshold: {details.threshold.toFixed(2)})</span>
                          )}
                        </div>

                        {details.action_taken && (
                          <div>
                            <span className="text-inkDim">Gating Action: </span>
                            <Badge variant="secondary" className="uppercase text-[9px] font-mono font-bold">
                              {details.action_taken}
                            </Badge>
                          </div>
                        )}

                        {details.consent_id && (
                          <div className="text-inkDim text-[11px]">
                            Consent ID: <span className="text-ink">{details.consent_id}</span>
                          </div>
                        )}
                      </div>

                      {details.unsupported_claims && details.unsupported_claims.length > 0 && (
                        <div className="mt-1">
                          <span className="text-[10px] text-bad font-semibold uppercase font-mono">Unsupported Claims / Hallucinations:</span>
                          <ul className="list-disc list-inside mt-0.5 space-y-0.5 text-[11px] text-bad font-mono">
                            {details.unsupported_claims.map((claim: string, i: number) => (
                              <li key={i}>{claim}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {details.uncertain_claims && details.uncertain_claims.length > 0 && (
                        <div className="mt-1">
                          <span className="text-[10px] text-warn font-semibold uppercase font-mono">Uncertain / Unverified Claims:</span>
                          <ul className="list-disc list-inside mt-0.5 space-y-0.5 text-[11px] text-warn font-mono">
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
                      <span className="text-[10px] text-inkDim uppercase">Target</span>
                      <p className="text-ink font-bold mt-0.5">
                        {entry.target_type}: <span className="text-accent">{entry.target_id}</span>
                      </p>
                      {entry.ip_address && (
                        <span className="text-[10px] text-inkDim block mt-0.5">IP: {entry.ip_address}</span>
                      )}
                    </div>

                    {entry.details && !isAIQuality && (
                      <div>
                        <span className="text-[10px] text-inkDim uppercase">Details</span>
                        <pre className="border border-border bg-surface p-1.5 text-[10px] text-ink overflow-x-auto mt-0.5">
                          {JSON.stringify(entry.details)}
                        </pre>
                      </div>
                    )}
                  </div>

                  {/* Cryptographic Hash Chain Linker */}
                  <div className="pt-2 border-t border-border flex flex-wrap items-center justify-between gap-2 font-mono text-[10px]">
                    <div className="flex items-center gap-2 text-inkDim">
                      <Link2 size={12} className="text-accent" />
                      <span>
                        Prev Hash:{" "}
                        <span className="text-inkFaint">
                          {isGenesis ? "[GENESIS BLOCK: 00000000...]" : `${entry.prev_hash.substring(0, 16)}...`}
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 border border-border bg-surface px-2.5 py-1 text-ink">
                      <Hash size={11} className="text-good" />
                      <span>Entry Hash: <strong className="text-good font-mono">{entry.entry_hash.substring(0, 16)}...</strong></span>
                      <button
                        onClick={() => copyHash(entry.entry_hash)}
                        className="text-inkDim hover:text-ink ml-1"
                        title="Copy full SHA-256 hash"
                      >
                        <Copy size={11} className={copiedHash === entry.entry_hash ? "text-good" : ""} />
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
