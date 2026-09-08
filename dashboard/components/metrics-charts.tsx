"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { AnalyticsPoint } from "@/lib/types";

const charts = [
  {
    key: "cost_usd",
    title: "Daily Spend ($)",
    kind: "area",
    stroke: "#2B3A67",
    fill: "#EEF0F5",
    format: (v: number) => `$${v.toFixed(2)}`,
  },
  {
    key: "prompt_tokens",
    title: "Daily Token Volume",
    kind: "bar",
    stroke: "#2B3A67",
    format: (v: number) => v.toLocaleString(),
  },
  {
    key: "error_rate",
    title: "Error Rate (%)",
    kind: "line",
    stroke: "#8C3A32",
    format: (v: number) => `${(v * 100).toFixed(1)}%`,
  },
  {
    key: "p95_latency_ms",
    title: "p50 / p95 Latency (ms)",
    kind: "line",
    stroke: "#3D6B4F",
    format: (v: number) => `${v} ms`,
  },
];

export function MetricsCharts({ data }: { data: AnalyticsPoint[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {charts.map(({ key, title, kind, format, stroke, fill }) => (
        <Card className="h-72 p-4 border border-border bg-surface rounded-none" key={key}>
          <div className="flex items-center justify-between mb-3 border-b border-border pb-2">
            <h2 className="text-xs uppercase tracking-wide text-inkFaint font-medium font-sans">
              {title}
            </h2>
            <span className="text-[10px] font-mono text-inkDim">Last 30 Days</span>
          </div>

          <ResponsiveContainer width="100%" height="84%">
            {kind === "area" ? (
              <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="#E4E2DC" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6B6960", fontFamily: "JetBrains Mono" }} stroke="#CFCCC3" />
                <YAxis tick={{ fontSize: 10, fill: "#6B6960", fontFamily: "JetBrains Mono" }} stroke="#CFCCC3" />
                <Tooltip
                  formatter={format}
                  contentStyle={{ backgroundColor: "#161616", color: "#FAFAF8", border: "1px solid #CFCCC3", borderRadius: 0, fontSize: "11px", fontFamily: "JetBrains Mono" }}
                />
                <Area dataKey={key} type="monotone" stroke={stroke} fill={fill} fillOpacity={0.8} />
              </AreaChart>
            ) : kind === "bar" ? (
              <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="#E4E2DC" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6B6960", fontFamily: "JetBrains Mono" }} stroke="#CFCCC3" />
                <YAxis tick={{ fontSize: 10, fill: "#6B6960", fontFamily: "JetBrains Mono" }} stroke="#CFCCC3" />
                <Tooltip
                  formatter={format}
                  contentStyle={{ backgroundColor: "#161616", color: "#FAFAF8", border: "1px solid #CFCCC3", borderRadius: 0, fontSize: "11px", fontFamily: "JetBrains Mono" }}
                />
                <Bar dataKey="prompt_tokens" stackId="a" fill="#2B3A67" radius={[0, 0, 0, 0]} />
                <Bar dataKey="completion_tokens" stackId="a" fill="#6B6960" radius={[0, 0, 0, 0]} />
              </BarChart>
            ) : (
              <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="#E4E2DC" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6B6960", fontFamily: "JetBrains Mono" }} stroke="#CFCCC3" />
                <YAxis tick={{ fontSize: 10, fill: "#6B6960", fontFamily: "JetBrains Mono" }} stroke="#CFCCC3" />
                <Tooltip
                  formatter={format}
                  contentStyle={{ backgroundColor: "#161616", color: "#FAFAF8", border: "1px solid #CFCCC3", borderRadius: 0, fontSize: "11px", fontFamily: "JetBrains Mono" }}
                />
                <Line dataKey={key} type="monotone" stroke={stroke} dot={false} strokeWidth={1.5} />
                {key === "p95_latency_ms" && (
                  <Line dataKey="p50_latency_ms" type="monotone" stroke="#6B6960" dot={false} strokeWidth={1.5} strokeDasharray="3 3" />
                )}
              </LineChart>
            )}
          </ResponsiveContainer>
        </Card>
      ))}
    </div>
  );
}
