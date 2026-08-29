import Link from "next/link";
import { ArrowLeft, Bot, CheckCircle2, Copy, Cpu, Globe, KeyRound, Terminal, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export default function McpSetupDocPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-mono text-blue-400 hover:underline"
          >
            <ArrowLeft size={14} /> Back to Home
          </Link>
          <Badge className="bg-purple-950/80 text-purple-300 border-purple-800 text-[10px] font-mono">
            Model Context Protocol v1.0
          </Badge>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600/20 border border-purple-500/40 text-purple-400">
              <Bot size={18} />
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white">
              Native MCP (Model Context Protocol) Server Setup
            </h1>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed">
            Connect Claude Desktop, Cursor, and autonomous agent swarms directly to your NetrAI telemetry database via standard MCP tools and resources.
          </p>
        </div>

        <Card className="border-slate-800 bg-slate-900/40 p-6 rounded-2xl space-y-4">
          <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
            <Terminal size={15} className="text-purple-400" /> 1. Claude Desktop Configuration
          </h2>
          <p className="text-xs text-slate-300">
            Add NetrAI to your <code className="text-purple-400">claude_desktop_config.json</code> file:
          </p>
          <pre className="rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-purple-300 overflow-x-auto">
{`{
  "mcpServers": {
    "netrai": {
      "command": "agentwatch",
      "args": ["mcp", "--serve"],
      "env": {
        "AGENTWATCH_ENDPOINT": "https://agentwatch-19dt.vercel.app",
        "AGENTWATCH_API_KEY": "aw_live_YOUR_API_KEY"
      }
    }
  }
}`}
          </pre>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 p-6 rounded-2xl space-y-4">
          <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
            <Cpu size={15} className="text-blue-400" /> 2. Available MCP Tools
          </h2>
          <div className="space-y-3 font-mono text-xs text-slate-300">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <code className="text-blue-400 font-bold block">query_agent_traces(agent_id, limit)</code>
              <span className="text-[11px] text-slate-400">Retrieve hierarchical waterfall traces and latency distributions.</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <code className="text-emerald-400 font-bold block">get_security_alerts(severity, hours)</code>
              <span className="text-[11px] text-slate-400">Inspect blocked prompt injections, jailbreak attempts, and risk scores.</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <code className="text-amber-400 font-bold block">trigger_cost_circuit_breaker(agent_id)</code>
              <span className="text-[11px] text-slate-400">Instantly halt runaway agent tool loops exceeding spend thresholds.</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
