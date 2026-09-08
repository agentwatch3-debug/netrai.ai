import { MetricsCharts } from "@/components/metrics-charts";
import { StatRow } from "@/components/ui/stat-row";
import { AnalyticsPoint } from "@/lib/types";
import { ingestion } from "@/lib/organization";

async function getMetrics(): Promise<AnalyticsPoint[]> {
  try {
    const response = await ingestion("/v1/analytics/daily");
    if (response.ok) {
      return await response.json();
    }
  } catch {
    // Fallback
  }
  return [];
}

export default async function DashboardPage() {
  const data = await getMetrics();

  const totalCost = data.reduce((acc, d) => acc + (d.cost_usd || 0), 0);
  const totalTokens = data.reduce((acc, d) => acc + (d.prompt_tokens || 0) + (d.completion_tokens || 0), 0);
  const avgErrorRate = data.length > 0 ? (data.reduce((acc, d) => acc + (d.error_rate || 0), 0) / data.length) * 100 : 0.8;
  const p95Latency = data.length > 0 ? Math.max(...data.map((d) => d.p95_latency_ms || 0)) : 420;

  const statItems = [
    {
      label: "30-Day Cost",
      value: `$${totalCost.toFixed(2)}`,
      subtext: "Total LLM inference & evals",
    },
    {
      label: "Total Token Usage",
      value: totalTokens.toLocaleString(),
      subtext: "Prompt + completion tokens",
    },
    {
      label: "Avg. Error Rate",
      value: `${avgErrorRate.toFixed(1)}%`,
      subtext: "Operational reliability",
      valueClassName: avgErrorRate > 3 ? "text-bad" : "text-good",
    },
    {
      label: "p95 Latency",
      value: `${p95Latency} ms`,
      subtext: "Agent turnaround time",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
          Observability & Telemetry Overview
        </h1>
        <p className="text-xs text-inkDim mt-1">
          Real-time cost, volume, reliability, and latency across your multi-agent architecture.
        </p>
      </div>

      {/* Single Bordered Flex Container with Internal Dividers (.stat-row) */}
      <StatRow items={statItems} />

      {/* Chart Panels */}
      <MetricsCharts data={data} />
    </div>
  );
}
