"use client";

import { useState } from "react";
import { Bot, ChevronDown, ChevronRight, Cpu, Database, Eye, Lock, Network, ShieldCheck, Sparkles, Terminal, Wrench, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DemoSpan {
  id: string;
  name: string;
  type: "agent" | "tool" | "llm";
  duration_ms: number;
  tokens?: number;
  cost_usd?: number;
  status: "success" | "warning";
  payload: any;
  offset_pct: number;
  width_pct: number;
  color: string;
  children?: DemoSpan[];
}

const DEMO_SPANS: DemoSpan[] = [
  {
    id: "span_root",
    name: "support_orchestrator",
    type: "agent",
    duration_ms: 340,
    tokens: 1420,
    cost_usd: 0.0028,
    status: "success",
    offset_pct: 0,
    width_pct: 100,
    color: "from-blue-500 to-indigo-500",
    payload: {
      input: "Customer asks for automated refund policy under compliance consent #cs_901.",
      output: "Refund processed under verified GDPR consent. Verification token: 0x88f9.",
    },
    children: [
      {
        id: "span_tool",
        name: "query_vector_kb",
        type: "tool",
        duration_ms: 65,
        status: "success",
        offset_pct: 10,
        width_pct: 22,
        color: "from-emerald-400 to-teal-500",
        payload: {
          query: "refund eligibility criteria",
          results: 3,
        },
      },
      {
        id: "span_child_agent",
        name: "fraud_risk_evaluator",
        type: "agent",
        duration_ms: 195,
        tokens: 840,
        cost_usd: 0.0016,
        status: "success",
        offset_pct: 35,
        width_pct: 58,
        color: "from-purple-500 to-pink-500",
        payload: {
          account_age_days: 420,
          chargeback_risk: 0.01,
          recommendation: "APPROVE_IMMEDIATELY",
        },
        children: [
          {
            id: "span_llm",
            name: "gpt-4.1-mini",
            type: "llm",
            duration_ms: 140,
            tokens: 520,
            cost_usd: 0.0009,
            status: "success",
            offset_pct: 45,
            width_pct: 45,
            color: "from-amber-400 to-orange-500",
            payload: {
              prompt: "Evaluate refund risk for low-risk established customer...",
              completion: "Risk score: 0.01 (Extremely Low). Approved.",
            },
          },
        ],
      },
    ],
  },
];

export function InteractiveWaterfallSimulator() {
  const [selectedSpan, setSelectedSpan] = useState<DemoSpan>(DEMO_SPANS[0]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    span_root: true,
    span_child_agent: true,
  });

  function toggleExpand(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/90 shadow-2xl overflow-hidden backdrop-blur-xl flex flex-col h-full">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-white/10 bg-slate-900/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-mono font-bold text-white">Live Trace Waterfall Simulator</span>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
          <Badge className="bg-emerald-950/80 text-emerald-300 border-emerald-800 text-[10px] font-mono">
            340ms • 1,420 tkns • $0.0028
          </Badge>
        </div>
      </div>

      {/* Waterfall Visualizer */}
      <div className="p-4 space-y-2 border-b border-white/5 bg-slate-950/40 font-mono text-xs">
        {/* Row 1: Root Agent */}
        <div
          onClick={() => setSelectedSpan(DEMO_SPANS[0])}
          className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
            selectedSpan.id === "span_root"
              ? "bg-blue-950/40 border border-blue-600/50"
              : "hover:bg-slate-900/50 border border-transparent"
          }`}
        >
          <div className="flex items-center gap-2 w-1/3 truncate">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand("span_root");
              }}
              className="text-slate-400 hover:text-white"
            >
              {expanded.span_root ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            <Bot size={13} className="text-blue-400 shrink-0" />
            <span className="font-semibold text-white truncate">support_orchestrator</span>
          </div>

          <div className="flex-1 mx-3 h-5 bg-slate-900 rounded overflow-hidden relative">
            <div
              className={`h-full rounded bg-gradient-to-r ${DEMO_SPANS[0].color} opacity-90 shadow-sm flex items-center px-1.5`}
              style={{ width: "100%" }}
            >
              <span className="text-[10px] text-white font-bold drop-shadow">340ms</span>
            </div>
          </div>

          <span className="text-[11px] text-slate-400 w-16 text-right">340ms</span>
        </div>

        {/* Row 2: Tool Span */}
        {expanded.span_root && (
          <div
            onClick={() => setSelectedSpan(DEMO_SPANS[0].children![0])}
            className={`group flex items-center justify-between p-2 pl-6 rounded-lg cursor-pointer transition-colors ${
              selectedSpan.id === "span_tool"
                ? "bg-emerald-950/40 border border-emerald-600/50"
                : "hover:bg-slate-900/50 border border-transparent"
            }`}
          >
            <div className="flex items-center gap-2 w-1/3 truncate">
              <Wrench size={12} className="text-emerald-400 shrink-0" />
              <span className="text-slate-200 truncate">query_vector_kb</span>
            </div>

            <div className="flex-1 mx-3 h-5 bg-slate-900 rounded overflow-hidden relative">
              <div
                className={`h-full rounded bg-gradient-to-r ${DEMO_SPANS[0].children![0].color} opacity-90 flex items-center px-1.5`}
                style={{ marginLeft: "10%", width: "22%" }}
              >
                <span className="text-[10px] text-white font-bold drop-shadow">65ms</span>
              </div>
            </div>

            <span className="text-[11px] text-emerald-400 w-16 text-right">65ms</span>
          </div>
        )}

        {/* Row 3: Child Agent Span */}
        {expanded.span_root && (
          <div
            onClick={() => setSelectedSpan(DEMO_SPANS[0].children![1])}
            className={`group flex items-center justify-between p-2 pl-6 rounded-lg cursor-pointer transition-colors ${
              selectedSpan.id === "span_child_agent"
                ? "bg-purple-950/40 border border-purple-600/50"
                : "hover:bg-slate-900/50 border border-transparent"
            }`}
          >
            <div className="flex items-center gap-2 w-1/3 truncate">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand("span_child_agent");
                }}
                className="text-slate-400 hover:text-white"
              >
                {expanded.span_child_agent ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              <Network size={12} className="text-purple-400 shrink-0" />
              <span className="text-purple-200 font-semibold truncate">fraud_evaluator</span>
            </div>

            <div className="flex-1 mx-3 h-5 bg-slate-900 rounded overflow-hidden relative">
              <div
                className={`h-full rounded bg-gradient-to-r ${DEMO_SPANS[0].children![1].color} opacity-90 flex items-center px-1.5`}
                style={{ marginLeft: "35%", width: "58%" }}
              >
                <span className="text-[10px] text-white font-bold drop-shadow">195ms</span>
              </div>
            </div>

            <span className="text-[11px] text-purple-300 w-16 text-right">195ms</span>
          </div>
        )}

        {/* Row 4: Nested LLM */}
        {expanded.span_root && expanded.span_child_agent && (
          <div
            onClick={() => setSelectedSpan(DEMO_SPANS[0].children![1].children![0])}
            className={`group flex items-center justify-between p-2 pl-12 rounded-lg cursor-pointer transition-colors ${
              selectedSpan.id === "span_llm"
                ? "bg-amber-950/40 border border-amber-600/50"
                : "hover:bg-slate-900/50 border border-transparent"
            }`}
          >
            <div className="flex items-center gap-2 w-1/3 truncate">
              <Cpu size={12} className="text-amber-400 shrink-0" />
              <span className="text-amber-200 truncate">gpt-4.1-mini</span>
            </div>

            <div className="flex-1 mx-3 h-5 bg-slate-900 rounded overflow-hidden relative">
              <div
                className={`h-full rounded bg-gradient-to-r ${DEMO_SPANS[0].children![1].children![0].color} opacity-90 flex items-center px-1.5`}
                style={{ marginLeft: "45%", width: "45%" }}
              >
                <span className="text-[10px] text-white font-bold drop-shadow">140ms</span>
              </div>
            </div>

            <span className="text-[11px] text-amber-400 w-16 text-right">140ms</span>
          </div>
        )}
      </div>

      {/* Selected Span Inspector Card */}
      <div className="p-4 bg-slate-950 text-xs font-mono space-y-2 flex-1">
        <div className="flex items-center justify-between border-b border-slate-900 pb-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white uppercase">{selectedSpan.name}</span>
            <Badge className="bg-slate-800 text-slate-200 text-[10px]">{selectedSpan.type.toUpperCase()}</Badge>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-400 text-[11px]">
            <ShieldCheck size={13} />
            <span>Prompt Shield: 0.00 Risk</span>
          </div>
        </div>

        <div className="rounded bg-slate-900/60 p-2.5 text-[11px] text-slate-300 overflow-x-auto space-y-1">
          <div className="text-slate-500 uppercase text-[10px]">Payload Inspector:</div>
          <pre className="text-slate-200">{JSON.stringify(selectedSpan.payload, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}
