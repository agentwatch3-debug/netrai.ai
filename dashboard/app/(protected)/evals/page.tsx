import { EvalsDashboard } from "@/components/evals-dashboard";

export default function EvalsPage() {
  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Evaluations & Scorecards</h1>
        <p className="mt-1 text-xs text-inkDim">
          Automated LLM-as-a-judge assessments, hallucination detection, tool correctness, and human quality ratings.
        </p>
      </div>
      <EvalsDashboard />
    </div>
  );
}
