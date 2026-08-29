import Link from "next/link";
import { ArrowLeft, CheckCircle2, Copy, Database, GitBranch, Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export default function CiIntegrationDocPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <Link
            href="/evals/datasets"
            className="inline-flex items-center gap-2 text-xs font-mono text-blue-400 hover:underline"
          >
            <ArrowLeft size={14} /> Back to Golden Datasets
          </Link>
          <Badge className="bg-emerald-950/80 text-emerald-400 border-emerald-800 text-[10px] font-mono">
            CI/CD Regression Suite
          </Badge>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-400">
              <GitBranch size={18} />
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white">
              CI/CD Golden Dataset Regression Testing Guide
            </h1>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed">
            Run automated evaluation suites on every pull request to ensure prompt iterations never regress tool accuracy or output safety.
          </p>
        </div>

        <Card className="border-slate-800 bg-slate-900/40 p-6 rounded-2xl space-y-4">
          <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
            <Terminal size={15} className="text-blue-400" /> 1. GitHub Actions Workflow (.github/workflows/agent-evals.yml)
          </h2>
          <pre className="rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-emerald-300 overflow-x-auto">
{`name: Agent Regression Evals

on:
  pull_request:
    branches: [main]

jobs:
  evals:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install agentwatch-sdk
      - name: Run Golden Dataset Suite
        env:
          AGENTWATCH_ENDPOINT: https://agentwatch-19dt.vercel.app
          AGENTWATCH_API_KEY: \${{ secrets.AGENTWATCH_API_KEY }}
        run: |
          agentwatch test run --dataset customer-support-v1 --runner app/agent.py:run_agent --min-score 0.85`}
          </pre>
        </Card>
      </div>
    </div>
  );
}
