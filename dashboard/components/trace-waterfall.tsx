"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Lock, Sparkles, Target, ThumbsDown, ThumbsUp, Unlock, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MaskedPiiChip } from "@/components/ui/masked-pii-chip";
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
    const res = await fetch(`/api/evals/scores?trace_id=${traceId}`);
    if (res.ok) setScores(await res.json());
  }

  if (loading) {
    return <div className="text-xs text-inkDim font-mono p-4 border border-border bg-surface">Loading trace spans & quality scorecards...</div>;
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
            className="group border border-border bg-surface transition-colors"
            key={span.span_id}
            style={{ marginLeft: level * 16 }}
            open={level === 0}
          >
            <summary className="flex cursor-pointer items-center justify-between p-3 text-xs select-none hover:bg-paper/80 border-b border-transparent group-open:border-border">
              <div className="flex items-center gap-3">
                <Badge
                  variant={
                    span.status === "error"
                      ? "bad"
                      : span.span_type === "llm_call"
                      ? "accent"
                      : span.span_type === "tool_call"
                      ? "warn"
                      : "neutral"
                  }
                >
                  {span.span_type}
                </Badge>

                <span className="font-semibold text-ink font-mono">{span.name}</span>
                {span.model && (
                  <span className="border border-border bg-paper px-1.5 py-0.5 text-[10px] text-inkDim font-mono">
                    {span.model}
                  </span>
                )}

                {/* Score Indicators */}
                <div className="flex items-center gap-2 ml-2 font-mono text-[10.5px]">
                  {spanScores.map((s) => {
                    const sName = (s.score_name || "").toLowerCase();
                    const isLow = s.score_value < 0.7;
                    return (
                      <Badge
                        key={s.id || s.score_name}
                        variant={isLow ? "bad" : "good"}
                      >
                        {s.score_name}: {(s.score_value * 100).toFixed(0)}%
                      </Badge>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-4 text-[11px] font-mono text-inkDim">
                {span.prompt_tokens != null && (
                  <span>
                    tokens: <strong className="text-ink">{(span.prompt_tokens || 0) + (span.completion_tokens || 0)}</strong>
                  </span>
                )}
                {span.cost_usd != null && (
                  <span>
                    cost: <strong className="text-ink">${Number(span.cost_usd).toFixed(4)}</strong>
                  </span>
                )}
              </div>
            </summary>

            <div className="space-y-3 p-4 bg-paper/30 text-xs">
              {/* Payload grids */}
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] uppercase tracking-wide text-inkFaint font-medium font-sans">
                      Input Payload
                    </span>
                    {(span as any).masked_entities && (span as any).masked_entities.length > 0 && (
                      <div className="flex items-center gap-1">
                        {((span as any).masked_entities as string[]).map((m: string, idx: number) => (
                          <MaskedPiiChip key={idx} label={m} entityType="PII Entity" />
                        ))}
                      </div>
                    )}
                  </div>
                  <pre className="max-h-60 overflow-auto border border-border bg-surface p-3 font-mono text-[11px] text-ink">
                    {JSON.stringify(span.input, null, 2)}
                  </pre>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10.5px] uppercase tracking-wide text-inkFaint font-medium font-sans">
                    Output Payload
                  </span>
                  <pre className="max-h-60 overflow-auto border border-border bg-surface p-3 font-mono text-[11px] text-ink">
                    {JSON.stringify(span.output, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Actions & Feedback */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => void unmask(span.span_id)}
                    className="flex items-center gap-1.5 text-xs h-7 px-2.5 border border-border bg-surface hover:bg-paper"
                  >
                    <Lock size={11} className="text-warn" />
                    Unmask PII (Audit Logged)
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-inkDim text-xs font-sans">Rate Span:</span>
                  <Button
                    onClick={() => void submitHumanFeedback(span.span_id, 1.0)}
                    className={`h-7 px-2 text-xs flex items-center gap-1 border ${
                      currentVote === 1.0 ? "border-good bg-good text-paper" : "border-border bg-surface text-ink hover:bg-paper"
                    }`}
                  >
                    <ThumbsUp size={11} /> Good
                  </Button>
                  <Button
                    onClick={() => void submitHumanFeedback(span.span_id, 0.0)}
                    className={`h-7 px-2 text-xs flex items-center gap-1 border ${
                      currentVote === 0.0 ? "border-bad bg-bad text-paper" : "border-border bg-surface text-ink hover:bg-paper"
                    }`}
                  >
                    <ThumbsDown size={11} /> Bad
                  </Button>
                </div>
              </div>

              {/* Decrypted PII View */}
              {spanUnmask && Object.keys(spanUnmask).length > 0 && (
                <div className="border border-warn/40 bg-accentSoft p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-accent font-semibold font-mono text-xs">
                    <Unlock size={12} />
                    <span>Decrypted PII Tokens (Audited)</span>
                  </div>
                  <pre className="overflow-auto font-mono text-[11px] text-ink bg-surface border border-border p-2">
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
