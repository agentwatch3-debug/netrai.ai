"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bot, Clock, DollarSign, Sparkles, User, Wrench, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ToolCall {
  name: string;
  input: Record<string, any>;
  output: Record<string, any>;
}

interface ConversationTurn {
  turn_index: number;
  trace_id: string;
  user_message: string;
  assistant_message: string;
  tool_calls: ToolCall[];
  tokens: number;
  cost_usd: number;
  latency_ms: number;
  created_at: string;
}

interface SessionDetail {
  session_id: string;
  user_id: string;
  agent_id: string;
  total_cost: number;
  total_tokens: number;
  started_at: string;
  last_active_at: string;
  turns: ConversationTurn[];
}

export function SessionChatReplay({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [activeTurn, setActiveTurn] = useState<ConversationTurn | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setSession(data);
        if (data && data.turns && data.turns.length > 0) {
          setActiveTurn(data.turns[0]);
        }
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return <div className="text-xs font-mono text-inkDim py-4">Loading conversation thread replay...</div>;
  }

  if (!session || !session.session_id) {
    return (
      <div className="space-y-4">
        <Link href="/sessions" className="text-xs text-accent hover:underline flex items-center gap-1 font-mono">
          <ArrowLeft size={14} /> Back to Sessions
        </Link>
        <p className="text-inkDim text-xs font-mono">Session thread not found.</p>
      </div>
    );
  }

  const turns = session.turns || [];

  return (
    <div className="space-y-6">
      {/* Session Header Card */}
      <div className="flex flex-wrap items-center justify-between gap-4 border border-border bg-surface p-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href="/sessions" className="text-inkDim hover:text-ink transition-colors">
              <ArrowLeft size={16} />
            </Link>
            <h1 className="text-base font-bold text-ink font-mono">{session.session_id}</h1>
            <Badge variant="secondary" className="font-mono text-[10px]">
              {turns.length} Turns
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-inkDim font-mono pl-6">
            <span>User: <strong className="text-ink">{session.user_id || "anonymous"}</strong></span>
            <span>·</span>
            <span>Agent: <strong className="text-ink">{session.agent_id || "agent"}</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="border border-border bg-paper px-3 py-1.5 text-ink">
            <span className="text-inkDim text-[10px] uppercase block">Total Cost</span>
            <span className="text-good font-bold">${(session.total_cost || 0).toFixed(4)}</span>
          </div>
          <div className="border border-border bg-paper px-3 py-1.5 text-ink">
            <span className="text-inkDim text-[10px] uppercase block">Total Tokens</span>
            <span className="text-ink font-bold">{(session.total_tokens || 0).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Main Split: Chat Bubbles Replay vs Turn Telemetry Inspector */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left 7 cols: Interactive Conversation Timeline */}
        <div className="space-y-4 lg:col-span-7">
          <span className="text-[11px] font-mono font-bold text-inkDim uppercase tracking-wider block pb-1 border-b border-border">
            Multi-Turn Conversation Thread
          </span>

          <div className="space-y-4">
            {turns.map((turn) => {
              const isSelected = activeTurn?.turn_index === turn.turn_index;
              const toolCalls = turn.tool_calls || [];

              return (
                <div
                  key={turn.turn_index}
                  onClick={() => setActiveTurn(turn)}
                  className={`cursor-pointer border p-4 transition-colors space-y-4 ${
                    isSelected
                      ? "border-ink bg-surface"
                      : "border-border bg-surface hover:border-borderStrong hover:bg-paper"
                  }`}
                >
                  {/* Turn Header */}
                  <div className="flex items-center justify-between border-b border-border pb-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-ink font-mono">Turn #{turn.turn_index}</span>
                      <Link
                        href={`/traces/${turn.trace_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[10px] text-accent font-mono hover:underline"
                      >
                        {turn.trace_id}
                      </Link>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-inkDim font-mono">
                      <span>{turn.latency_ms} ms</span>
                      <span>·</span>
                      <span className="font-bold text-good">${turn.cost_usd.toFixed(4)}</span>
                    </div>
                  </div>

                  {/* User Message Bubble */}
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center border border-border bg-paper text-ink">
                      <User size={14} />
                    </div>
                    <div className="border border-border bg-paper p-3 text-xs text-ink max-w-[88%] font-sans">
                      {turn.user_message}
                    </div>
                  </div>

                  {/* Intermediate Tool Executions */}
                  {turn.tool_calls.length > 0 && (
                    <div className="pl-10 space-y-2">
                      {turn.tool_calls.map((tool, idx) => (
                        <div key={idx} className="border border-border bg-accentSoft p-2.5 text-xs space-y-1">
                          <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-accent">
                            <Wrench size={12} />
                            <span>Tool Call: {tool.name}</span>
                          </div>
                          <pre className="overflow-auto font-mono text-[10px] text-ink bg-surface p-1.5 border border-border">
                            {JSON.stringify(tool.output, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Assistant Response Bubble */}
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center border border-ink bg-ink text-paper">
                      <Bot size={14} />
                    </div>
                    <div className="border border-border bg-surface p-3 text-xs text-ink max-w-[88%] font-sans">
                      {turn.assistant_message}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 5 cols: Selected Turn Telemetry Inspector */}
        <div className="space-y-4 lg:col-span-5">
          <span className="text-[11px] font-mono font-bold text-inkDim uppercase tracking-wider block pb-1 border-b border-border">
            Turn Telemetry & Diagnostics
          </span>

          {activeTurn ? (
            <Card className="sticky top-6 border border-border bg-surface p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="space-y-0.5">
                  <h3 className="text-xs font-bold text-ink uppercase tracking-wider font-mono">Turn #{activeTurn.turn_index} Details</h3>
                  <p className="text-[11px] text-inkDim font-mono">Trace ID: {activeTurn.trace_id}</p>
                </div>
                <Link href={`/traces/${activeTurn.trace_id}`}>
                  <Button variant="primary" className="h-7 px-2.5 text-xs font-mono">
                    View Waterfall
                  </Button>
                </Link>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-2 text-center font-mono">
                <div className="border border-border bg-paper p-2">
                  <span className="text-[10px] text-inkDim block uppercase">Tokens</span>
                  <span className="text-xs font-bold text-ink">{activeTurn.tokens.toLocaleString()}</span>
                </div>
                <div className="border border-border bg-paper p-2">
                  <span className="text-[10px] text-inkDim block uppercase">Turn Cost</span>
                  <span className="text-xs font-bold text-good">${activeTurn.cost_usd.toFixed(4)}</span>
                </div>
                <div className="border border-border bg-paper p-2">
                  <span className="text-[10px] text-inkDim block uppercase">Latency</span>
                  <span className="text-xs font-bold text-ink">{activeTurn.latency_ms} ms</span>
                </div>
              </div>

              {/* Tool Execution Summary */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-ink uppercase font-mono">Tool Calls In Turn ({(activeTurn.tool_calls || []).length})</span>
                {(activeTurn.tool_calls || []).length > 0 ? (
                  <div className="space-y-2">
                    {activeTurn.tool_calls.map((tool, idx) => (
                      <div key={idx} className="border border-border bg-paper p-2.5 space-y-1 text-xs font-mono">
                        <div className="flex items-center justify-between font-bold text-ink text-[11px]">
                          <span>{tool.name}</span>
                          <Badge variant="good" className="text-[9px]">Success</Badge>
                        </div>
                        <pre className="overflow-auto font-mono text-[10px] text-ink bg-surface p-2 border border-border">
                          {JSON.stringify(tool.input, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-inkDim italic font-mono">No tools invoked in this turn (direct LLM completion).</p>
                )}
              </div>
            </Card>
          ) : (
            <div className="border border-border bg-surface p-8 text-center text-inkDim text-xs font-mono">
              Select a conversation turn to inspect token breakdown and execution latency.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
