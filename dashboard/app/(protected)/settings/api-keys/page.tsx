import { ApiKeySettings } from "@/components/api-key-settings";
export default function ApiKeysPage() { return <><div className="mb-6"><h1 className="text-xl font-semibold">API keys</h1><p className="text-sm text-slate-400">Create scoped ingestion keys and revoke them when no longer needed.</p></div><ApiKeySettings/></>; }
