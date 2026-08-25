"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Bot, Clock, DollarSign, MessagesSquare, Search, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/sessions")
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((body) => setSessions(body.data || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = sessions.filter((s) =>
    s.session_id.toLowerCase().includes(search.toLowerCase()) ||
    s.user_id.toLowerCase().includes(search.toLowerCase()) ||
    s.agent_id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Sessions & Multi-Turn Conversations</h1>
          <p className="text-sm text-slate-400">
            Grouped multi-turn agent threads, user sessions, conversation replays, and turn-level cost analytics.
          </p>
        </div>

        <div className="relative w-72">
          <Search size={14} className="absolute left-3 top-3 text-slate-500" />
          <input
            className="w-full h-9 rounded-lg border border-slate-800 bg-slate-900 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            placeholder="Search by session_id, user_id..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-slate-400">Loading conversation sessions...</div>
      ) : (
        <Card className="border-slate-800 bg-slate-900/40 p-6 overflow-x-auto">
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
        </Card>
      )}
    </div>
  );
}
