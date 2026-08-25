"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, CheckCircle2, Download, FileSpreadsheet, FileText, Lock, PlusCircle, ShieldAlert, ShieldCheck, UserCheck, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ConsentRecord {
  id: number;
  org_id: string;
  user_id: string;
  consent_type: string;
  granted_at: string;
  revoked_at: string | null;
  consent_reference: string;
}

interface ComplianceGap {
  id: number;
  org_id: string;
  trace_id: string;
  span_id: string;
  agent_id: string;
  user_id: string;
  pii_types: string[];
  gap_reason: string;
  detected_at: string;
  resolved: boolean;
}

export default function ConsentCompliancePage() {
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [gaps, setGaps] = useState<ComplianceGap[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"gaps" | "consents">("gaps");
  const [exporting, setExporting] = useState(false);

  // New Consent Form State
  const [showModal, setShowModal] = useState(false);
  const [newUserId, setNewUserId] = useState("");
  const [newConsentType, setNewConsentType] = useState("ai_processing");
  const [newRef, setNewRef] = useState("");
  const [creating, setCreating] = useState(false);

  async function loadData() {
    try {
      const [cRes, gRes] = await Promise.all([
        fetch("/api/consents"),
        fetch("/api/compliance/gaps"),
      ]);
      if (cRes.ok) {
        const body = await cRes.json();
        setConsents(body.data || []);
      }
      if (gRes.ok) {
        const body = await gRes.json();
        setGaps(body.data || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleExportCSV() {
    setExporting(true);
    try {
      const res = await fetch("/api/compliance/consent-report?format=csv");
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "consent_audit_report.csv";
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } finally {
      setExporting(false);
    }
  }

  async function handleCreateConsent(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/consents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: newUserId,
          consent_type: newConsentType,
          consent_reference: newRef,
        }),
      });
      if (res.ok) {
        setShowModal(false);
        setNewUserId("");
        setNewRef("");
        await loadData();
      }
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-slate-400">Loading Consent Linkage & Compliance records...</div>;
  }

  const openGapsCount = gaps.filter((g) => !g.resolved).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Consent-Linkage & PII Compliance Audit</h1>
          <p className="text-sm text-slate-400">
            Track user consent linkage across agent spans, detect unconsented PII accesses, and export audit reports.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => void handleExportCSV()}
            disabled={exporting}
            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 font-semibold"
          >
            <Download size={13} className={exporting ? "animate-spin" : ""} />
            {exporting ? "Exporting..." : "Export CSV Consent Report"}
          </Button>

          <Button
            onClick={() => setShowModal(true)}
            className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5"
          >
            <PlusCircle size={13} /> Grant User Consent
          </Button>
        </div>
      </div>

      {/* Hero Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-slate-800 bg-slate-900/40 p-5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase font-semibold">Active User Consents</span>
            <UserCheck size={16} className="text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-white font-mono pt-1">{consents.length}</p>
          <p className="text-[11px] text-slate-500">Registered terms & AI processing grants</p>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 p-5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase font-semibold">Unlinked PII Compliance Gaps</span>
            <ShieldAlert size={16} className={openGapsCount > 0 ? "text-red-400" : "text-emerald-400"} />
          </div>
          <p className={`text-2xl font-bold font-mono pt-1 ${openGapsCount > 0 ? "text-red-400" : "text-emerald-400"}`}>
            {openGapsCount}
          </p>
          <p className="text-[11px] text-slate-500">Spans where PII was accessed without consent_id</p>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 p-5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase font-semibold">Compliance Status</span>
            <ShieldCheck size={16} className="text-blue-400" />
          </div>
          <p className="text-base font-bold text-white font-mono pt-2">
            {openGapsCount === 0 ? "100% Verified Compliant" : "Review Required"}
          </p>
          <p className="text-[11px] text-slate-500">Continuous PII masking & consent verification</p>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <Button
          onClick={() => setActiveTab("gaps")}
          className={`h-8 text-xs ${activeTab === "gaps" ? "bg-slate-800 text-white" : "bg-transparent text-slate-400 hover:text-white"}`}
        >
          <ShieldAlert size={13} className="mr-1.5 text-red-400" /> Compliance Gaps ({gaps.length})
        </Button>
        <Button
          onClick={() => setActiveTab("consents")}
          className={`h-8 text-xs ${activeTab === "consents" ? "bg-slate-800 text-white" : "bg-transparent text-slate-400 hover:text-white"}`}
        >
          <FileSpreadsheet size={13} className="mr-1.5 text-emerald-400" /> Registered Consents Ledger ({consents.length})
        </Button>
      </div>

      {activeTab === "gaps" ? (
        /* Compliance Gaps Section */
        <div className="space-y-4">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Unlinked PII Access Events ({gaps.length})
          </span>

          {gaps.length > 0 ? (
            <div className="space-y-3">
              {gaps.map((gap) => (
                <Card key={gap.id} className="border-red-900/40 bg-red-950/20 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-red-900/40 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-red-950 text-red-300 border-red-800 font-mono text-[10px]">
                        🚨 UNLINKED PII ACCESS
                      </Badge>
                      <span className="font-mono text-xs text-slate-300">
                        User: <strong className="text-white">{gap.user_id || "Anonymous"}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-3 font-mono text-xs">
                      <span className="text-[11px] text-slate-500">{new Date(gap.detected_at).toLocaleString()}</span>
                      {gap.trace_id && (
                        <Link href={`/traces/${gap.trace_id}`} className="text-blue-400 hover:underline flex items-center gap-0.5 text-[10px]">
                          Inspect Waterfall <ArrowUpRight size={11} />
                        </Link>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-slate-400">Detected PII Entities:</span>
                        {gap.pii_types.map((type) => (
                          <span key={type} className="rounded bg-red-950/80 border border-red-800/80 px-2 py-0.5 font-mono text-[10px] text-red-300 font-bold">
                            🔒 {type}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-slate-400">{gap.gap_reason}</p>
                    </div>

                    <div className="text-xs font-mono text-slate-400 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded">
                      Span ID: <strong className="text-white">{gap.span_id}</strong>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-12 text-center text-slate-400 text-sm">
              No compliance gaps detected. All PII accesses are mapped to valid user consents.
            </div>
          )}
        </div>
      ) : (
        /* Consents Ledger Section */
        <Card className="border-slate-800 bg-slate-900/40 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Registered User Consent Ledger</h2>
              <p className="text-xs text-slate-400">Valid consent records used to authorize agent PII processing.</p>
            </div>
          </div>

          <div className="space-y-3">
            {consents.map((c) => (
              <div key={c.id} className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-xs space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-900 pb-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800 text-[10px]">
                      {c.consent_type.toUpperCase()}
                    </Badge>
                    <span className="font-mono text-white font-bold">{c.user_id}</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Granted: {new Date(c.granted_at).toLocaleString()}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 font-mono text-[11px] text-slate-400">
                  <span>Reference: <strong className="text-white">{c.consent_reference}</strong></span>
                  <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 size={12} /> Active & Verified</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Grant User Consent Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-md border-slate-800 bg-slate-900 p-6 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <UserCheck size={18} className="text-blue-400" /> Register User Consent Grant
            </h2>

            <form onSubmit={handleCreateConsent} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">User ID</label>
                <input
                  type="text"
                  placeholder="e.g. user_rahul_99"
                  className="w-full h-9 rounded-lg border border-slate-800 bg-slate-950 px-3 text-xs text-white focus:border-blue-500 focus:outline-none"
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Consent Type</label>
                <select
                  className="w-full h-9 rounded-lg border border-slate-800 bg-slate-950 px-3 text-xs text-white focus:border-blue-500 focus:outline-none"
                  value={newConsentType}
                  onChange={(e) => setNewConsentType(e.target.value)}
                >
                  <option value="ai_processing">AI Processing & Automation</option>
                  <option value="support">Customer Support Processing</option>
                  <option value="analytics">Analytics & Metrics</option>
                  <option value="marketing">Marketing Communications</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Consent Reference / Form ID</label>
                <input
                  type="text"
                  placeholder="e.g. FORM_TERMS_V2.1_TS8892"
                  className="w-full h-9 rounded-lg border border-slate-800 bg-slate-950 px-3 text-xs text-white font-mono focus:border-blue-500 focus:outline-none"
                  value={newRef}
                  onChange={(e) => setNewRef(e.target.value)}
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" onClick={() => setShowModal(false)} className="bg-slate-800 hover:bg-slate-700 text-xs">
                  Cancel
                </Button>
                <Button type="submit" disabled={creating} className="bg-blue-600 hover:bg-blue-500 text-xs">
                  {creating ? "Saving..." : "Save Consent"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
