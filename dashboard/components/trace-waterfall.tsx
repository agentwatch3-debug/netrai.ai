"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Lock, Sparkles, ThumbsDown, ThumbsUp, Unlock, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EvalScore, Span } from "@/lib/types";

export function TraceWaterfall({ traceId }: { traceId: string }) {
  const [spans, setSpans] = useState<Span[]>([]);
  const [scores, setScores] = useState<EvalScore[]>([]);
  const [unmasked, setUnmasked] = useState<Record<string, Record<string, string>>>({});
  const [votedSpans, setVotedSpans] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/traces/${traceId}`).then((r) => r.json()),
      fetch(`/api/evals/scores?trace_id=${traceId}`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([traceData, scoresData]) => {
        setSpans(traceData.spans ?? []);
        setScores(scoresData ?? []);
      })
      .finally(() => setLoading(false));
  }, [traceId]);

  async function unmask(spanId: string) {
    const response = await fetch(`/api/traces/${traceId}/spans/${spanId}/unmask`, { method: "POST" });
    if (response.ok) {
      const data = await response.json();
      setUnmasked((prev) => ({ ...prev, [spanId]: data.replacements ?? data }));
    }
  }

  async function submitHumanFeedback(spanId: string, value: number) {
    setVotedSpans((prev) => ({ ...prev, [spanId]: value }));
    await fetch("/api/evals/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        span_id: spanId,
        trace_id: traceId,
        score_name: "human_feedback",
        score_value: value,
        reasoning: value === 1.0 ? "Human feedback: positive thumbs up" : "Human feedback: negative thumbs down",
        evaluator_type: "human",
      }),
    });
    // Refresh scores
    const res = await fetch(`/api/evals/scores?trace_id=${traceId}`);
    if (res.ok) setScores(await res.json());
  }

  if (loading) {
    return <div className="text-sm text-slate-400">Loading trace spans & quality scorecards...</div>;
  }

  const levels = new Map<string, number>();

  return (
    <div className="space-y-3">
      {spans.map((span) => {
        const level = span.parent_span_id ? (levels.get(span.parent_span_id) ?? 0) + 1 : 0;
        levels.set(span.span_id, level);

        const spanScores = scores.filter((s) => s.span_id === span.span_id);
        const spanUnmask = unmasked[span.span_id];
        const currentVote = votedSpans[span.span_id];

        return (
          <details
            className="group rounded-lg border border-slate-800 bg-slate-900/50 transition-all hover:border-slate-700"
            key={span.span_id}
            style={{ marginLeft: level * 20 }}
            open={level === 0}
          >
            <summary className="flex cursor-pointer items-center gap-3 p-3.5 text-sm select-none">
              <Badge
                className={
                  span.status === "error"
                    ? "bg-red-950 text-red-300 border-red-900/60"
                    : span.span_type === "llm_call"
                    ? "bg-purple-950 text-purple-300 border-purple-900/60"
                    : span.span_type === "tool_call"
                    ? "bg-blue-950 text-blue-300 border-blue-900/60"
                    : "bg-slate-800 text-slate-300"
                }
              >
                {span.span_type}
              </Badge>

              <span className="font-semibold text-slate-200">{span.name}</span>
              {span.model && <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400 font-mono">{span.model}</span>}

              {/* Eval Badges */}
              <div className="flex items-center gap-1.5 ml-2">
                {spanScores.map((s) => (
                  <span
                    key={s.id || s.score_name}
                    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      s.score_value >= 0.8
                        ? "bg-emerald-950 text-emerald-300 border border-emerald-900/50"
                        : "bg-amber-950 text-amber-300 border border-amber-900/50"
                    }`}
                    title={s.reasoning || undefined}
                  >
                    <Sparkles size={10} />
                    {s.score_name}: {(s.score_value * 100).toFixed(0)}%
                  </span>
                ))}
              </div>

              <div className="ml-auto flex items-center gap-3 text-xs text-slate-400 font-mono">
                <span>{span.latency_ms ?? 0} ms</span>
                <span>·</span>
                <span>${(span.cost_usd ?? 0).toFixed(4)}</span>
              </div>
            </summary>

            <div className="border-t border-slate-800/80 p-4 space-y-4 text-xs">
              {/* Payloads */}
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Input Payload</span>
                  <pre className="max-h-60 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] text-slate-300">
                    {JSON.stringify(span.input, null, 2)}
                  </pre>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Output Payload</span>
                  <pre className="max-h-60 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] text-slate-300">
                    {JSON.stringify(span.output, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Actions & Eval Card Row */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/60">
                {/* PII Unmasking */}
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => void unmask(span.span_id)}
                    className="flex items-center gap-1.5 bg-slate-800 text-xs text-slate-200 hover:bg-slate-700 h-8 px-3"
                  >
                    <Lock size={12} className="text-amber-400" />
                    Unmask PII (Audit Logged)
                  </Button>
                </div>

                {/* Human Feedback Scoring */}
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-xs">Rate Span:</span>
                  <Button
                    onClick={() => void submitHumanFeedback(span.span_id, 1.0)}
                    className={`h-8 px-2.5 text-xs flex items-center gap-1 ${
                      currentVote === 1.0 ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    <ThumbsUp size={12} /> Good
                  </Button>
                  <Button
                    onClick={() => void submitHumanFeedback(span.span_id, 0.0)}
                    className={`h-8 px-2.5 text-xs flex items-center gap-1 ${
                      currentVote === 0.0 ? "bg-red-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    <ThumbsDown size={12} /> Bad
                  </Button>
                </div>
              </div>

              {/* Decrypted PII View */}
              {spanUnmask && Object.keys(spanUnmask).length > 0 && (
                <div className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                    <Unlock size={13} />
                    <span>Decrypted PII Tokens (Audited)</span>
                  </div>
                  <pre className="overflow-auto font-mono text-[11px] text-amber-200">
                    {JSON.stringify(spanUnmask, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}
