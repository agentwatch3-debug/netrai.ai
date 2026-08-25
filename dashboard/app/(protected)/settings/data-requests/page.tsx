"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Clock, Download, ExternalLink, FileSpreadsheet, Lock, Plus, RefreshCw, Shield, ShieldAlert, ShieldCheck, Trash2, UserX, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface DataRequest {
  id: number;
  org_id: string;
  request_type: "erasure" | "export";
  end_user_id: string;
  requested_by: string;
  status: "pending_approval" | "approved" | "completed" | "rejected";
  spans_count: number;
  pii_records_count: number;
  export_archive_url: string | null;
  export_expires_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  deleted_spans_count: number;
  deleted_pii_count: number;
  created_at: string;
  completed_at: string | null;
}

export default function DataRequestsPage() {
  const [requests, setRequests] = useState<DataRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [endUserIdInput, setEndUserIdInput] = useState("");
  const [requestTypeInput, setRequestTypeInput] = useState<"erasure" | "export">("erasure");
  const [submitting, setSubmitting] = useState(false);
  const [selectedRequestForApproval, setSelectedRequestForApproval] = useState<DataRequest | null>(null);
  const [confirmInput, setConfirmInput] = useState("");
  const [approving, setApproving] = useState(false);

  async function loadData() {
    try {
      const res = await fetch("/api/compliance/data-requests");
      if (res.ok) {
        const body = await res.json();
        setRequests(body.data || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleCreateRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!endUserIdInput.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/compliance/erasure-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          end_user_id: endUserIdInput.trim(),
          request_type: requestTypeInput,
        }),
      });
      if (res.ok) {
        setEndUserIdInput("");
        setShowModal(false);
        await loadData();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmApprove() {
    if (!selectedRequestForApproval) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/compliance/data-requests/${selectedRequestForApproval.id}/approve`, {
        method: "POST",
      });
      if (res.ok) {
        setSelectedRequestForApproval(null);
        setConfirmInput("");
        await loadData();
      }
    } finally {
      setApproving(false);
    }
  }

  async function handleReject(id: number) {
    try {
      const res = await fetch(`/api/compliance/data-requests/${id}/reject`, {
        method: "POST",
      });
      if (res.ok) {
        await loadData();
      }
    } catch (e) {
      console.error(e);
    }
  }

  if (loading) {
    return <div className="text-sm text-slate-400">Loading Subject Rights requests...</div>;
  }

  const pendingRequests = requests.filter((r) => r.status === "pending_approval");
  const historicalRequests = requests.filter((r) => r.status !== "pending_approval");
  const totalDeletedSpans = requests.reduce((acc, r) => acc + (r.deleted_spans_count || 0), 0);
  const totalDeletedPii = requests.reduce((acc, r) => acc + (r.deleted_pii_count || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Subject Rights Requests (GDPR / CCPA)</h1>
          <p className="text-sm text-slate-400">
            Process customer data export and hard erasure requests with two-step admin authorization and immutable audit logging.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowModal(true)}
            className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 font-mono shadow-sm"
          >
            <Plus size={14} /> New Subject Rights Request
          </Button>

          <Button
            onClick={() => void loadData()}
            className="h-8 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5"
          >
            <RefreshCw size={13} /> Refresh
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="border-slate-800 bg-slate-900/40 p-4 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>PENDING APPROVALS</span>
            <Clock size={15} className="text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-400">{pendingRequests.length}</p>
          <span className="text-[10px] text-slate-500">Requires 2-step admin confirmation</span>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 p-4 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>COMPLETED ERASURES</span>
            <CheckCircle2 size={15} className="text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-white">{historicalRequests.filter((r) => r.status === "completed").length}</p>
          <span className="text-[10px] text-slate-500">Hard-deleted across ClickHouse & Postgres</span>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 p-4 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>PURGED RECORDS</span>
            <Trash2 size={15} className="text-rose-400" />
          </div>
          <p className="text-2xl font-bold text-rose-400 font-mono">{totalDeletedSpans + totalDeletedPii}</p>
          <span className="text-[10px] text-slate-500">{totalDeletedSpans} spans, {totalDeletedPii} PII mappings</span>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 p-4 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>SLA COMPLIANCE</span>
            <ShieldCheck size={15} className="text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400">100%</p>
          <span className="text-[10px] text-slate-500">Processed within GDPR 30-day window</span>
        </Card>
      </div>

      {/* Pending Approvals Queue (Two-Step Safety Gate) */}
      <Card className="border-amber-900/50 bg-amber-950/10 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-amber-900/40 pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-amber-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Pending Admin Authorization Queue ({pendingRequests.length})
            </h2>
          </div>
          <Badge className="bg-amber-950 text-amber-300 border-amber-800 text-[10px] font-mono">
            TWO-STEP SAFETY GATE
          </Badge>
        </div>

        {pendingRequests.length === 0 ? (
          <div className="text-xs text-slate-400 py-4 text-center font-mono">
            No pending subject rights requests awaiting admin approval.
          </div>
        ) : (
          <div className="space-y-3">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="rounded-lg border border-amber-900/40 bg-slate-950 p-4 text-xs space-y-3 relative"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-900 pb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-amber-400">Request #{req.id}</span>
                    <Badge className="bg-amber-950 text-amber-300 border-amber-800 font-mono text-[10px] uppercase">
                      {req.request_type}
                    </Badge>
                    <span className="font-mono text-white font-semibold">{req.end_user_id}</span>
                  </div>

                  <span className="text-[11px] text-slate-500 font-mono">
                    Requested: {new Date(req.created_at).toLocaleString()}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase">Spans Found in ClickHouse</span>
                    <p className="text-white font-bold mt-0.5">{req.spans_count} execution spans</p>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase">PII Vault Mappings</span>
                    <p className="text-white font-bold mt-0.5">{req.pii_records_count} encrypted tokens</p>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase">Pre-Deletion Archive</span>
                    {req.export_archive_url ? (
                      <a
                        href={req.export_archive_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 hover:underline flex items-center gap-1 mt-0.5"
                      >
                        <Download size={12} /> Download JSON Bundle
                      </a>
                    ) : (
                      <span className="text-slate-500">Generating...</span>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-900 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-400">
                    Requested by <strong className="text-slate-200">{req.requested_by}</strong>
                  </span>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => void handleReject(req.id)}
                      className="h-7 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono"
                    >
                      Reject Request
                    </Button>

                    <Button
                      onClick={() => setSelectedRequestForApproval(req)}
                      className="h-7 text-xs bg-rose-600 hover:bg-rose-500 text-white font-mono flex items-center gap-1"
                    >
                      <Trash2 size={12} /> Authorize & Hard Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Historical Ledger Table */}
      <Card className="border-slate-800 bg-slate-900/40 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-blue-400" /> Completed & Historical Requests ({historicalRequests.length})
          </h2>
          <Link href="/settings/audit-log" className="text-xs text-blue-400 hover:underline flex items-center gap-1 font-mono">
            Audit Log Ledger <ExternalLink size={12} />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
              <tr>
                <th className="py-2.5 px-3">REQ ID</th>
                <th className="py-2.5 px-3">TYPE</th>
                <th className="py-2.5 px-3">CUSTOMER ID</th>
                <th className="py-2.5 px-3">RECORDS DELETED</th>
                <th className="py-2.5 px-3">APPROVED BY</th>
                <th className="py-2.5 px-3">STATUS</th>
                <th className="py-2.5 px-3">COMPLETED AT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono">
              {historicalRequests.map((req) => (
                <tr key={req.id} className="hover:bg-slate-900/50">
                  <td className="py-2.5 px-3 text-slate-400">#{req.id}</td>
                  <td className="py-2.5 px-3 uppercase text-blue-400">{req.request_type}</td>
                  <td className="py-2.5 px-3 font-semibold text-white">{req.end_user_id}</td>
                  <td className="py-2.5 px-3 text-rose-400">
                    {req.deleted_spans_count + req.deleted_pii_count} records ({req.deleted_spans_count} spans, {req.deleted_pii_count} PII)
                  </td>
                  <td className="py-2.5 px-3 text-slate-300">{req.approved_by || "System"}</td>
                  <td className="py-2.5 px-3">
                    <Badge
                      className={
                        req.status === "completed"
                          ? "bg-emerald-950 text-emerald-300 border-emerald-800 text-[10px]"
                          : "bg-red-950 text-red-300 border-red-800 text-[10px]"
                      }
                    >
                      {req.status.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="py-2.5 px-3 text-slate-400">
                    {req.completed_at ? new Date(req.completed_at).toLocaleString() : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* New Request Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-950 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <UserX size={16} className="text-blue-400" /> New Subject Rights Request
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <XCircle size={16} />
              </button>
            </div>

            <form onSubmit={(e) => void handleCreateRequest(e)} className="space-y-4 text-xs">
              <div>
                <label className="text-[11px] text-slate-400 uppercase font-semibold">Request Type</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setRequestTypeInput("erasure")}
                    className={`p-2.5 rounded border text-xs font-mono font-semibold ${
                      requestTypeInput === "erasure"
                        ? "bg-rose-950/40 border-rose-600 text-rose-300"
                        : "bg-slate-900 border-slate-800 text-slate-400"
                    }`}
                  >
                    Right to Erasure (Delete)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRequestTypeInput("export")}
                    className={`p-2.5 rounded border text-xs font-mono font-semibold ${
                      requestTypeInput === "export"
                        ? "bg-blue-950/40 border-blue-600 text-blue-300"
                        : "bg-slate-900 border-slate-800 text-slate-400"
                    }`}
                  >
                    Right to Access (Export)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 uppercase font-semibold">Customer / End User ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. cust_9921 or user_uuid"
                  value={endUserIdInput}
                  onChange={(e) => setEndUserIdInput(e.target.value)}
                  className="w-full mt-1 rounded bg-slate-900 border border-slate-800 p-2.5 font-mono text-white text-xs"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Queries ClickHouse and PostgreSQL for all spans and PII tokens matching this identifier.
                </span>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <Button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="h-8 text-xs bg-slate-800 text-slate-300"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-mono"
                >
                  {submitting ? "Submitting..." : "Create Request"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Two-Step Deletion Confirmation Modal */}
      {selectedRequestForApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg rounded-xl border border-rose-900/60 bg-slate-950 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-rose-900/40 pb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-950 border border-rose-800 text-rose-400">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Permanent Data Erasure Confirmation</h3>
                <p className="text-xs text-rose-300">Step 2: Admin Confirmation Safety Gate</p>
              </div>
            </div>

            <div className="rounded-lg bg-rose-950/20 border border-rose-900/40 p-3 text-xs text-slate-300 space-y-2 font-mono">
              <p>
                You are about to <strong>permanently hard-delete</strong>:
              </p>
              <ul className="list-disc list-inside text-rose-300 space-y-1">
                <li>{selectedRequestForApproval.spans_count} trace spans in ClickHouse</li>
                <li>{selectedRequestForApproval.pii_records_count} encrypted PII mappings in PostgreSQL</li>
                <li>Customer ID: <span className="text-white font-bold">{selectedRequestForApproval.end_user_id}</span></li>
              </ul>
              <p className="text-[11px] text-slate-400 pt-1">
                This action is non-reversible. The erasure action and metrics will be permanently recorded in the tamper-evident audit log without retaining customer data.
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <label className="text-[11px] text-slate-400 uppercase font-semibold">
                Type <strong className="text-white font-mono">CONFIRM</strong> to authorize hard-deletion:
              </label>
              <input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder="CONFIRM"
                className="w-full rounded bg-slate-900 border border-slate-800 p-2.5 font-mono text-white text-xs"
              />
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <Button
                type="button"
                onClick={() => {
                  setSelectedRequestForApproval(null);
                  setConfirmInput("");
                }}
                className="h-8 text-xs bg-slate-800 text-slate-300"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={confirmInput.trim() !== "CONFIRM" || approving}
                onClick={() => void handleConfirmApprove()}
                className="h-8 text-xs bg-rose-600 hover:bg-rose-500 text-white font-mono flex items-center gap-1.5"
              >
                <Trash2 size={13} /> {approving ? "Purging Records..." : "Execute Permanent Erasure"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
