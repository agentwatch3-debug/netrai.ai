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
    return <div className="text-sm text-slate-400">Loading conversation thread replay...</div>;
  }

  if (!session || !session.session_id) {
    return (
      <div className="space-y-4">
        <Link href="/sessions" className="text-xs text-blue-400 hover:underline flex items-center gap-1">
          <ArrowLeft size={14} /> Back to Sessions
        </Link>
        <p className="text-slate-400 text-sm">Session thread not found.</p>
      </div>
    );
  }

  const turns = session.turns || [];

  return (
    <div className="space-y-6">
      {/* Session Header Card */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href="/sessions" className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft size={16} />
            </Link>
            <h1 className="text-lg font-bold text-white font-mono">{session.session_id}</h1>
            <Badge className="bg-blue-950 text-blue-300 font-mono text-[10px]">
              {turns.length} Turns
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400 font-mono pl-6">
            <span>User: <strong className="text-slate-200">{session.user_id || "anonymous"}</strong></span>
            <span>·</span>
            <span>Agent: <strong className="text-slate-200">{session.agent_id || "agent"}</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-slate-300">
            <span className="text-slate-500 text-[10px] uppercase block">Total Cost</span>
            <span className="text-emerald-400 font-bold">${(session.total_cost || 0).toFixed(4)}</span>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-slate-300">
            <span className="text-slate-500 text-[10px] uppercase block">Total Tokens</span>
            <span className="text-white font-bold">{(session.total_tokens || 0).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Main Split: Chat Bubbles Replay vs Turn Telemetry Inspector */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left 7 cols: Interactive Conversation Timeline */}
        <div className="space-y-6 lg:col-span-7">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Multi-Turn Conversation Thread
          </span>

          <div className="space-y-6">
            {turns.map((turn) => {
              const isSelected = activeTurn?.turn_index === turn.turn_index;
              const toolCalls = turn.tool_calls || [];

              return (
                <div
                  key={turn.turn_index}
                  onClick={() => setActiveTurn(turn)}
                  className={`cursor-pointer rounded-xl border p-4 transition-all space-y-4 ${
                    isSelected
                      ? "border-blue-500/80 bg-slate-900/80 shadow-lg shadow-blue-950/20"
                      : "border-slate-800/80 bg-slate-900/30 hover:border-slate-700"
                  }`}
                >
                  {/* Turn Header */}
                  <div className="flex items-center justify-between border-b border-slate-800/60 pb-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white font-mono">Turn #{turn.turn_index}</span>
                      <Link
                        href={`/traces/${turn.trace_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[10px] text-blue-400 font-mono hover:underline"
                      >
                        {turn.trace_id}
                      </Link>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                      <span>{turn.latency_ms} ms</span>
                      <span>·</span>
                      <span>${turn.cost_usd.toFixed(4)}</span>
                    </div>
                  </div>

                  {/* User Message Bubble */}
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                      <User size={14} />
                    </div>
                    <div className="rounded-2xl rounded-tl-sm bg-blue-600/20 border border-blue-500/30 p-3 text-xs text-slate-100 max-w-[88%]">
                      {turn.user_message}
                    </div>
                  </div>

                  {/* Intermediate Tool Executions */}
                  {turn.tool_calls.length > 0 && (
                    <div className="pl-10 space-y-2">
                      {turn.tool_calls.map((tool, idx) => (
                        <div key={idx} className="rounded-lg border border-purple-900/50 bg-purple-950/20 p-2.5 text-xs space-y-1">
                          <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-purple-300">
                            <Wrench size={12} className="text-purple-400" />
                            <span>Tool Call: {tool.name}</span>
                          </div>
                          <pre className="overflow-auto font-mono text-[10px] text-purple-200 bg-slate-950/60 p-1.5 rounded">
                            {JSON.stringify(tool.output, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Assistant Response Bubble */}
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-emerald-400 border border-slate-700">
                      <Bot size={14} />
                    </div>
                    <div className="rounded-2xl rounded-tl-sm bg-slate-950 border border-slate-800 p-3 text-xs text-slate-200 max-w-[88%]">
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
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Turn Telemetry & Diagnostics
          </span>

          {activeTurn ? (
            <Card className="sticky top-6 border-slate-800 bg-slate-900/50 p-5 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold text-white font-mono">Turn #{activeTurn.turn_index} Details</h3>
                  <p className="text-[11px] text-slate-400 font-mono">Trace ID: {activeTurn.trace_id}</p>
                </div>
                <Link href={`/traces/${activeTurn.trace_id}`}>
                  <Button className="h-7 px-2.5 bg-blue-600 hover:bg-blue-500 text-xs">
                    View Waterfall
                  </Button>
                </Link>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5">
                  <span className="text-[10px] text-slate-400 block uppercase">Tokens</span>
                  <span className="text-sm font-bold text-white font-mono">{activeTurn.tokens.toLocaleString()}</span>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5">
                  <span className="text-[10px] text-slate-400 block uppercase">Turn Cost</span>
                  <span className="text-sm font-bold text-emerald-400 font-mono">${activeTurn.cost_usd.toFixed(4)}</span>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5">
                  <span className="text-[10px] text-slate-400 block uppercase">Latency</span>
                  <span className="text-sm font-bold text-blue-400 font-mono">{activeTurn.latency_ms} ms</span>
                </div>
              </div>

              {/* Tool Execution Summary */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-300">Tool Calls In Turn ({(activeTurn.tool_calls || []).length})</span>
                {(activeTurn.tool_calls || []).length > 0 ? (
                  <div className="space-y-2">
                    {activeTurn.tool_calls.map((tool, idx) => (
                      <div key={idx} className="rounded-lg border border-slate-800 bg-slate-950 p-2.5 space-y-1 text-xs">
                        <div className="flex items-center justify-between font-mono font-medium text-slate-200 text-[11px]">
                          <span>{tool.name}</span>
                          <Badge className="bg-emerald-950 text-emerald-300 text-[9px]">Success</Badge>
                        </div>
                        <pre className="overflow-auto font-mono text-[10px] text-slate-400 bg-slate-900/60 p-2 rounded">
                          {JSON.stringify(tool.input, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No tools invoked in this turn (direct LLM completion).</p>
                )}
              </div>
            </Card>
          ) : (
            <div className="rounded-lg border border-slate-800 bg-slate-900/20 p-8 text-center text-slate-400 text-xs">
              Select a conversation turn to inspect token breakdown and execution latency.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
