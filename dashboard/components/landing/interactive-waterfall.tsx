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
    color: "bg-accent",
    payload: {
      input: "Customer asks for automated refund policy under compliance consent #cs_901.",
      output: "Refund processed under verified DPDP consent. Verification token: 0x88f9.",
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
        color: "bg-good",
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
        color: "bg-ink",
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
            color: "bg-warn",
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
    <div className="rounded-sm border border-border bg-surface shadow-none flex flex-col h-full overflow-hidden">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-border bg-paper px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-none bg-good" />
          <span className="text-xs font-mono font-bold text-ink">Live Trace Waterfall Simulator</span>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-mono text-inkDim">
          <span className="border border-border bg-surface px-2 py-0.5 rounded-sm text-ink font-mono font-semibold">
            340ms • 1,420 tkns • $0.0028
          </span>
        </div>
      </div>

      {/* Waterfall Visualizer */}
      <div className="p-4 space-y-2 border-b border-border bg-surface font-mono text-xs">
        {/* Row 1: Root Agent */}
        <div
          onClick={() => setSelectedSpan(DEMO_SPANS[0])}
          className={`group flex items-center justify-between p-2 rounded-sm cursor-pointer transition-colors ${
            selectedSpan.id === "span_root"
              ? "bg-accentSoft border border-accent"
              : "hover:bg-paper border border-transparent"
          }`}
        >
          <div className="flex items-center gap-2 w-1/3 truncate">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand("span_root");
              }}
              className="text-inkDim hover:text-ink"
            >
              {expanded.span_root ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            <Bot size={13} className="text-accent shrink-0" />
            <span className="font-semibold text-ink truncate">support_orchestrator</span>
          </div>

          <div className="flex-1 mx-3 h-5 bg-paper border border-border rounded-none overflow-hidden relative">
            <div
              className={`h-full ${DEMO_SPANS[0].color} text-white flex items-center px-1.5`}
              style={{ width: "100%" }}
            >
              <span className="text-[10px] font-mono font-bold">340ms</span>
            </div>
          </div>

          <span className="text-[11px] text-inkDim w-16 text-right font-mono">340ms</span>
        </div>

        {/* Row 2: Tool Span */}
        {expanded.span_root && (
          <div
            onClick={() => setSelectedSpan(DEMO_SPANS[0].children![0])}
            className={`group flex items-center justify-between p-2 pl-6 rounded-sm cursor-pointer transition-colors ${
              selectedSpan.id === "span_tool"
                ? "bg-good/10 border border-good"
                : "hover:bg-paper border border-transparent"
            }`}
          >
            <div className="flex items-center gap-2 w-1/3 truncate">
              <Wrench size={12} className="text-good shrink-0" />
              <span className="text-ink truncate">query_vector_kb</span>
            </div>

            <div className="flex-1 mx-3 h-5 bg-paper border border-border rounded-none overflow-hidden relative">
              <div
                className={`h-full ${DEMO_SPANS[0].children![0].color} text-white flex items-center px-1.5`}
                style={{ marginLeft: "10%", width: "22%" }}
              >
                <span className="text-[10px] font-mono font-bold">65ms</span>
              </div>
            </div>

            <span className="text-[11px] text-good font-bold w-16 text-right font-mono">65ms</span>
          </div>
        )}

        {/* Row 3: Child Agent Span */}
        {expanded.span_root && (
          <div
            onClick={() => setSelectedSpan(DEMO_SPANS[0].children![1])}
            className={`group flex items-center justify-between p-2 pl-6 rounded-sm cursor-pointer transition-colors ${
              selectedSpan.id === "span_child_agent"
                ? "bg-accentSoft border border-ink"
                : "hover:bg-paper border border-transparent"
            }`}
          >
            <div className="flex items-center gap-2 w-1/3 truncate">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand("span_child_agent");
                }}
                className="text-inkDim hover:text-ink"
              >
                {expanded.span_child_agent ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              <Network size={12} className="text-ink shrink-0" />
              <span className="text-ink font-semibold truncate">fraud_evaluator</span>
            </div>

            <div className="flex-1 mx-3 h-5 bg-paper border border-border rounded-none overflow-hidden relative">
              <div
                className={`h-full ${DEMO_SPANS[0].children![1].color} text-white flex items-center px-1.5`}
                style={{ marginLeft: "35%", width: "58%" }}
              >
                <span className="text-[10px] font-mono font-bold">195ms</span>
              </div>
            </div>

            <span className="text-[11px] text-ink font-bold w-16 text-right font-mono">195ms</span>
          </div>
        )}

        {/* Row 4: Nested LLM */}
        {expanded.span_root && expanded.span_child_agent && (
          <div
            onClick={() => setSelectedSpan(DEMO_SPANS[0].children![1].children![0])}
            className={`group flex items-center justify-between p-2 pl-12 rounded-sm cursor-pointer transition-colors ${
              selectedSpan.id === "span_llm"
                ? "bg-warn/10 border border-warn"
                : "hover:bg-paper border border-transparent"
            }`}
          >
            <div className="flex items-center gap-2 w-1/3 truncate">
              <Cpu size={12} className="text-warn shrink-0" />
              <span className="text-ink truncate">gpt-4.1-mini</span>
            </div>

            <div className="flex-1 mx-3 h-5 bg-paper border border-border rounded-none overflow-hidden relative">
              <div
                className={`h-full ${DEMO_SPANS[0].children![1].children![0].color} text-white flex items-center px-1.5`}
                style={{ marginLeft: "45%", width: "45%" }}
              >
                <span className="text-[10px] font-mono font-bold">140ms</span>
              </div>
            </div>

            <span className="text-[11px] text-warn font-bold w-16 text-right font-mono">140ms</span>
          </div>
        )}
      </div>

      {/* Selected Span Inspector Card */}
      <div className="p-4 bg-paper text-xs font-mono space-y-2 flex-1">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-ink uppercase">{selectedSpan.name}</span>
            <Badge variant="neutral" className="border-border text-ink text-[10px] font-mono">{selectedSpan.type.toUpperCase()}</Badge>
          </div>
          <div className="flex items-center gap-1.5 text-good text-[11px] font-semibold font-mono">
            <ShieldCheck size={13} />
            <span>Prompt Shield: 0.00 Risk</span>
          </div>
        </div>

        <div className="rounded-none bg-surface border border-border p-2.5 text-[11px] text-ink overflow-x-auto space-y-1">
          <div className="text-inkDim uppercase text-[10px] font-semibold">Payload Inspector:</div>
          <pre className="text-ink font-mono">{JSON.stringify(selectedSpan.payload, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}
