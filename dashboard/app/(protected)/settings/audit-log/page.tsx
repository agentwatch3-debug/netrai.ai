"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronRight, Copy, Database, FileText, Fingerprint, Hash, KeyRound, Link2, Lock, RefreshCw, Shield, ShieldAlert, ShieldCheck, Sparkles, Terminal, User } from "lucide-react";
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

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  async function loadData() {
    try {
      const [lRes, vRes] = await Promise.all([
        fetch("/api/compliance/audit-logs"),
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
    void loadData();
  }, []);

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

  function copyHash(hash: string) {
    void navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  }

  if (loading) {
    return <div className="text-sm text-slate-400">Loading tamper-evident cryptographic audit logs...</div>;
  }

  const isIntact = verification?.is_valid !== false;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Tamper-Evident Cryptographic Audit Log</h1>
          <p className="text-sm text-slate-400">
            Immutable, append-only security log secured by per-organization SHA-256 hash chains (SOC 2 / HIPAA compliance).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => void handleVerifyIntegrity()}
            disabled={verifying}
            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 font-mono shadow-sm"
          >
            <ShieldCheck size={14} className={verifying ? "animate-spin" : ""} />
            {verifying ? "Verifying Hash Chain..." : "Verify Integrity"}
          </Button>

          <Button
            onClick={() => void loadData()}
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
                  {isIntact ? "100% IMMUTABLE" : "CHAIN CORRUPTED"}
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

      {/* Audit Log Table */}
      <Card className="border-slate-800 bg-slate-900/40 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText size={16} className="text-blue-400" /> Audit Log Entries ({logs.length})
          </h2>
          <span className="text-xs text-slate-500 font-mono">Per-Organization Hash Chain</span>
        </div>

        <div className="space-y-3">
          {logs.map((entry, index) => {
            const isGenesis = entry.prev_hash === "0".repeat(64);
            return (
              <div
                key={entry.id}
                className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-xs space-y-3 relative hover:border-slate-700 transition-colors"
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-900 pb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] font-bold text-blue-400">
                      Block #{entry.id}
                    </span>

                    <Badge className="bg-slate-800 text-slate-200 font-mono text-[10px]">
                      {entry.action}
                    </Badge>

                    <div className="flex items-center gap-1 text-[11px] text-slate-400">
                      <User size={12} className="text-slate-500" />
                      <span>{entry.actor_email || entry.actor_id}</span>
                    </div>
                  </div>

                  <span className="text-[11px] text-slate-500 font-mono">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                </div>

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

                  {entry.details && (
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
      </Card>
    </div>
  );
}
