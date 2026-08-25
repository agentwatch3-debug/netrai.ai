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
    return <div className="text-sm text-slate-400">Loading prompt templates...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Prompt Templates & Version Control</h2>
          <p className="text-xs text-slate-400">Manage, test, and instantly promote prompt versions across your agents.</p>
        </div>
        <Button onClick={() => setShowCreatePrompt(true)} className="flex items-center gap-1.5 bg-blue-600 text-xs hover:bg-blue-500">
          <Plus size={14} /> New Prompt
        </Button>
      </div>

      {showCreatePrompt && (
        <form onSubmit={handleCreatePrompt} className="rounded-lg border border-blue-900/60 bg-slate-950/80 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-blue-300">Create New Prompt Template</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className="h-9 rounded border border-slate-800 bg-slate-900 px-3 text-xs text-white"
              placeholder="Prompt Slug (e.g. customer_support_triage)"
              value={newPromptName}
              onChange={(e) => setNewPromptName(e.target.value)}
              required
            />
            <input
              className="h-9 rounded border border-slate-800 bg-slate-900 px-3 text-xs text-white"
              placeholder="Description (Optional)"
              value={newPromptDesc}
              onChange={(e) => setNewPromptDesc(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={() => setShowCreatePrompt(false)} className="bg-slate-800 text-xs">Cancel</Button>
            <Button type="submit" className="bg-blue-600 text-xs hover:bg-blue-500">Create Prompt</Button>
          </div>
        </form>
      )}

      {/* Main Split Layout: Prompt List vs Prompt Detail / Editor */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left column: Prompts library */}
        <div className="space-y-3 lg:col-span-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Prompt Library</span>
          <div className="space-y-2">
            {prompts.map((p) => {
              const isSelected = selectedPrompt === p.name;
              return (
                <div
                  key={p.name}
                  onClick={() => void selectPrompt(p.name)}
                  className={`cursor-pointer rounded-lg border p-3 transition-all ${
                    isSelected
                      ? "border-blue-500/80 bg-blue-950/20 text-white"
                      : "border-slate-800 bg-slate-900/40 text-slate-300 hover:border-slate-700 hover:bg-slate-900/70"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-mono text-xs font-semibold">
                      <FileCode2 size={14} className={isSelected ? "text-blue-400" : "text-slate-500"} />
                      <span>{p.name}</span>
                    </div>
                    <Badge className="bg-slate-800 text-[10px] text-slate-300">
                      v{p.production_version || p.latest_version || 1}
                    </Badge>
                  </div>
                  {p.description && <p className="mt-1.5 line-clamp-1 text-[11px] text-slate-400">{p.description}</p>}
                  <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                    <span>Model: {p.model || "gpt-4.1-mini"}</span>
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 size={10} /> Production v{p.production_version || 1}
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
              <Card className="border-slate-800 bg-slate-900/40 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-white font-mono">{detail.name}</h2>
                      <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800/60 text-[10px]">
                        Production: v{(detail.versions || []).find((v) => v.labels?.includes("production"))?.version || 1}
                      </Badge>
                    </div>
                    {detail.description && <p className="text-xs text-slate-400 mt-1">{detail.description}</p>}
                  </div>
                </div>

                {/* Version History Chips */}
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <History size={13} /> Version History
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
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
                          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-mono transition-all ${
                            isSelected
                              ? "border-blue-500 bg-blue-950/40 text-blue-300 font-bold"
                              : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700"
                          }`}
                        >
                          <span>v{v.version}</span>
                          {isProd && <Badge className="bg-emerald-950 text-emerald-300 text-[9px] px-1 py-0">PROD</Badge>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selected Version Metadata & Promotion */}
                {selectedVersion && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/80 p-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-slate-300">
                        <span className="font-semibold">Version {selectedVersion.version}</span>
                        <span>·</span>
                        <span className="text-slate-400">{selectedVersion.model}</span>
                        {selectedVersion.commit_message && (
                          <>
                            <span>·</span>
                            <span className="italic text-slate-400">"{selectedVersion.commit_message}"</span>
                          </>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500">Created: {new Date(selectedVersion.created_at).toLocaleString()}</p>
                    </div>

                    {!selectedVersion.labels?.includes("production") && (
                      <Button
                        onClick={() => void handlePromote(selectedVersion.version, "production")}
                        className="bg-emerald-600 hover:bg-emerald-500 text-xs h-7 px-2.5 flex items-center gap-1"
                      >
                        <CheckCircle2 size={12} /> Promote to Production
                      </Button>
                    )}
                  </div>
                )}
              </Card>

              {/* Editor & Publish New Version */}
              <Card className="border-slate-800 bg-slate-900/40 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles size={14} className="text-blue-400" /> Prompt Template Editor
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">Use {"{{variable}}"} for dynamic variables</span>
                </div>

                <form onSubmit={handlePublishVersion} className="space-y-3">
                  <textarea
                    className="w-full h-44 rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
                    value={editorTemplate}
                    onChange={(e) => setEditorTemplate(e.target.value)}
                    placeholder="Enter prompt template with {{variables}}..."
                    required
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      className="h-8 rounded border border-slate-800 bg-slate-950 px-3 text-xs text-white"
                      placeholder="Commit Message (e.g. Added safety constraints)"
                      value={editorCommitMsg}
                      onChange={(e) => setEditorCommitMsg(e.target.value)}
                    />
                    <select
                      className="h-8 rounded border border-slate-800 bg-slate-950 px-3 text-xs text-white"
                      value={editorModel}
                      onChange={(e) => setEditorModel(e.target.value)}
                    >
                      <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                      <option value="gpt-4o">gpt-4o</option>
                      <option value="claude-3-5-haiku">claude-3-5-haiku</option>
                      <option value="claude-3-7-sonnet">claude-3-7-sonnet</option>
                    </select>
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={isPublishing} className="bg-blue-600 hover:bg-blue-500 text-xs">
                      {isPublishing ? "Publishing..." : "Publish New Version"}
                    </Button>
                  </div>
                </form>
              </Card>

              {/* Dynamic Variables Live Playground */}
              <Card className="border-slate-800 bg-slate-900/40 p-5 space-y-4">
                <span className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Play size={14} className="text-emerald-400" /> Variable Substitution Playground
                </span>

                {Object.keys(variables).length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {Object.keys(variables).map((k) => (
                      <div key={k} className="space-y-1">
                        <label className="text-[10px] font-mono font-medium text-slate-400">{`{{${k}}}`}</label>
                        <input
                          className="w-full h-8 rounded border border-slate-800 bg-slate-950 px-2.5 text-xs text-white"
                          value={variables[k]}
                          onChange={(e) => setVariables({ ...variables, [k]: e.target.value })}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No {"{{variables}}"} detected in this prompt template.</p>
                )}

                <div className="space-y-1.5 pt-2">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Compiled Live Preview</span>
                  <pre className="max-h-48 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-emerald-300">
                    {compiledPreview}
                  </pre>
                </div>
              </Card>
            </>
          ) : (
            <div className="rounded-lg border border-slate-800 bg-slate-900/20 p-12 text-center text-slate-400 text-sm">
              Select a prompt from the library to view versions, test variables, and edit templates.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
