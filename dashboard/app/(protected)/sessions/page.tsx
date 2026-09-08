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
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Sessions & Multi-Turn Conversations</h1>
          <p className="mt-1 text-xs text-inkDim">
            Grouped multi-turn agent threads, retry-loop detection, conversation replays, and turn-level cost analytics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-72">
            <Search size={14} className="absolute left-3 top-2.5 text-inkDim" />
            <input
              className="w-full h-8 border border-border bg-surface pl-9 pr-3 text-xs text-ink placeholder-inkFaint focus:border-ink focus:outline-none font-mono"
              placeholder="Search by session_id, user_id..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Button
            onClick={() => void loadData()}
            variant="outline"
            className="h-8 text-xs flex items-center gap-1.5 font-mono"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
          </Button>
        </div>
      </div>

      {/* Widget: Misunderstanding Loops Sorted by Wasted Cost */}
      <Card className="border border-border bg-surface p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-border bg-paper text-warn">
              <MessageSquareWarning size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold text-ink uppercase tracking-wider font-mono">
                  Sessions with Likely Misunderstanding Loops ({loops.length})
                </h2>
                <Badge variant="bad" className="text-[10px] font-mono">
                  Ranked by Wasted Cost
                </Badge>
              </div>
              <p className="text-xs text-inkDim mt-0.5">
                Identifies threads where users repeatedly rephrased their requests without resolution or where tools thrashed across turns.
              </p>
            </div>
          </div>

          <div className="text-right font-mono">
            <span className="text-[10px] text-inkDim uppercase block">Total Wasted Spend</span>
            <strong className="text-base text-bad font-bold">${totalWastedCost.toFixed(4)}</strong>
          </div>
        </div>

        {/* Loop Cards */}
        {loops.length === 0 ? (
          <div className="py-6 text-center text-xs text-inkDim font-mono">
            No active misunderstanding loops detected in current sessions.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {loops.map((loop) => (
              <div
                key={loop.session_id}
                className="border border-border bg-paper p-4 text-xs space-y-3 flex flex-col justify-between hover:border-borderStrong transition-colors"
              >
                <div className="space-y-2">
                  {/* Top Bar */}
                  <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
                    <Link
                      href={`/sessions/${loop.session_id}`}
                      className="font-mono font-bold text-accent hover:underline flex items-center gap-1 truncate"
                    >
                      <MessagesSquare size={13} className="shrink-0" />
                      <span className="truncate">{loop.session_id}</span>
                    </Link>

                    <Badge variant="bad" className="font-mono text-[10px] shrink-0">
                      -${loop.total_cost_in_loop.toFixed(4)}
                    </Badge>
                  </div>

                  {/* Metadata */}
                  <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-inkDim">
                    <div className="flex items-center gap-1">
                      <User size={11} className="text-inkDim" />
                      <span>{loop.user_id}</span>
                    </div>
                    <Badge variant="secondary" className="text-[9px]">
                      {loop.agent_id}
                    </Badge>
                  </div>

                  {/* Loop Details & Stats */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-surface p-2 border border-border">
                    <div>
                      <span className="text-[10px] text-inkDim block uppercase">Rephrased Turns</span>
                      <strong className="text-warn font-bold">{loop.retry_count} Turns</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-inkDim block uppercase">Wasted Tokens</span>
                      <strong className="text-ink">{loop.total_tokens_in_loop.toLocaleString()}</strong>
                    </div>
                  </div>

                  {/* Sample Rephrasings */}
                  {loop.sample_rephrasings && loop.sample_rephrasings.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-warn font-semibold uppercase font-mono flex items-center gap-1">
                        <Repeat size={10} /> User Rephrasing Pattern:
                      </span>
                      <div className="bg-surface p-2 border border-border space-y-1.5 max-h-28 overflow-y-auto font-mono text-[10px] text-ink">
                        {loop.sample_rephrasings.map((rephrase, idx) => (
                          <div key={idx} className="flex items-start gap-1.5 border-b border-border/50 pb-1 last:border-0 last:pb-0">
                            <span className="text-warn font-bold shrink-0">#{idx + 1}:</span>
                            <span>{rephrase}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Action */}
                <div className="pt-2 border-t border-border flex items-center justify-between">
                  <span className="text-[10px] text-inkDim font-mono">
                    {new Date(loop.flagged_at).toLocaleTimeString()}
                  </span>
                  <Link
                    href={`/sessions/${loop.session_id}`}
                    className="text-xs text-accent hover:underline font-mono font-medium flex items-center gap-1"
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
      <Card className="border border-border bg-surface p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-2 font-mono">
            <MessagesSquare size={16} className="text-accent" /> All Conversation Sessions ({filtered.length})
          </h2>
          <span className="text-xs text-inkDim font-mono">Multi-turn session history</span>
        </div>

        {loading ? (
          <div className="text-xs font-mono text-inkDim py-8 text-center">Loading conversation sessions...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-border text-inkDim uppercase bg-paper text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Session ID</th>
                  <th className="py-2.5 px-3">User</th>
                  <th className="py-2.5 px-3">Agent</th>
                  <th className="py-2.5 px-3">Turns</th>
                  <th className="py-2.5 px-3">Total Spans</th>
                  <th className="py-2.5 px-3">Total Tokens</th>
                  <th className="py-2.5 px-3">Session Cost</th>
                  <th className="py-2.5 px-3">Last Active</th>
                  <th className="py-2.5 px-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((s) => (
                  <tr key={s.session_id} className="hover:bg-paper transition-colors">
                    <td className="py-3 px-3 font-semibold text-ink">
                      <Link href={`/sessions/${s.session_id}`} className="text-accent hover:underline flex items-center gap-1.5">
                        <MessagesSquare size={13} />
                        <span>{s.session_id}</span>
                      </Link>
                    </td>
                    <td className="text-inkDim flex items-center gap-1 py-3 px-3">
                      <User size={12} className="text-inkDim" />
                      <span>{s.user_id}</span>
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        {s.agent_id}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-ink font-semibold">{s.turn_count} turns</td>
                    <td className="py-3 px-3 text-inkDim">{s.total_spans}</td>
                    <td className="py-3 px-3 text-ink">{s.total_tokens.toLocaleString()}</td>
                    <td className="py-3 px-3 text-good font-bold">${s.total_cost.toFixed(4)}</td>
                    <td className="py-3 px-3 text-inkDim text-[11px]">{new Date(s.last_active_at).toLocaleString()}</td>
                    <td className="py-3 px-3">
                      <Link href={`/sessions/${s.session_id}`} className="text-accent hover:underline flex items-center gap-0.5 text-[11px]">
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
