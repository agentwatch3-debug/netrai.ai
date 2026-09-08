"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, AlertTriangle, ArrowRight, ArrowUpRight, Bot, CheckCircle2, Cpu, DollarSign, HelpCircle, Layers, Network, RefreshCw, Share2, ShieldAlert, Sparkles, Target, Zap } from "lucide-react";
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
  clarification_count?: number;
  clarification_rate?: number;
  guessing_risk?: boolean;
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
        const rawNodes: AgentNode[] = body.nodes || [];
        const rawEdges: AgentEdge[] = body.edges || [];

        const positions: Record<string, { x: number; y: number }> = {
          orchestrator_agent: { x: 120, y: 200 },
          research_subagent: { x: 400, y: 90 },
          code_reviewer: { x: 400, y: 200 },
          sql_analyst: { x: 400, y: 310 },
          compliance_guard: { x: 680, y: 90 },
        };

        const positionedNodes = rawNodes.map((node, i) => {
          const pos = positions[node.id] || {
            x: 180 + (i % 3) * 240,
            y: 90 + Math.floor(i / 3) * 120,
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
    return <div className="text-xs font-mono text-inkDim py-4">Rendering multi-agent network topology graph...</div>;
  }

  const totalCalls = nodes.reduce((acc, n) => acc + n.total_calls, 0);
  const totalCost = nodes.reduce((acc, n) => acc + n.total_cost_usd, 0);
  const totalErrors = nodes.reduce((acc, n) => acc + n.error_count, 0);
  const totalClarifications = nodes.reduce((acc, n) => acc + (n.clarification_count || 0), 0);
  const overallErrorRate = totalCalls > 0 ? (totalErrors / totalCalls) * 100 : 0;
  const overallClarificationRate = totalCalls > 0 ? (totalClarifications / totalCalls) * 100 : 0;
  const guessingRiskAgents = nodes.filter((n) => n.clarification_rate === 0.0 || n.guessing_risk);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Multi-Agent Network Topology Graph</h1>
          <p className="mt-1 text-xs text-inkDim">
            Visual hierarchy of agent-to-agent delegations, call velocities, latency, clarification rates, and guessing risks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex border border-border bg-paper p-0.5 text-xs">
            {["1h", "24h", "7d"].map((w) => (
              <button
                key={w}
                onClick={() => setTimeWindow(w)}
                className={`px-3 py-1 font-mono transition-colors ${
                  timeWindow === w ? "bg-ink text-paper font-bold" : "text-inkDim hover:text-ink"
                }`}
              >
                {w}
              </button>
            ))}
          </div>

          <Button
            onClick={() => void loadGraphData()}
            variant="outline"
            className="h-8 text-xs flex items-center gap-1.5 font-mono"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
          </Button>
        </div>
      </div>

      {/* Hero Stats */}
      <div className="grid border border-border bg-surface sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-border">
        <div className="p-4 space-y-1">
          <span className="text-[11px] text-inkDim uppercase font-mono font-semibold">Active Agents</span>
          <p className="text-2xl font-bold text-ink font-mono">{nodes.length}</p>
          <p className="text-[10px] text-inkFaint font-mono">Autonomous interconnected units</p>
        </div>

        <div className="p-4 space-y-1">
          <span className="text-[11px] text-inkDim uppercase font-mono font-semibold">Delegations</span>
          <p className="text-2xl font-bold text-accent font-mono">{totalCalls.toLocaleString()}</p>
          <p className="text-[10px] text-inkFaint font-mono">Agent-to-agent remote calls</p>
        </div>

        <div className="p-4 space-y-1">
          <span className="text-[11px] text-inkDim uppercase font-mono font-semibold">Error Rate</span>
          <p className={`text-2xl font-bold font-mono ${overallErrorRate > 5 ? "text-bad" : "text-good"}`}>
            {overallErrorRate.toFixed(2)}%
          </p>
          <p className="text-[10px] text-inkFaint font-mono">{totalErrors} failed delegate calls</p>
        </div>

        <div className="p-4 space-y-1">
          <span className="text-[11px] text-inkDim uppercase font-mono font-semibold">Total Mesh Cost</span>
          <p className="text-2xl font-bold text-ink font-mono">${totalCost.toFixed(2)}</p>
          <p className="text-[10px] text-inkFaint font-mono">Aggregated token burn</p>
        </div>

        <div className="p-4 space-y-1">
          <span className="text-[11px] text-inkDim uppercase font-mono font-semibold">Clarification Rate</span>
          <p className={`text-2xl font-bold font-mono ${overallClarificationRate > 0 ? "text-accent" : "text-bad"}`}>
            {overallClarificationRate.toFixed(2)}%
          </p>
          <p className="text-[10px] text-inkFaint font-mono">
            {guessingRiskAgents.length > 0 ? `${guessingRiskAgents.length} guessing risk (0%)` : "Healthy clarification"}
          </p>
        </div>
      </div>

      {/* Interactive Topology Graph Canvas */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border border-border bg-surface p-4 overflow-hidden relative min-h-[460px] flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-border pb-3 mb-2">
            <div className="flex items-center gap-2">
              <Network size={16} className="text-accent" />
              <span className="text-xs font-bold text-ink uppercase tracking-wider font-mono">Delegation Mesh Canvas</span>
            </div>
            <div className="flex items-center gap-4 text-[10px] text-inkDim font-mono">
              <span className="flex items-center gap-1"><span className="h-2 w-2 bg-good inline-block" /> &lt;1% Errors</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 bg-warn inline-block" /> 1-5% Errors</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 bg-bad inline-block" /> &gt;5% Errors</span>
            </div>
          </div>

          <div className="relative w-full h-[380px] select-none bg-paper border border-border">
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
                  <polygon points="0 0, 8 3, 0 6" fill="#161616" />
                </marker>
                <marker
                  id="arrowhead-selected"
                  markerWidth="8"
                  markerHeight="6"
                  refX="7"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 8 3, 0 6" fill="#2B3A67" />
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
                    <line
                      x1={src.x}
                      y1={src.y}
                      x2={tgt.x}
                      y2={tgt.y}
                      stroke="transparent"
                      strokeWidth={16}
                    />
                    <line
                      x1={src.x}
                      y1={src.y}
                      x2={tgt.x}
                      y2={tgt.y}
                      stroke={isSelected ? "#2B3A67" : edge.error_count > 10 ? "#8C3A32" : "#A7A498"}
                      strokeWidth={isSelected ? edge.stroke_width + 1.5 : edge.stroke_width}
                      strokeDasharray={edge.error_count > 10 ? "4 2" : "none"}
                      markerEnd={isSelected ? "url(#arrowhead-selected)" : "url(#arrowhead)"}
                    />
                    <rect
                      x={midX - 28}
                      y={midY - 10}
                      width={56}
                      height={18}
                      fill="#FFFFFF"
                      stroke={isSelected ? "#2B3A67" : "#E4E2DC"}
                      strokeWidth={1}
                    />
                    <text
                      x={midX}
                      y={midY + 3}
                      textAnchor="middle"
                      fill={isSelected ? "#2B3A67" : "#6B6960"}
                      fontSize={9}
                      fontFamily="monospace"
                      fontWeight="bold"
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
                    ? "#8C3A32"
                    : node.status_color === "amber"
                    ? "#8A6A2C"
                    : "#3D6B4F";

                return (
                  <g
                    key={node.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelectedNode(node);
                      setSelectedEdge(null);
                    }}
                  >
                    {isSelected && (
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={30}
                        fill="none"
                        stroke="#161616"
                        strokeWidth={2}
                        strokeDasharray="3 3"
                      />
                    )}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={24}
                      fill="#FFFFFF"
                      stroke={strokeColor}
                      strokeWidth={2}
                    />
                    <text
                      x={node.x}
                      y={node.y + 4}
                      textAnchor="middle"
                      fill="#161616"
                      fontSize={10}
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {node.id.substring(0, 3).toUpperCase()}
                    </text>
                    <text
                      x={node.x}
                      y={node.y + 38}
                      textAnchor="middle"
                      fill="#161616"
                      fontSize={11}
                      fontWeight="600"
                    >
                      {node.label}
                    </text>
                    <text
                      x={node.x}
                      y={node.y + 50}
                      textAnchor="middle"
                      fill="#6B6960"
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

          <div className="border-t border-border pt-2 text-[11px] text-inkDim font-mono flex items-center justify-between">
            <span>💡 Click any directed edge to inspect filtered traces.</span>
            <span>Click any agent node to inspect delegate performance.</span>
          </div>
        </Card>

        {/* Details Panel / Edge Trace Inspector */}
        <div className="space-y-4">
          {selectedEdge ? (
            <Card className="border border-border bg-surface p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-accent font-mono uppercase font-bold">Directed Relationship</span>
                  <h3 className="text-sm font-bold text-ink font-mono flex items-center gap-1.5">
                    {selectedEdge.source} <ArrowRight size={13} className="text-accent" /> {selectedEdge.target}
                  </h3>
                </div>
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {selectedEdge.call_count} Calls
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="border border-border bg-paper p-2">
                  <span className="text-[10px] text-inkDim uppercase">Avg Latency</span>
                  <p className="font-bold text-ink">{selectedEdge.avg_latency_ms} ms</p>
                </div>
                <div className="border border-border bg-paper p-2">
                  <span className="text-[10px] text-inkDim uppercase">Errors</span>
                  <p className={`font-bold ${selectedEdge.error_count > 0 ? "text-bad" : "text-good"}`}>
                    {selectedEdge.error_count}
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-border">
                <span className="text-[11px] font-mono font-bold text-inkDim uppercase tracking-wider">
                  Delegation Traces ({traces.length})
                </span>

                {loadingTraces ? (
                  <div className="text-xs font-mono text-inkDim py-4 text-center">Loading traces...</div>
                ) : (
                  <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1 font-mono">
                    {traces.map((t) => (
                      <div key={t.span_id} className="border border-border bg-paper p-2.5 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <Badge variant={t.status === "error" ? "bad" : "good"} className="text-[9px]">
                            {t.status.toUpperCase()}
                          </Badge>
                          <span className="text-[10px] text-inkDim">{t.latency_ms} ms</span>
                        </div>

                        {t.error_message && (
                          <p className="text-[11px] text-bad">{t.error_message}</p>
                        )}

                        <div className="flex items-center justify-between pt-1 border-t border-border text-[10px] text-inkDim">
                          <span>${t.cost_usd.toFixed(4)}</span>
                          <Link href={`/traces/${t.trace_id}`} className="text-accent hover:underline flex items-center gap-0.5">
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
            <Card className="border border-border bg-surface p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center border border-border bg-paper text-accent">
                    <Bot size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-ink font-mono">{selectedNode.label}</h3>
                    <span className="font-mono text-[10px] text-inkDim">{selectedNode.id}</span>
                  </div>
                </div>
                <Badge
                  variant={
                    selectedNode.status_color === "rose"
                      ? "bad"
                      : selectedNode.status_color === "amber"
                      ? "warn"
                      : "good"
                  }
                  className="text-[10px] font-mono"
                >
                  {selectedNode.error_rate}% ERRORS
                </Badge>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between py-1 border-b border-border">
                  <span className="text-inkDim">Total Invocations:</span>
                  <span className="text-ink font-bold">{selectedNode.total_calls.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border">
                  <span className="text-inkDim">Avg Latency:</span>
                  <span className="text-ink font-bold">{selectedNode.avg_latency_ms} ms</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border">
                  <span className="text-inkDim">Total Spent:</span>
                  <span className="text-ink font-bold">${selectedNode.total_cost_usd.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border">
                  <span className="text-inkDim">Error Count:</span>
                  <span className={selectedNode.error_count > 0 ? "text-bad font-bold" : "text-inkDim"}>
                    {selectedNode.error_count}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border">
                  <span className="text-inkDim">Clarification Rate:</span>
                  <span className={`font-bold ${(selectedNode.clarification_rate ?? 0) > 0 ? "text-accent" : "text-bad"}`}>
                    {(selectedNode.clarification_rate ?? 0).toFixed(2)}% ({selectedNode.clarification_count ?? 0} calls)
                  </span>
                </div>
              </div>

              {(selectedNode.clarification_rate === 0 || selectedNode.guessing_risk) ? (
                <div className="border border-bad/40 bg-bad/5 p-3 space-y-1.5 text-xs font-mono">
                  <div className="flex items-center gap-1.5 text-bad font-semibold">
                    <AlertTriangle size={13} />
                    <span>0% Clarification (Guessing Risk)</span>
                  </div>
                  <p className="text-[11px] text-ink leading-relaxed">
                    This agent has never requested clarification on ambiguous user queries. 0% clarification rate with non-zero error rate strongly signals blind guessing, driving expensive retry loops.
                  </p>
                </div>
              ) : (
                <div className="border border-good/40 bg-good/5 p-2.5 text-xs text-ink flex items-center gap-2 font-mono text-[11px]">
                  <CheckCircle2 size={13} className="text-good shrink-0" />
                  <span>Intent threshold active: Agent requests clarification on low confidence.</span>
                </div>
              )}

              <div className="space-y-2 pt-1">
                <span className="text-[11px] font-mono font-bold text-inkDim uppercase">Connected Edges</span>
                <div className="space-y-1 text-xs font-mono">
                  {edges
                    .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
                    .map((e) => (
                      <button
                        key={e.id}
                        onClick={() => void handleSelectEdge(e)}
                        className="w-full text-left bg-paper border border-border p-2 hover:border-ink transition-colors flex items-center justify-between"
                      >
                        <span className="text-[11px] text-ink">
                          {e.source === selectedNode.id ? `Calls ➔ ${e.target}` : `Called by ⬅ ${e.source}`}
                        </span>
                        <span className="text-[10px] text-accent font-bold">{e.call_count} calls</span>
                      </button>
                    ))}
                </div>
              </div>
            </Card>
          ) : null}
        </div>
      </div>

      {/* Agent Clarification Overview Table */}
      <Card className="border border-border bg-surface p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <HelpCircle size={16} className="text-accent" />
            <h3 className="text-xs font-bold text-ink uppercase tracking-wider font-mono">Agent Clarification Rates vs. Guessing Risk Analysis</h3>
          </div>
          <Badge variant="secondary" className="text-[10px] font-mono">
            SDK intent_confidence_threshold Policy
          </Badge>
        </div>

        <p className="text-xs text-inkDim leading-relaxed font-sans">
          When <code className="text-accent font-mono">trace_llm(model, intent_confidence_threshold=0.7)</code> is enabled, agents returning intent confidence below threshold bypass tool execution and request clarification. Teams with <span className="text-bad font-semibold">0% clarification rate</span> on ambiguous inputs are a strong signal of blind guessing, which correlates directly with costly multi-turn misunderstanding retry loops.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="border-b border-border text-inkDim text-[11px] bg-paper uppercase">
              <tr>
                <th className="py-2.5 px-3">Agent / ID</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3 text-right">Invocations</th>
                <th className="py-2.5 px-3 text-right">Clarifications</th>
                <th className="py-2.5 px-3 text-right">Clarification Rate</th>
                <th className="py-2.5 px-3 text-right">Error Rate</th>
                <th className="py-2.5 px-3 text-center">Status / Assessment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {nodes.map((node) => (
                <tr key={node.id} className="hover:bg-paper transition-colors">
                  <td className="py-2.5 px-3 font-bold text-ink">
                    <button
                      onClick={() => {
                        setSelectedNode(node);
                        setSelectedEdge(null);
                      }}
                      className="hover:text-accent text-left"
                    >
                      {node.label}
                      <span className="block text-[10px] font-normal text-inkDim">{node.id}</span>
                    </button>
                  </td>
                  <td className="py-2.5 px-3 text-inkDim">{node.role || "Autonomous Agent"}</td>
                  <td className="py-2.5 px-3 text-right text-ink">{node.total_calls.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right text-accent font-semibold">
                    {(node.clarification_count ?? 0).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <span className={`font-bold ${(node.clarification_rate ?? 0) > 0 ? "text-accent" : "text-bad"}`}>
                      {(node.clarification_rate ?? 0).toFixed(2)}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <span className={node.error_rate > 5 ? "text-bad font-bold" : "text-good"}>
                      {node.error_rate}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {(node.clarification_rate === 0 || node.guessing_risk) ? (
                      <Badge variant="bad" className="text-[10px]">
                        ⚠️ 0% Rate (Guessing Risk)
                      </Badge>
                    ) : (
                      <Badge variant="good" className="text-[10px]">
                        ✓ Calibrated Confidence
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
