import { TraceWaterfall } from "@/components/trace-waterfall";

export default function TraceDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono uppercase tracking-wider text-inkFaint">Trace Record</span>
          <span className="text-xs text-inkFaint">•</span>
          <span className="text-xs font-mono font-bold text-accent">{params.id}</span>
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink mt-1">
          Execution Waterfall & PII Inspection
        </h1>
        <p className="text-xs text-inkDim mt-1">
          Expand hierarchical spans to inspect prompts, tool arguments, evaluation scorecards, and audit-logged PII token unmasking.
        </p>
      </div>

      <TraceWaterfall traceId={params.id} />
    </div>
  );
}
