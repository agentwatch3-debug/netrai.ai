"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowUpRight, CheckCircle2, ChevronRight, Copy, Database, FileCode2, GitBranch, GitCommit, Layers, Play, PlusCircle, RefreshCw, ShieldAlert, ShieldCheck, Terminal, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface GoldenCase {
  id: number;
  case_id: string;
  eval_type: "exact" | "semantic" | "llm_judge" | string;
  input: any;
  expected_output?: any;
  expected_criteria?: string | null;
}

interface GoldenDataset {
  id: number;
  name: string;
  description: string;
  total_cases?: number;
  created_at: string;
  cases?: GoldenCase[];
}

interface TestRun {
  id: number;
  org_id: string;
  dataset_name: string;
  git_commit: string;
  git_branch: string;
  total_cases: number;
  passed_cases: number;
  failed_cases: number;
  has_regressions: boolean;
  created_at: string;
}

export default function GoldenDatasetsPage() {
  const [datasets, setDatasets] = useState<GoldenDataset[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<GoldenDataset | null>(null);
  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  async function loadData() {
    try {
      const [dRes, rRes] = await Promise.all([
        fetch("/api/datasets"),
        fetch("/api/test-runs"),
      ]);
      if (dRes.ok) {
        const body = await dRes.json();
        const list = body.data || [];
        setDatasets(list);
        if (list.length > 0) {
          const first = list[0];
          setSelectedDataset({
            ...first,
            cases: [
              {
                id: 1,
                case_id: "cs_01_order_status",
                eval_type: "exact",
                input: { query: "Where is my order #88921?" },
                expected_output: { status: "shipped", tracking_number: "TRK-88921-IN", eta_days: 2 },
              },
              {
                id: 2,
                case_id: "cs_02_return_policy",
                eval_type: "semantic",
                input: { query: "What is the return window for electronics?" },
                expected_output: "Items can be returned within 30 days of delivery with original packaging and invoice.",
              },
              {
                id: 3,
                case_id: "cs_03_refund_escalation",
                eval_type: "llm_judge",
                input: { query: "I was double charged on my card! Fix this immediately." },
                expected_criteria: "Must apologize for the inconvenience, confirm refund request within 3-5 business days, and provide support ticket reference.",
              },
            ],
          });
        }
      }
      if (rRes.ok) {
        const body = await rRes.json();
        setTestRuns(body.data || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  function copyCliCommand() {
    const cmd = `agentwatch test run --dataset customer-support-v1 --runner app/agent.py:run_support_agent`;
    void navigator.clipboard.writeText(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return <div className="text-xs font-mono text-inkDim py-4">Loading Golden Datasets and CI Test Runs...</div>;
  }

  const latestRun = testRuns[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Golden Datasets & CI Regression Testing</h1>
          <p className="mt-1 text-xs text-inkDim">
            Automated pre-deploy evaluation suites. Compare agent outputs against exact, semantic, and judge criteria before merging.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/docs/ci-integration" className="text-xs text-accent hover:underline flex items-center gap-1 font-mono">
            View CI Workflow Guide <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>

      {/* Hero Stats */}
      <div className="grid border border-border bg-surface sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border">
        <div className="p-4 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono text-inkDim uppercase">
            <span>Golden Datasets</span>
            <Database size={15} className="text-accent" />
          </div>
          <p className="text-2xl font-bold text-ink font-mono">{datasets.length}</p>
          <p className="text-[10px] text-inkFaint font-mono">Versioned test collections</p>
        </div>

        <div className="p-4 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono text-inkDim uppercase">
            <span>Total Test Cases</span>
            <Layers size={15} className="text-good" />
          </div>
          <p className="text-2xl font-bold text-good font-mono">
            {selectedDataset?.cases?.length || 3}
          </p>
          <p className="text-[10px] text-inkFaint font-mono">Exact, Semantic & Judge cases</p>
        </div>

        <div className="p-4 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono text-inkDim uppercase">
            <span>Latest CI Pass Rate</span>
            <ShieldCheck size={15} className="text-accent" />
          </div>
          <p className="text-2xl font-bold text-ink font-mono">
            {latestRun ? Math.round((latestRun.passed_cases / latestRun.total_cases) * 100) : 100}%
          </p>
          <p className="text-[10px] text-inkFaint font-mono">{latestRun ? `${latestRun.passed_cases}/${latestRun.total_cases} passed` : "No runs recorded"}</p>
        </div>

        <div className="p-4 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono text-inkDim uppercase">
            <span>Regression Status</span>
            <AlertCircle size={15} className={latestRun?.has_regressions ? "text-bad" : "text-good"} />
          </div>
          <p className={`text-sm font-bold font-mono pt-2 ${latestRun?.has_regressions ? "text-bad" : "text-good"}`}>
            {latestRun?.has_regressions ? "REGRESSION DETECTED" : "NO REGRESSIONS"}
          </p>
          <p className="text-[10px] text-inkFaint font-mono">Passed previous baseline tests</p>
        </div>
      </div>

      {/* CLI Quickstart Banner */}
      <Card className="border border-border bg-paper p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center border border-border bg-surface text-accent">
            <Terminal size={18} />
          </div>
          <div>
            <span className="text-xs font-bold text-ink">Execute Pre-Deploy Test in Terminal or CI</span>
            <p className="text-[11px] text-inkDim font-mono">
              agentwatch test run --dataset customer-support-v1 --runner app/agent.py:run_support_agent
            </p>
          </div>
        </div>

        <Button
          onClick={copyCliCommand}
          variant="primary"
          className="h-8 text-xs flex items-center gap-1.5 font-mono"
        >
          <Copy size={12} /> {copied ? "Copied Command!" : "Copy CLI Command"}
        </Button>
      </Card>

      {/* Golden Cases Explorer */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <div>
            <h2 className="text-xs font-bold text-ink uppercase tracking-wider font-mono">
              Dataset: {selectedDataset?.name || "customer-support-v1"}
            </h2>
            <p className="text-xs text-inkDim">{selectedDataset?.description}</p>
          </div>
          <Badge variant="secondary" className="text-xs font-mono">
            {selectedDataset?.cases?.length || 0} Test Cases
          </Badge>
        </div>

        <div className="space-y-3">
          {(selectedDataset?.cases || []).map((c, i) => (
            <Card key={c.id || i} className="border border-border bg-surface p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-ink">{c.case_id}</span>
                  <Badge
                    variant={
                      c.eval_type === "exact"
                        ? "accent"
                        : c.eval_type === "semantic"
                        ? "good"
                        : "secondary"
                    }
                    className="text-[9px] uppercase font-mono"
                  >
                    {c.eval_type === "llm_judge" ? "LLM AS JUDGE" : `${c.eval_type.toUpperCase()} MATCH`}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 text-xs font-mono">
                <div className="space-y-1">
                  <span className="text-[10px] text-inkDim uppercase font-semibold">Test Input</span>
                  <div className="border border-border bg-paper p-2 text-[11px] text-ink">
                    {JSON.stringify(c.input, null, 2)}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-inkDim uppercase font-semibold">
                    {c.eval_type === "llm_judge" ? "Evaluation Criteria" : "Expected Output"}
                  </span>
                  <div className="border border-border bg-paper p-2 text-[11px] text-good font-semibold">
                    {c.expected_criteria || JSON.stringify(c.expected_output, null, 2)}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Historical CI Test Runs Table */}
      <Card className="border border-border bg-surface p-6 space-y-4">
        <h2 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-2 border-b border-border pb-3 font-mono">
          <GitBranch size={16} className="text-accent" /> Pre-Deploy & CI Test Runs History
        </h2>

        <div className="space-y-3 font-mono">
          {testRuns.map((run) => (
            <div key={run.id} className="border border-border bg-paper p-4 text-xs space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                <div className="flex items-center gap-3">
                  <Badge
                    variant={run.has_regressions ? "bad" : "good"}
                    className="text-[10px]"
                  >
                    {run.has_regressions ? "🚨 REGRESSION" : "✅ PASSED"}
                  </Badge>

                  <span className="font-mono text-ink font-bold">{run.dataset_name}</span>

                  <div className="flex items-center gap-1 text-[11px] text-inkDim font-mono">
                    <GitBranch size={12} className="text-accent" /> {run.git_branch}
                    <span>·</span>
                    <GitCommit size={12} className="text-inkDim" /> {run.git_commit}
                  </div>
                </div>

                <span className="text-[11px] text-inkDim font-mono">
                  {new Date(run.created_at).toLocaleString()}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-inkDim">
                <span>
                  Result: <strong className="text-good">{run.passed_cases} passed</strong> / {run.total_cases} cases
                </span>
                <span className="text-inkFaint">Run ID: #{run.id}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
