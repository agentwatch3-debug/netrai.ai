"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ArrowRight, ArrowUpRight, Bot, Cpu, DollarSign, Layers, Network, RefreshCw, Share2, ShieldAlert, Sparkles, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface AgentNode {
  id: string;
  label: string;
  role?: string;
  total_calls: number;
  avg_latency_ms: number;
  error_count: number;
  error_rate: number;
  total_cost_usd: number;
  status_color: "emerald" | "amber" | "rose";
  x?: number;
  y?: number;
}

interface AgentEdge {
  id: string;
  source: string;
  target: string;
  call_count: number;
  avg_latency_ms: number;
  error_count: number;
  stroke_width: number;
}

interface RelationshipTrace {
  trace_id: string;
  span_id: string;
  name: string;
  latency_ms: number;
  cost_usd: number;
  status: string;
  error_message: string | null;
  started_at: string;
}

export default function MultiAgentGraphPage() {
  const [nodes, setNodes] = useState<AgentNode[]>([]);
  const [edges, setEdges] = useState<AgentEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeWindow, setTimeWindow] = useState("24h");

  // Selection states
  const [selectedEdge, setSelectedEdge] = useState<AgentEdge | null>(null);
  const [selectedNode, setSelectedNode] = useState<AgentNode | null>(null);
  const [traces, setTraces] = useState<RelationshipTrace[]>([]);
  const [loadingTraces, setLoadingTraces] = useState(false);

  async function loadGraphData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/agents/graph?time_window=${timeWindow}`);
      if (res.ok) {
        const body = await res.json();
        // Compute layout positions for nodes
        const rawNodes: AgentNode[] = body.nodes || [];
        const rawEdges: AgentEdge[] = body.edges || [];

        // Fixed layout for clean presentation
        const positions: Record<string, { x: number; y: number }> = {
          orchestrator_agent: { x: 120, y: 220 },
          research_subagent: { x: 420, y: 100 },
          code_reviewer: { x: 420, y: 220 },
          sql_analyst: { x: 420, y: 340 },
          compliance_guard: { x: 720, y: 100 },
        };

        const positionedNodes = rawNodes.map((node, i) => {
          const pos = positions[node.id] || {
            x: 200 + (i % 3) * 260,
            y: 100 + Math.floor(i / 3) * 140,
          };
          return { ...node, x: pos.x, y: pos.y };
        });

        setNodes(positionedNodes);
        setEdges(rawEdges);
        if (rawNodes.length > 0 && !selectedNode) {
          setSelectedNode(positionedNodes[0]);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadGraphData();
  }, [timeWindow]);

  async function handleSelectEdge(edge: AgentEdge) {
    setSelectedEdge(edge);
    setSelectedNode(null);
    setLoadingTraces(true);
    try {
      const res = await fetch(
        `/api/agents/relationship-traces?source=${encodeURIComponent(edge.source)}&target=${encodeURIComponent(edge.target)}`
      );
      if (res.ok) {
        const body = await res.json();
        setTraces(body.data || []);
      }
    } finally {
      setLoadingTraces(false);
    }
  }

  if (loading && nodes.length === 0) {
    return <div className="text-sm text-slate-400">Rendering multi-agent network topology graph...</div>;
  }

  const totalCalls = nodes.reduce((acc, n) => acc + n.total_calls, 0);
  const totalCost = nodes.reduce((acc, n) => acc + n.total_cost_usd, 0);
  const totalErrors = nodes.reduce((acc, n) => acc + n.error_count, 0);
  const overallErrorRate = totalCalls > 0 ? (totalErrors / totalCalls) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Multi-Agent Network Topology Graph</h1>
          <p className="text-sm text-slate-400">
            Real-time visual hierarchy of agent-to-agent delegations, call velocities, latency, and error rates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-slate-900 border border-slate-800 p-0.5 text-xs">
            {["1h", "24h", "7d"].map((w) => (
              <button
                key={w}
                onClick={() => setTimeWindow(w)}
                className={`px-3 py-1 rounded-md font-mono ${
                  timeWindow === w ? "bg-blue-600 text-white font-bold" : "text-slate-400 hover:text-white"
                }`}
              >
                {w}
              </button>
            ))}
          </div>

          <Button
            onClick={() => void loadGraphData()}
            className="h-8 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
          </Button>
        </div>
      </div>

      {/* Hero Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border-slate-800 bg-slate-900/40 p-4 space-y-1">
          <span className="text-[11px] text-slate-400 uppercase font-semibold">Active Agents</span>
          <p className="text-2xl font-bold text-white font-mono">{nodes.length}</p>
          <p className="text-[10px] text-slate-500">Autonomous interconnected units</p>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 p-4 space-y-1">
          <span className="text-[11px] text-slate-400 uppercase font-semibold">Delegated Invocations</span>
          <p className="text-2xl font-bold text-blue-400 font-mono">{totalCalls.toLocaleString()}</p>
          <p className="text-[10px] text-slate-500">Agent-to-agent remote calls</p>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 p-4 space-y-1">
          <span className="text-[11px] text-slate-400 uppercase font-semibold">System Error Rate</span>
          <p className={`text-2xl font-bold font-mono ${overallErrorRate > 5 ? "text-red-400" : "text-emerald-400"}`}>
            {overallErrorRate.toFixed(2)}%
          </p>
          <p className="text-[10px] text-slate-500">{totalErrors} failed delegate calls</p>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 p-4 space-y-1">
          <span className="text-[11px] text-slate-400 uppercase font-semibold">Total Mesh Cost</span>
          <p className="text-2xl font-bold text-amber-400 font-mono">${totalCost.toFixed(2)}</p>
          <p className="text-[10px] text-slate-500">Aggregated LLM token burn</p>
        </Card>
      </div>

      {/* Interactive Topology Graph Canvas */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-slate-800 bg-slate-950 p-4 overflow-hidden relative min-h-[460px] flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-900 pb-3 mb-2">
            <div className="flex items-center gap-2">
              <Network size={16} className="text-blue-400" />
              <span className="text-xs font-semibold text-white">Delegation Mesh Canvas</span>
            </div>
            <div className="flex items-center gap-4 text-[10px] text-slate-400 font-mono">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> &lt;1% Errors</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> 1-5% Errors</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> &gt;5% Errors</span>
            </div>
          </div>

          <div className="relative w-full h-[380px] select-none">
            <svg className="w-full h-full">
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="8"
                  markerHeight="6"
                  refX="7"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 8 3, 0 6" fill="#3b82f6" />
                </marker>
                <marker
                  id="arrowhead-selected"
                  markerWidth="8"
                  markerHeight="6"
                  refX="7"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 8 3, 0 6" fill="#38bdf8" />
                </marker>
              </defs>

              {/* Render Directed Edges */}
              {edges.map((edge) => {
                const src = nodes.find((n) => n.id === edge.source);
                const tgt = nodes.find((n) => n.id === edge.target);
                if (!src || !tgt || src.x === undefined || src.y === undefined || tgt.x === undefined || tgt.y === undefined) return null;

                const isSelected = selectedEdge?.id === edge.id;
                const midX = (src.x + tgt.x) / 2;
                const midY = (src.y + tgt.y) / 2;

                return (
                  <g key={edge.id} className="cursor-pointer" onClick={() => void handleSelectEdge(edge)}>
                    {/* Invisible thick hover target */}
                    <line
                      x1={src.x}
                      y1={src.y}
                      x2={tgt.x}
                      y2={tgt.y}
                      stroke="transparent"
                      strokeWidth={16}
                    />
                    {/* Visible line */}
                    <line
                      x1={src.x}
                      y1={src.y}
                      x2={tgt.x}
                      y2={tgt.y}
                      stroke={isSelected ? "#38bdf8" : edge.error_count > 10 ? "#f43f5e" : "#3b82f6"}
                      strokeWidth={isSelected ? edge.stroke_width + 2 : edge.stroke_width}
                      strokeDasharray={edge.error_count > 10 ? "4 2" : "none"}
                      markerEnd={isSelected ? "url(#arrowhead-selected)" : "url(#arrowhead)"}
                      className="transition-all hover:stroke-sky-400"
                    />
                    {/* Edge Latency Badge */}
                    <rect
                      x={midX - 28}
                      y={midY - 10}
                      width={56}
                      height={18}
                      rx={4}
                      fill="#090d16"
                      stroke={isSelected ? "#38bdf8" : "#1e293b"}
                      strokeWidth={1}
                    />
                    <text
                      x={midX}
                      y={midY + 3}
                      textAnchor="middle"
                      fill={isSelected ? "#38bdf8" : "#94a3b8"}
                      fontSize={9}
                      fontFamily="monospace"
                    >
                      {edge.call_count} · {edge.avg_latency_ms}ms
                    </text>
                  </g>
                );
              })}

              {/* Render Agent Nodes */}
              {nodes.map((node) => {
                if (node.x === undefined || node.y === undefined) return null;
                const isSelected = selectedNode?.id === node.id;
                const strokeColor =
                  node.status_color === "rose"
                    ? "#f43f5e"
                    : node.status_color === "amber"
                    ? "#f59e0b"
                    : "#10b981";

                return (
                  <g
                    key={node.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelectedNode(node);
                      setSelectedEdge(null);
                    }}
                  >
                    {/* Outer glow circle if selected */}
                    {isSelected && (
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={34}
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth={2}
                        strokeDasharray="3 3"
                        className="animate-spin"
                      />
                    )}
                    {/* Main Node Circle */}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={26}
                      fill="#0f172a"
                      stroke={strokeColor}
                      strokeWidth={2.5}
                      className="transition-transform hover:scale-105"
                    />
                    {/* Icon or Initials */}
                    <text
                      x={node.x}
                      y={node.y + 4}
                      textAnchor="middle"
                      fill="#f8fafc"
                      fontSize={11}
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {node.id.substring(0, 3).toUpperCase()}
                    </text>
                    {/* Label below node */}
                    <text
                      x={node.x}
                      y={node.y + 42}
                      textAnchor="middle"
                      fill="#e2e8f0"
                      fontSize={11}
                      fontWeight="600"
                    >
                      {node.label}
                    </text>
                    <text
                      x={node.x}
                      y={node.y + 55}
                      textAnchor="middle"
                      fill="#64748b"
                      fontSize={9}
                      fontFamily="monospace"
                    >
                      {node.error_rate}% err · {node.total_calls} calls
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="border-t border-slate-900 pt-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span>💡 Click any directed edge arrow to inspect filtered agent-to-agent traces.</span>
            <span>Click any agent node to inspect its delegate performance.</span>
          </div>
        </Card>

        {/* Details Panel / Edge Trace Inspector */}
        <div className="space-y-4">
          {selectedEdge ? (
            /* Selected Edge Inspector */
            <Card className="border-blue-900/60 bg-blue-950/20 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-blue-900/60 pb-3">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-blue-400 font-mono uppercase font-bold">Directed Relationship</span>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    {selectedEdge.source} <ArrowRight size={13} className="text-blue-400" /> {selectedEdge.target}
                  </h3>
                </div>
                <Badge className="bg-blue-950 text-blue-300 border-blue-800 text-[10px] font-mono">
                  {selectedEdge.call_count} Calls
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="rounded bg-slate-950/80 p-2 border border-slate-800">
                  <span className="text-[10px] text-slate-500">Avg Latency</span>
                  <p className="font-bold text-white">{selectedEdge.avg_latency_ms} ms</p>
                </div>
                <div className="rounded bg-slate-950/80 p-2 border border-slate-800">
                  <span className="text-[10px] text-slate-500">Errors</span>
                  <p className={`font-bold ${selectedEdge.error_count > 0 ? "text-red-400" : "text-emerald-400"}`}>
                    {selectedEdge.error_count}
                  </p>
                </div>
              </div>

              {/* Filtered Trace List */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                  Delegation Traces ({traces.length})
                </span>

                {loadingTraces ? (
                  <div className="text-xs text-slate-400 py-4 text-center">Loading traces...</div>
                ) : (
                  <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                    {traces.map((t) => (
                      <div key={t.span_id} className="rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <Badge
                            className={
                              t.status === "error"
                                ? "bg-red-950 text-red-300 border-red-800 text-[9px]"
                                : "bg-emerald-950 text-emerald-300 border-emerald-800 text-[9px]"
                            }
                          >
                            {t.status.toUpperCase()}
                          </Badge>
                          <span className="text-[10px] text-slate-500 font-mono">{t.latency_ms} ms</span>
                        </div>

                        {t.error_message && (
                          <p className="text-[11px] text-red-300 font-mono">{t.error_message}</p>
                        )}

                        <div className="flex items-center justify-between pt-1 border-t border-slate-900 text-[10px] font-mono text-slate-400">
                          <span>${t.cost_usd.toFixed(4)}</span>
                          <Link href={`/traces/${t.trace_id}`} className="text-blue-400 hover:underline flex items-center gap-0.5">
                            Inspect Waterfall <ArrowUpRight size={10} />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ) : selectedNode ? (
            /* Selected Node Inspector */
            <Card className="border-slate-800 bg-slate-900/40 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-950 border border-blue-800/60 text-blue-400">
                    <Bot size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{selectedNode.label}</h3>
                    <span className="font-mono text-[10px] text-slate-400">{selectedNode.id}</span>
                  </div>
                </div>
                <Badge
                  className={
                    selectedNode.status_color === "rose"
                      ? "bg-red-950 text-red-300 border-red-800 text-[10px]"
                      : selectedNode.status_color === "amber"
                      ? "bg-amber-950 text-amber-300 border-amber-800 text-[10px]"
                      : "bg-emerald-950 text-emerald-300 border-emerald-800 text-[10px]"
                  }
                >
                  {selectedNode.error_rate}% ERRORS
                </Badge>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Total Invocations:</span>
                  <span className="text-white font-bold">{selectedNode.total_calls.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Avg Latency:</span>
                  <span className="text-white font-bold">{selectedNode.avg_latency_ms} ms</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Total Spent:</span>
                  <span className="text-amber-400 font-bold">${selectedNode.total_cost_usd.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Error Count:</span>
                  <span className={selectedNode.error_count > 0 ? "text-red-400 font-bold" : "text-slate-400"}>
                    {selectedNode.error_count}
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <span className="text-[11px] font-semibold text-slate-400 uppercase">Connected Edges</span>
                <div className="space-y-1 text-xs">
                  {edges
                    .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
                    .map((e) => (
                      <button
                        key={e.id}
                        onClick={() => void handleSelectEdge(e)}
                        className="w-full text-left rounded bg-slate-950 border border-slate-800 p-2 hover:border-blue-500 transition-colors flex items-center justify-between"
                      >
                        <span className="font-mono text-[11px] text-slate-300">
                          {e.source === selectedNode.id ? `Calls ➔ ${e.target}` : `Called by ⬅ ${e.source}`}
                        </span>
                        <span className="text-[10px] text-blue-400 font-mono">{e.call_count} calls</span>
                      </button>
                    ))}
                </div>
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
