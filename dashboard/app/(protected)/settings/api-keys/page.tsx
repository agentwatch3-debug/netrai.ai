import { ApiKeySettings } from "@/components/api-key-settings";

export default function ApiKeysPage() {
  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">API Keys</h1>
        <p className="mt-1 text-xs text-inkDim">
          Create scoped ingestion keys and revoke them when no longer needed.
        </p>
      </div>
      <ApiKeySettings />
    </div>
  );
}
