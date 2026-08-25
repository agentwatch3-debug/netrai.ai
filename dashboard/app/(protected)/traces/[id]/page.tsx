import { TraceWaterfall } from "@/components/trace-waterfall";
export default function TraceDetailPage({ params }: { params: { id: string } }) { return <><div className="mb-6"><h1 className="font-mono text-xl font-semibold">Trace {params.id}</h1><p className="text-sm text-slate-400">Expand spans to inspect masked inputs and outputs.</p></div><TraceWaterfall traceId={params.id}/></>; }
