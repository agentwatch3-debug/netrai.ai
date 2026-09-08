"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";

export function ApiKeySettings() {
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [keyId, setKeyId] = useState("");

  async function create(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (response.ok) {
      setNewKey((await response.json()).key);
      setName("");
    }
  }

  async function revoke() {
    await fetch(`/api/api-keys/${keyId}`, { method: "DELETE" });
    setKeyId("");
  }

  return (
    <div className="max-w-xl space-y-6">
      <form className="flex gap-2" onSubmit={create}>
        <input
          className="h-8 flex-1 border border-border bg-surface px-3 text-xs text-ink placeholder-inkFaint focus:border-ink focus:outline-none font-mono"
          placeholder="Key name (e.g. production-backend)"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <Button variant="primary" className="h-8 text-xs font-mono">
          Create key
        </Button>
      </form>

      {newKey && (
        <div className="border border-warn/40 bg-warn/10 p-3 text-xs font-mono space-y-1">
          <p className="text-warn font-bold">Copy this key now. It will not be shown again.</p>
          <code className="block break-all bg-surface border border-border p-2 text-ink select-all">
            {newKey}
          </code>
        </div>
      )}

      <div className="flex gap-2 border-t border-border pt-5">
        <input
          className="h-8 flex-1 border border-border bg-surface px-3 text-xs text-ink placeholder-inkFaint focus:border-ink focus:outline-none font-mono"
          placeholder="API key ID to revoke"
          value={keyId}
          onChange={(event) => setKeyId(event.target.value)}
        />
        <Button variant="destructive" className="h-8 text-xs font-mono" type="button" onClick={() => void revoke()}>
          Revoke
        </Button>
      </div>
    </div>
  );
}
