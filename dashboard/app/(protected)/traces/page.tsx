import { TracesTable } from "@/components/traces-table";

export default function TracesPage() {
  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
          Distributed Traces
        </h1>
        <p className="text-xs text-inkDim mt-1">
          Inspect end-to-end agent executions, tool calls, latencies, and token cost waterfalls.
        </p>
      </div>

      <TracesTable />
    </div>
  );
}
