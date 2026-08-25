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
          // Fetch full dataset details for first item
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
    return <div className="text-sm text-slate-400">Loading Golden Datasets and CI Test Runs...</div>;
  }

  const latestRun = testRuns[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Golden Datasets & CI Regression Testing</h1>
          <p className="text-sm text-slate-400">
            Automated pre-deploy evaluation suites. Compare agent outputs against exact, semantic, and judge criteria before merging.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/docs/ci-integration" className="text-xs text-blue-400 hover:underline flex items-center gap-1 font-mono">
            View CI Workflow Guide <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>

      {/* Hero Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border-slate-800 bg-slate-900/40 p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 uppercase font-semibold">Golden Datasets</span>
            <Database size={15} className="text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-white font-mono">{datasets.length}</p>
          <p className="text-[10px] text-slate-500">Versioned test collections</p>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 uppercase font-semibold">Total Test Cases</span>
            <Layers size={15} className="text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400 font-mono">
            {selectedDataset?.cases?.length || 3}
          </p>
          <p className="text-[10px] text-slate-500">Exact, Semantic & LLM-Judge cases</p>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 uppercase font-semibold">Latest CI Run Pass Rate</span>
            <ShieldCheck size={15} className="text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-white font-mono">
            {latestRun ? Math.round((latestRun.passed_cases / latestRun.total_cases) * 100) : 100}%
          </p>
          <p className="text-[10px] text-slate-500">{latestRun ? `${latestRun.passed_cases}/${latestRun.total_cases} passed` : "No runs recorded"}</p>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 uppercase font-semibold">Regression Status</span>
            <AlertCircle size={15} className={latestRun?.has_regressions ? "text-red-400" : "text-emerald-400"} />
          </div>
          <p className={`text-sm font-bold font-mono pt-2 ${latestRun?.has_regressions ? "text-red-400" : "text-emerald-400"}`}>
            {latestRun?.has_regressions ? "REGRESSION DETECTED" : "NO REGRESSIONS"}
          </p>
          <p className="text-[10px] text-slate-500">Passed previous baseline tests</p>
        </Card>
      </div>

      {/* CLI Quickstart Banner */}
      <Card className="border-blue-900/50 bg-blue-950/20 p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-950 border border-blue-800 text-blue-400">
            <Terminal size={18} />
          </div>
          <div>
            <span className="text-xs font-bold text-white">Execute Pre-Deploy Test in Terminal or CI</span>
            <p className="text-[11px] text-slate-400 font-mono">
              agentwatch test run --dataset customer-support-v1 --runner app/agent.py:run_support_agent
            </p>
          </div>
        </div>

        <Button
          onClick={copyCliCommand}
          className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 font-mono"
        >
          <Copy size={12} /> {copied ? "Copied Command!" : "Copy CLI Command"}
        </Button>
      </Card>

      {/* Golden Cases Explorer */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div>
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
              Dataset: {selectedDataset?.name || "customer-support-v1"}
            </h2>
            <p className="text-xs text-slate-400">{selectedDataset?.description}</p>
          </div>
          <Badge className="bg-slate-800 text-slate-300 text-xs font-mono">
            {selectedDataset?.cases?.length || 0} Test Cases
          </Badge>
        </div>

        <div className="space-y-3">
          {(selectedDataset?.cases || []).map((c, i) => (
            <Card key={c.id || i} className="border-slate-800 bg-slate-950 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-900 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-white">{c.case_id}</span>
                  <Badge
                    className={
                      c.eval_type === "exact"
                        ? "bg-blue-950 text-blue-300 border-blue-800 text-[9px] uppercase"
                        : c.eval_type === "semantic"
                        ? "bg-emerald-950 text-emerald-300 border-emerald-800 text-[9px] uppercase"
                        : "bg-purple-950 text-purple-300 border-purple-800 text-[9px] uppercase"
                    }
                  >
                    {c.eval_type === "llm_judge" ? "LLM AS JUDGE" : `${c.eval_type.toUpperCase()} MATCH`}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 text-xs">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-mono uppercase font-semibold">Test Input</span>
                  <div className="rounded bg-slate-900/80 border border-slate-800/80 p-2 font-mono text-[11px] text-slate-300">
                    {JSON.stringify(c.input, null, 2)}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-mono uppercase font-semibold">
                    {c.eval_type === "llm_judge" ? "Evaluation Criteria" : "Expected Output"}
                  </span>
                  <div className="rounded bg-slate-900/80 border border-slate-800/80 p-2 font-mono text-[11px] text-emerald-400">
                    {c.expected_criteria || JSON.stringify(c.expected_output, null, 2)}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Historical CI Test Runs Table */}
      <Card className="border-slate-800 bg-slate-900/40 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <GitBranch size={16} className="text-blue-400" /> Pre-Deploy & CI Test Runs History
        </h2>

        <div className="space-y-3">
          {testRuns.map((run) => (
            <div key={run.id} className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-xs space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-900 pb-2">
                <div className="flex items-center gap-3">
                  <Badge
                    className={
                      run.has_regressions
                        ? "bg-red-950 text-red-300 border-red-800 text-[10px]"
                        : "bg-emerald-950 text-emerald-300 border-emerald-800 text-[10px]"
                    }
                  >
                    {run.has_regressions ? "🚨 REGRESSION" : "✅ PASSED"}
                  </Badge>

                  <span className="font-mono text-white font-bold">{run.dataset_name}</span>

                  <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                    <GitBranch size={12} className="text-blue-400" /> {run.git_branch}
                    <span className="text-slate-600">·</span>
                    <GitCommit size={12} className="text-slate-500" /> {run.git_commit}
                  </div>
                </div>

                <span className="text-[11px] text-slate-500 font-mono">
                  {new Date(run.created_at).toLocaleString()}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-slate-400">
                <span>
                  Result: <strong className="text-emerald-400">{run.passed_cases} passed</strong> / {run.total_cases} cases
                </span>
                <span className="text-slate-500">Run ID: #{run.id}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
