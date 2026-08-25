import { EvalsDashboard } from "@/components/evals-dashboard";

export default function EvalsPage() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Evaluations & Scorecards</h1>
        <p className="text-sm text-slate-400">
          Automated LLM-as-a-judge assessments, hallucination detection, tool correctness, and human quality ratings.
        </p>
      </div>
      <EvalsDashboard />
    </>
  );
}
