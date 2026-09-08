"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, CheckCircle2, ChevronRight, Copy, FileCode2, History, Plus, Play, Tag, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PromptItem {
  id?: number;
  name: string;
  description?: string;
  tags?: string[];
  latest_version?: number;
  production_version?: number;
  model?: string;
  updated_at?: string;
}

interface PromptVersion {
  id?: number;
  version: number;
  template: string;
  model: string;
  model_parameters?: Record<string, any>;
  labels?: string[];
  author?: string;
  commit_message?: string;
  created_at: string;
}

interface PromptDetail {
  name: string;
  description?: string;
  tags?: string[];
  versions: PromptVersion[];
}

export function PromptsManager() {
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [detail, setDetail] = useState<PromptDetail | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<PromptVersion | null>(null);
  const [loading, setLoading] = useState(true);

  // New prompt modal
  const [showCreatePrompt, setShowCreatePrompt] = useState(false);
  const [newPromptName, setNewPromptName] = useState("");
  const [newPromptDesc, setNewPromptDesc] = useState("");

  // New version editor state
  const [editorTemplate, setEditorTemplate] = useState("");
  const [editorModel, setEditorModel] = useState("gpt-4.1-mini");
  const [editorCommitMsg, setEditorCommitMsg] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);

  // Playground variable inputs
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [compiledPreview, setCompiledPreview] = useState("");

  async function loadPrompts() {
    try {
      const res = await fetch("/api/prompts");
      if (res.ok) {
        const data = await res.json();
        const promptList = Array.isArray(data) ? data : (data?.data || []);
        setPrompts(promptList);
        if (promptList.length > 0 && !selectedPrompt) {
          void selectPrompt(promptList[0].name);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function selectPrompt(name: string) {
    setSelectedPrompt(name);
    const res = await fetch(`/api/prompts/${name}`);
    if (res.ok) {
      const data: PromptDetail = await res.json();
      const versions = data?.versions || [];
      setDetail({ ...data, versions });
      if (versions.length > 0) {
        const currentProd = versions.find((v) => v.labels?.includes("production")) || versions[0];
        setSelectedVersion(currentProd);
        setEditorTemplate(currentProd.template);
        setEditorModel(currentProd.model || "gpt-4.1-mini");
      }
    }
  }

  useEffect(() => {
    void loadPrompts();
  }, []);

  // Detect variables in active template
  useEffect(() => {
    const text = selectedVersion ? selectedVersion.template : editorTemplate;
    const matches = Array.from(text.matchAll(/\{\{([a-zA-Z0-9_-]+)\}\}/g)).map((m) => m[1]);
    const unique = Array.from(new Set(matches));
    setVariables((prev) => {
      const next: Record<string, string> = {};
      unique.forEach((k) => {
        next[k] = prev[k] || `[sample_${k}]`;
      });
      return next;
    });
  }, [selectedVersion, editorTemplate]);

  // Update compiled live preview
  useEffect(() => {
    let result = selectedVersion ? selectedVersion.template : editorTemplate;
    Object.entries(variables).forEach(([k, v]) => {
      result = result.replaceAll(`{{${k}}}`, v);
    });
    setCompiledPreview(result);
  }, [variables, selectedVersion, editorTemplate]);

  async function handleCreatePrompt(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newPromptName, description: newPromptDesc }),
    });
    if (res.ok) {
      setShowCreatePrompt(false);
      setNewPromptName("");
      setNewPromptDesc("");
      await loadPrompts();
      await selectPrompt(newPromptName);
    }
  }

  async function handlePublishVersion(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPrompt) return;
    setIsPublishing(true);
    try {
      const res = await fetch(`/api/prompts/${selectedPrompt}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: editorTemplate,
          model: editorModel,
          commit_message: editorCommitMsg || "Updated template",
          labels: ["production"],
        }),
      });
      if (res.ok) {
        setEditorCommitMsg("");
        await loadPrompts();
        await selectPrompt(selectedPrompt);
      }
    } finally {
      setIsPublishing(false);
    }
  }

  async function handlePromote(version: number, label: string = "production") {
    if (!selectedPrompt) return;
    const res = await fetch(`/api/prompts/${selectedPrompt}/versions/${version}/promote?label=${label}`, {
      method: "POST",
    });
    if (res.ok) {
      await loadPrompts();
      await selectPrompt(selectedPrompt);
    }
  }

  if (loading) {
    return <div className="text-xs font-mono text-inkDim py-4">Loading prompt templates...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-ink">Prompt Templates & Version Control</h2>
          <p className="text-xs text-inkDim">Manage, test, and instantly promote prompt versions across your agents.</p>
        </div>
        <Button onClick={() => setShowCreatePrompt(true)} variant="primary" className="flex items-center gap-1.5 text-xs h-8">
          <Plus size={14} /> New Prompt
        </Button>
      </div>

      {showCreatePrompt && (
        <form onSubmit={handleCreatePrompt} className="border border-border bg-surface p-4 space-y-3">
          <h3 className="text-xs font-bold text-ink uppercase tracking-wider">Create New Prompt Template</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className="h-8 border border-border bg-surface px-3 text-xs text-ink placeholder-inkFaint focus:border-ink focus:outline-none font-mono"
              placeholder="Prompt Slug (e.g. customer_support_triage)"
              value={newPromptName}
              onChange={(e) => setNewPromptName(e.target.value)}
              required
            />
            <input
              className="h-8 border border-border bg-surface px-3 text-xs text-ink placeholder-inkFaint focus:border-ink focus:outline-none"
              placeholder="Description (Optional)"
              value={newPromptDesc}
              onChange={(e) => setNewPromptDesc(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" onClick={() => setShowCreatePrompt(false)} variant="outline" className="text-xs h-7">Cancel</Button>
            <Button type="submit" variant="primary" className="text-xs h-7">Create Prompt</Button>
          </div>
        </form>
      )}

      {/* Main Split Layout: Prompt List vs Prompt Detail / Editor */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left column: Prompts library */}
        <div className="space-y-2 lg:col-span-4">
          <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-inkDim block pb-1 border-b border-border">
            Prompt Library ({prompts.length})
          </span>
          <div className="space-y-1.5">
            {prompts.map((p) => {
              const isSelected = selectedPrompt === p.name;
              return (
                <div
                  key={p.name}
                  onClick={() => void selectPrompt(p.name)}
                  className={`cursor-pointer border p-3 transition-colors ${
                    isSelected
                      ? "border-ink bg-accentSoft text-ink"
                      : "border-border bg-surface text-ink hover:border-borderStrong hover:bg-paper"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-mono text-xs font-semibold text-ink">
                      <FileCode2 size={14} className={isSelected ? "text-accent" : "text-inkDim"} />
                      <span>{p.name}</span>
                    </div>
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      v{p.production_version || p.latest_version || 1}
                    </Badge>
                  </div>
                  {p.description && <p className="mt-1 line-clamp-1 text-[11px] text-inkDim">{p.description}</p>}
                  <div className="mt-2 flex items-center justify-between text-[10px] text-inkDim font-mono border-t border-border/50 pt-1.5">
                    <span>{p.model || "gpt-4.1-mini"}</span>
                    <span className="text-good flex items-center gap-1 font-semibold">
                      <CheckCircle2 size={10} /> Prod v{p.production_version || 1}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column: Active Prompt Details & Editor */}
        <div className="space-y-6 lg:col-span-8">
          {detail ? (
            <>
              {/* Header & Version Selector */}
              <Card className="border border-border bg-surface p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-ink font-mono">{detail.name}</h2>
                      <Badge variant="good" className="text-[10px] font-mono">
                        Prod v{(detail.versions || []).find((v) => v.labels?.includes("production"))?.version || 1}
                      </Badge>
                    </div>
                    {detail.description && <p className="text-xs text-inkDim mt-1">{detail.description}</p>}
                  </div>
                </div>

                {/* Version History Chips */}
                <div className="space-y-2">
                  <span className="text-[11px] font-mono font-semibold text-inkDim uppercase tracking-wider flex items-center gap-1.5">
                    <History size={13} /> Version History
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(detail.versions || []).map((v) => {
                      const isSelected = selectedVersion?.version === v.version;
                      const isProd = v.labels?.includes("production");
                      return (
                        <button
                          key={v.version}
                          onClick={() => {
                            setSelectedVersion(v);
                            setEditorTemplate(v.template);
                            setEditorModel(v.model);
                          }}
                          className={`flex items-center gap-1.5 border px-2.5 py-1 text-xs font-mono transition-colors ${
                            isSelected
                              ? "border-ink bg-ink text-paper font-bold"
                              : "border-border bg-surface text-ink hover:border-borderStrong hover:bg-paper"
                          }`}
                        >
                          <span>v{v.version}</span>
                          {isProd && <Badge variant="good" className="text-[9px] px-1 py-0">PROD</Badge>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selected Version Metadata & Promotion */}
                {selectedVersion && (
                  <div className="flex flex-wrap items-center justify-between gap-3 border border-border bg-paper p-3 text-xs font-mono">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 text-ink">
                        <span className="font-bold">Version {selectedVersion.version}</span>
                        <span>·</span>
                        <span className="text-inkDim">{selectedVersion.model}</span>
                        {selectedVersion.commit_message && (
                          <>
                            <span>·</span>
                            <span className="italic text-inkDim">"{selectedVersion.commit_message}"</span>
                          </>
                        )}
                      </div>
                      <p className="text-[10px] text-inkFaint">Created: {new Date(selectedVersion.created_at).toLocaleString()}</p>
                    </div>

                    {!selectedVersion.labels?.includes("production") && (
                      <Button
                        onClick={() => void handlePromote(selectedVersion.version, "production")}
                        variant="accent"
                        className="text-xs h-7 px-2.5 flex items-center gap-1"
                      >
                        <CheckCircle2 size={12} /> Promote to Production
                      </Button>
                    )}
                  </div>
                )}
              </Card>

              {/* Editor & Publish New Version */}
              <Card className="border border-border bg-surface p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <span className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles size={14} className="text-accent" /> Prompt Template Editor
                  </span>
                  <span className="text-[11px] text-inkDim font-mono">Use {"{{variable}}"} for dynamic variables</span>
                </div>

                <form onSubmit={handlePublishVersion} className="space-y-3">
                  <textarea
                    className="w-full h-44 border border-border bg-paper p-3 font-mono text-xs text-ink placeholder-inkFaint focus:border-ink focus:outline-none"
                    value={editorTemplate}
                    onChange={(e) => setEditorTemplate(e.target.value)}
                    placeholder="Enter prompt template with {{variables}}..."
                    required
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      className="h-8 border border-border bg-surface px-3 text-xs text-ink placeholder-inkFaint focus:border-ink focus:outline-none"
                      placeholder="Commit Message (e.g. Added safety constraints)"
                      value={editorCommitMsg}
                      onChange={(e) => setEditorCommitMsg(e.target.value)}
                    />
                    <select
                      className="h-8 border border-border bg-surface px-3 text-xs text-ink focus:border-ink focus:outline-none font-mono"
                      value={editorModel}
                      onChange={(e) => setEditorModel(e.target.value)}
                    >
                      <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                      <option value="gpt-4o">gpt-4o</option>
                      <option value="claude-3-5-haiku">claude-3-5-haiku</option>
                      <option value="claude-3-7-sonnet">claude-3-7-sonnet</option>
                    </select>
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button type="submit" disabled={isPublishing} variant="primary" className="text-xs h-8">
                      {isPublishing ? "Publishing..." : "Publish New Version"}
                    </Button>
                  </div>
                </form>
              </Card>

              {/* Dynamic Variables Live Playground */}
              <Card className="border border-border bg-surface p-5 space-y-4">
                <div className="border-b border-border pb-2">
                  <span className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                    <Play size={14} className="text-good" /> Variable Substitution Playground
                  </span>
                </div>

                {Object.keys(variables).length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {Object.keys(variables).map((k) => (
                      <div key={k} className="space-y-1">
                        <label className="text-[10px] font-mono font-bold text-inkDim">{`{{${k}}}`}</label>
                        <input
                          className="w-full h-8 border border-border bg-surface px-2.5 text-xs text-ink placeholder-inkFaint focus:border-ink focus:outline-none font-mono"
                          value={variables[k]}
                          onChange={(e) => setVariables({ ...variables, [k]: e.target.value })}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-inkDim italic font-mono">No {"{{variables}}"} detected in this prompt template.</p>
                )}

                <div className="space-y-1.5 pt-2 border-t border-border">
                  <span className="text-[10px] font-mono font-bold text-inkDim uppercase">Compiled Live Preview</span>
                  <pre className="max-h-48 overflow-auto border border-border bg-paper p-3 font-mono text-xs text-ink">
                    {compiledPreview}
                  </pre>
                </div>
              </Card>
            </>
          ) : (
            <div className="border border-border bg-surface p-12 text-center text-inkDim text-xs font-mono">
              Select a prompt from the library to view versions, test variables, and edit templates.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
