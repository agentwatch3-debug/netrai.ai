"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Trace } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function TracesTable() {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [agent, setAgent] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [minCost, setMinCost] = useState("");
  const [next, setNext] = useState<string | null>(null);

  async function load(cursor?: string) {
    const query = new URLSearchParams({
      ...(agent ? { agent_id: agent } : {}),
      ...(status ? { status } : {}),
      ...(from ? { started_after: from } : {}),
      ...(to ? { started_before: to } : {}),
      ...(minCost ? { min_cost: minCost } : {}),
      ...(cursor ? { cursor } : {}),
    });
    const response = await fetch(`/api/traces?${query}`);
    if (response.ok) {
      const page = await response.json();
      setTraces(cursor ? [...traces, ...page.data] : page.data);
      setNext(page.next_cursor);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-4">
      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border border-border bg-surface p-3 text-xs">
        <input
          className="h-8 rounded-none border border-border bg-paper px-2.5 text-xs text-ink placeholder-inkFaint focus:border-borderStrong focus:outline-none font-mono"
          placeholder="Filter Agent ID..."
          value={agent}
          onChange={(e) => setAgent(e.target.value)}
        />
        <select
          className="h-8 rounded-none border border-border bg-paper px-2.5 text-xs text-ink focus:border-borderStrong focus:outline-none"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
        </select>
        <input
          className="h-8 rounded-none border border-border bg-paper px-2 text-xs text-ink font-mono focus:border-borderStrong focus:outline-none"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          aria-label="Start date"
        />
        <input
          className="h-8 rounded-none border border-border bg-paper px-2 text-xs text-ink font-mono focus:border-borderStrong focus:outline-none"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          aria-label="End date"
        />
        <input
          className="h-8 w-28 rounded-none border border-border bg-paper px-2 text-xs text-ink placeholder-inkFaint font-mono focus:border-borderStrong focus:outline-none"
          placeholder="Min cost ($)"
          type="number"
          step="0.001"
          value={minCost}
          onChange={(e) => setMinCost(e.target.value)}
        />
        <Button
          onClick={() => void load()}
          className="h-8 px-3 text-xs border border-border bg-surface hover:bg-paper"
        >
          Apply Filters
        </Button>
      </div>

      {/* Flat Bordered Table */}
      <div className="w-full overflow-x-auto border border-border bg-surface">
        <table className="w-full text-left text-xs text-ink">
          <thead className="border-b border-border bg-paper text-[10.5px] uppercase tracking-wide text-inkFaint font-medium font-sans">
            <tr>
              <th className="px-3.5 py-2.5">Trace ID</th>
              <th className="px-3.5 py-2.5">Agent</th>
              <th className="px-3.5 py-2.5">Started</th>
              <th className="px-3.5 py-2.5">Spans</th>
              <th className="px-3.5 py-2.5">Cost</th>
              <th className="px-3.5 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {traces.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3.5 py-6 text-center text-xs text-inkDim">
                  No trace records found.
                </td>
              </tr>
            ) : (
              traces.map((trace) => (
                <tr className="transition-colors hover:bg-paper/70" key={trace.trace_id}>
                  <td className="px-3.5 py-2.5 font-mono text-xs">
                    <Link
                      href={`/traces/${trace.trace_id}`}
                      className="text-accent hover:underline font-semibold"
                    >
                      {trace.trace_id.slice(0, 12)}
                    </Link>
                  </td>
                  <td className="px-3.5 py-2.5 font-mono text-xs text-inkDim">
                    {trace.agent_id}
                  </td>
                  <td className="px-3.5 py-2.5 font-mono text-[11px] text-inkDim">
                    {new Date(trace.started_at).toLocaleString()}
                  </td>
                  <td className="px-3.5 py-2.5 font-mono text-xs">{trace.span_count}</td>
                  <td className="px-3.5 py-2.5 font-mono text-xs font-semibold">
                    ${trace.cost_usd.toFixed(4)}
                  </td>
                  <td className="px-3.5 py-2.5">
                    <Badge variant={trace.status === "error" ? "bad" : "good"}>
                      {trace.status}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {next && (
        <Button
          onClick={() => void load(next)}
          className="border border-border bg-surface text-xs"
        >
          Load More Traces
        </Button>
      )}
    </div>
  );
}
