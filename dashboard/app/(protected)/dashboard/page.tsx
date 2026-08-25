import { MetricsCharts } from "@/components/metrics-charts";
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

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-slate-400">
          Cost, volume, reliability, and latency across your agents.
        </p>
      </div>
      <MetricsCharts data={data} />
    </>
  );
}
