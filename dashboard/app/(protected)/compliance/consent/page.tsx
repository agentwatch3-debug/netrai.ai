"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Download, FileSpreadsheet, FileText, Lock, ShieldAlert, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatRow } from "@/components/ui/stat-row";
import { MaskedPiiChip } from "@/components/ui/masked-pii-chip";

interface ComplianceGap {
  id: string;
  span_id: string;
  trace_id: string;
  agent_id: string;
  span_name: string;
  timestamp: string;
  pii_types: string[];
  gap_reason: string;
}

interface ConsentRecord {
  consent_id: string;
  user_id: string;
  consent_type: string;
  status: string;
  granted_at: string;
  expires_at: string;
  purposes: string[];
}

interface ComplianceResponse {
  summary: {
    total_spans_analyzed: number;
    unlinked_pii_spans_count: number;
    active_consents_count: number;
    dpdp_compliance_rate_pct: number;
  };
  gaps: ComplianceGap[];
  consents: ConsentRecord[];
}

export default function ConsentCompliancePage() {
  const [data, setData] = useState<ComplianceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  async function loadData() {
    try {
      const res = await fetch("/api/compliance/consent");
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleExportCsv() {
    setDownloadingCsv(true);
    try {
      const res = await fetch("/api/compliance/export/csv");
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `dpdp_compliance_audit_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
      }
    } finally {
      setDownloadingCsv(false);
    }
  }

  async function handleExportPdf() {
    setDownloadingPdf(true);
    try {
      const res = await fetch("/api/compliance/export/pdf");
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `dpdp_compliance_report_${new Date().toISOString().slice(0, 10)}.pdf`;
        a.click();
      }
    } finally {
      setDownloadingPdf(false);
    }
  }

  const summary = data?.summary;
  const gaps = data?.gaps || [];
  const consents = data?.consents || [];

  const statItems = [
    {
      label: "DPDP India Compliance Rate",
      value: `${summary?.dpdp_compliance_rate_pct ?? 100}%`,
      subtext: "Continuous PII & consent verification",
      valueClassName: (summary?.dpdp_compliance_rate_pct ?? 100) < 100 ? "text-bad" : "text-good",
      badge: <Badge variant={(summary?.dpdp_compliance_rate_pct ?? 100) < 100 ? "bad" : "good"}>AUDITED</Badge>,
    },
    {
      label: "Unlinked PII Compliance Gaps",
      value: (summary?.unlinked_pii_spans_count ?? 0).toString(),
      subtext: "Spans accessed without consent_id",
      valueClassName: (summary?.unlinked_pii_spans_count ?? 0) > 0 ? "text-bad" : "text-good",
    },
    {
      label: "Active Consent Registry",
      value: (summary?.active_consents_count ?? 0).toString(),
      subtext: "Valid purpose-bound consent grants",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
            Consent-Linkage & PII Compliance Audit
          </h1>
          <p className="text-xs text-inkDim mt-1">
            Track user consent linkage across agent spans, detect unconsented PII accesses, and generate tamper-evident DPDP compliance exports.
          </p>
        </div>

        {/* Action Export Buttons */}
        <div className="flex items-center gap-2">
          <Button
            onClick={() => void handleExportCsv()}
            disabled={downloadingCsv}
            className="border border-border bg-surface text-xs h-8 px-3 flex items-center gap-1.5 hover:bg-paper"
          >
            <Download size={12} />
            {downloadingCsv ? "Exporting..." : "Export DPDP CSV"}
          </Button>
          <Button
            onClick={() => void handleExportPdf()}
            disabled={downloadingPdf}
            className="border border-ink bg-ink text-paper text-xs h-8 px-3 flex items-center gap-1.5 hover:bg-ink/90"
          >
            <FileText size={12} />
            {downloadingPdf ? "Generating..." : "Download Compliance PDF"}
          </Button>
        </div>
      </div>

      {/* Single Bordered Flex Container with Internal Dividers (.stat-row) */}
      <StatRow items={statItems} />

      {/* Compliance Gaps Section */}
      <div className="space-y-3">
        <div className="border-b border-border pb-2">
          <span className="text-[10.5px] font-medium uppercase tracking-wide text-inkFaint font-sans">
            Unlinked PII Access Events ({gaps.length})
          </span>
        </div>

        {gaps.length > 0 ? (
          <div className="divide-y divide-border border border-border bg-surface">
            {gaps.map((gap) => (
              <div key={gap.id} className="p-4 space-y-2.5 transition-colors hover:bg-paper/60" style={{ boxShadow: "inset 2px 0 0 #8C3A32" }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Badge variant="bad">UNLINKED PII ACCESS</Badge>
                    <span className="font-mono text-xs text-ink">
                      agent: <strong className="text-accent">{gap.agent_id}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-3 font-mono text-xs text-inkDim">
                    <span>{new Date(gap.timestamp).toLocaleString()}</span>
                    {gap.trace_id && (
                      <Link href={`/traces/${gap.trace_id}`} className="text-accent hover:underline flex items-center gap-0.5 text-xs">
                        Trace <ArrowUpRight size={11} />
                      </Link>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs text-inkDim font-sans">Detected Entities:</span>
                  {gap.pii_types.map((type) => (
                    <MaskedPiiChip key={type} label={type} entityType="Detected Entity" />
                  ))}
                </div>

                <p className="text-xs text-bad font-mono bg-paper p-2 border border-border">
                  {gap.gap_reason}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="border border-border bg-surface p-6 text-center text-xs text-good font-mono">
            No compliance gaps detected. All PII accesses are mapped to valid user consents.
          </div>
        )}
      </div>

      {/* Consent Grants Table */}
      <div className="space-y-3">
        <div className="border-b border-border pb-2">
          <span className="text-[10.5px] font-medium uppercase tracking-wide text-inkFaint font-sans">
            Active Purpose-Bound User Consents ({consents.length})
          </span>
        </div>

        <div className="w-full overflow-x-auto border border-border bg-surface">
          <table className="w-full text-left text-xs text-ink">
            <thead className="border-b border-border bg-paper text-[10.5px] uppercase tracking-wide text-inkFaint font-medium font-sans">
              <tr>
                <th className="px-3.5 py-2.5">Consent ID</th>
                <th className="px-3.5 py-2.5">User ID</th>
                <th className="px-3.5 py-2.5">Consent Type</th>
                <th className="px-3.5 py-2.5">Granted</th>
                <th className="px-3.5 py-2.5">Expires</th>
                <th className="px-3.5 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {consents.map((c) => (
                <tr key={c.consent_id} className="transition-colors hover:bg-paper/70 font-mono text-xs">
                  <td className="px-3.5 py-2.5 font-bold text-accent">{c.consent_id}</td>
                  <td className="px-3.5 py-2.5 text-inkDim">{c.user_id}</td>
                  <td className="px-3.5 py-2.5">{c.consent_type}</td>
                  <td className="px-3.5 py-2.5 text-[11px] text-inkDim">{new Date(c.granted_at).toLocaleDateString()}</td>
                  <td className="px-3.5 py-2.5 text-[11px] text-inkDim">{new Date(c.expires_at).toLocaleDateString()}</td>
                  <td className="px-3.5 py-2.5">
                    <Badge variant={c.status === "ACTIVE" ? "good" : "bad"}>{c.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
