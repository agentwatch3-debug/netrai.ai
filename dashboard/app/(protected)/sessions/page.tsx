"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Bot,
  Clock,
  DollarSign,
  HelpCircle,
  MessageSquareWarning,
  MessagesSquare,
  PlayCircle,
  RefreshCw,
  Repeat,
  Search,
  Sparkles,
  TrendingDown,
  User,
  Zap,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SessionSummary {
  session_id: string;
  user_id: string;
  agent_id: string;
  turn_count: number;
  total_spans: number;
  total_cost: number;
  total_tokens: number;
  started_at: string;
  last_active_at: string;
  error_count: number;
}

interface MisunderstandingLoop {
  id: number;
  session_id: string;
  agent_id: string;
  user_id: string;
  retry_count: number;
  total_tokens_in_loop: number;
  total_cost_in_loop: number;
  loop_type: string;
  similarity_scores: number[];
  sample_rephrasings: string[];
  tool_thrashing_detected: boolean;
  task_completed: boolean;
  flagged_at: string;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loops, setLoops] = useState<MisunderstandingLoop[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function loadData() {
    setLoading(true);
    try {
      const [sRes, lRes] = await Promise.all([
        fetch("/api/sessions"),
        fetch("/api/sessions/misunderstanding-loops"),
      ]);
      if (sRes.ok) {
        const body = await sRes.json();
        setSessions(body.data || []);
      }
      if (lRes.ok) {
        const body = await lRes.json();
        setLoops(body.data || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const filtered = sessions.filter(
    (s) =>
      s.session_id.toLowerCase().includes(search.toLowerCase()) ||
      s.user_id.toLowerCase().includes(search.toLowerCase()) ||
      s.agent_id.toLowerCase().includes(search.toLowerCase())
  );

  const totalWastedCost = loops.reduce((acc, l) => acc + l.total_cost_in_loop, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Sessions & Multi-Turn Conversations</h1>
          <p className="text-sm text-slate-400">
            Grouped multi-turn agent threads, retry-loop detection, conversation replays, and turn-level cost analytics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-72">
            <Search size={14} className="absolute left-3 top-3 text-slate-500" />
            <input
              className="w-full h-9 rounded-lg border border-slate-800 bg-slate-900 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              placeholder="Search by session_id, user_id..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Button
            onClick={() => void loadData()}
            className="h-9 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
          </Button>
        </div>
      </div>

      {/* Widget: Misunderstanding Loops Sorted by Wasted Cost */}
      <Card className="border-amber-900/60 bg-amber-950/20 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-amber-900/40 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-700 bg-amber-950 text-amber-400">
              <MessageSquareWarning size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  Sessions with Likely Misunderstanding Loops ({loops.length})
                </h2>
                <Badge className="bg-red-950 text-red-300 border-red-800 text-[10px] font-mono">
                  Ranked by Wasted Cost
                </Badge>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Identifies threads where users repeatedly rephrased their requests without resolution or where tools thrashed across turns.
              </p>
            </div>
          </div>

          <div className="text-right font-mono">
            <span className="text-[10px] text-slate-400 uppercase block">Total Wasted Compute</span>
            <strong className="text-base text-red-400 font-bold">${totalWastedCost.toFixed(4)}</strong>
          </div>
        </div>

        {/* Loop Cards */}
        {loops.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            No active misunderstanding loops detected in current sessions.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {loops.map((loop) => (
              <div
                key={loop.session_id}
                className="rounded-lg border border-amber-800/40 bg-slate-950/90 p-4 text-xs space-y-3 flex flex-col justify-between hover:border-amber-600 transition-colors"
              >
                <div className="space-y-2">
                  {/* Top Bar */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-900 pb-2">
                    <Link
                      href={`/sessions/${loop.session_id}`}
                      className="font-mono font-bold text-blue-400 hover:underline flex items-center gap-1 truncate"
                    >
                      <MessagesSquare size={13} className="shrink-0" />
                      <span className="truncate">{loop.session_id}</span>
                    </Link>

                    <Badge className="bg-red-950 text-red-300 border-red-800 font-mono text-[10px] shrink-0">
                      -${loop.total_cost_in_loop.toFixed(4)}
                    </Badge>
                  </div>

                  {/* Metadata */}
                  <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400">
                    <div className="flex items-center gap-1">
                      <User size={11} className="text-slate-500" />
                      <span>{loop.user_id}</span>
                    </div>
                    <Badge className="bg-slate-900 text-slate-300 text-[9px]">
                      {loop.agent_id}
                    </Badge>
                  </div>

                  {/* Loop Details & Stats */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-slate-900/60 p-2 rounded border border-slate-800/60">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Rephrased Turns</span>
                      <strong className="text-amber-300 font-bold">{loop.retry_count} Turns</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Wasted Tokens</span>
                      <strong className="text-slate-300">{loop.total_tokens_in_loop.toLocaleString()}</strong>
                    </div>
                  </div>

                  {/* Sample Rephrasings */}
                  {loop.sample_rephrasings && loop.sample_rephrasings.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-amber-400 font-semibold uppercase flex items-center gap-1">
                        <Repeat size={10} /> User Rephrasing Pattern:
                      </span>
                      <div className="rounded bg-slate-900/90 p-2 border border-slate-800 space-y-1.5 max-h-28 overflow-y-auto font-mono text-[10px] text-slate-300">
                        {loop.sample_rephrasings.map((rephrase, idx) => (
                          <div key={idx} className="flex items-start gap-1.5 border-b border-slate-800/50 pb-1 last:border-0 last:pb-0">
                            <span className="text-amber-500 font-bold shrink-0">#{idx + 1}:</span>
                            <span className="text-slate-300">{rephrase}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Action */}
                <div className="pt-2 border-t border-slate-900 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(loop.flagged_at).toLocaleTimeString()}
                  </span>
                  <Link
                    href={`/sessions/${loop.session_id}`}
                    className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1"
                  >
                    <span>Inspect Replay</span>
                    <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* All Sessions Table */}
      <Card className="border-slate-800 bg-slate-900/40 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <MessagesSquare size={16} className="text-blue-400" /> All Conversation Sessions ({filtered.length})
          </h2>
          <span className="text-xs text-slate-500 font-mono">Multi-turn session history</span>
        </div>

        {loading ? (
          <div className="text-sm text-slate-400 py-8 text-center">Loading conversation sessions...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400 uppercase">
                <tr>
                  <th className="py-3 px-3">Session ID</th>
                  <th>User</th>
                  <th>Agent</th>
                  <th>Turns</th>
                  <th>Total Spans</th>
                  <th>Total Tokens</th>
                  <th>Session Cost</th>
                  <th>Last Active</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filtered.map((s) => (
                  <tr key={s.session_id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-3 font-semibold text-white">
                      <Link href={`/sessions/${s.session_id}`} className="text-blue-400 hover:underline flex items-center gap-1.5">
                        <MessagesSquare size={13} />
                        <span>{s.session_id}</span>
                      </Link>
                    </td>
                    <td className="text-slate-300 flex items-center gap-1 py-3.5">
                      <User size={12} className="text-slate-500" />
                      <span>{s.user_id}</span>
                    </td>
                    <td>
                      <Badge className="bg-slate-800 text-slate-300 font-mono text-[10px]">
                        {s.agent_id}
                      </Badge>
                    </td>
                    <td className="text-slate-200 font-semibold">{s.turn_count} turns</td>
                    <td className="text-slate-400">{s.total_spans}</td>
                    <td className="text-slate-300">{s.total_tokens.toLocaleString()}</td>
                    <td className="text-emerald-400 font-semibold">${s.total_cost.toFixed(4)}</td>
                    <td className="text-slate-400 text-[11px]">{new Date(s.last_active_at).toLocaleString()}</td>
                    <td>
                      <Link href={`/sessions/${s.session_id}`} className="text-blue-400 hover:text-blue-300 flex items-center gap-0.5 text-[11px]">
                        Replay <ArrowUpRight size={12} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
