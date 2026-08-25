"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowUpRight, CheckCircle2, Copy, ExternalLink, Globe, KeyRound, Lock, RefreshCw, Save, Shield, ShieldAlert, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SSOConfig {
  id?: number;
  org_id: string;
  plan_tier: string;
  sso_enabled: boolean;
  provider: "okta" | "azure_ad" | "google_workspace" | "saml_custom" | string;
  domain: string;
  idp_entity_id: string;
  idp_sso_url: string;
  idp_certificate: string;
  idp_metadata_url?: string;
  enforce_sso: boolean;
  allow_idp_initiated: boolean;
  status: "active" | "pending" | "disabled";
  acs_url?: string;
  sp_entity_id?: string;
}

export default function EnterpriseSSOPage() {
  const [config, setConfig] = useState<SSOConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Form states
  const [provider, setProvider] = useState("okta");
  const [domain, setDomain] = useState("acmewatch.com");
  const [idpEntityId, setIdpEntityId] = useState("http://www.okta.com/exk88921aZ012");
  const [idpSsoUrl, setIdpSsoUrl] = useState("https://acmewatch.okta.com/app/agentwatch/exk88921aZ012/sso/saml");
  const [idpCertificate, setIdpCertificate] = useState("-----BEGIN CERTIFICATE-----\nMIIDqjCCApKgAwIBAgIGAZ20...\n-----END CERTIFICATE-----");
  const [enforceSso, setEnforceSso] = useState(true);
  const [allowIdpInitiated, setAllowIdpInitiated] = useState(true);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/sso");
      if (res.ok) {
        const body = await res.json();
        const data: SSOConfig = body.data || {};
        setConfig(data);
        if (data.provider) setProvider(data.provider);
        if (data.domain) setDomain(data.domain);
        if (data.idp_entity_id) setIdpEntityId(data.idp_entity_id);
        if (data.idp_sso_url) setIdpSsoUrl(data.idp_sso_url);
        if (data.idp_certificate) setIdpCertificate(data.idp_certificate);
        if (data.enforce_sso !== undefined) setEnforceSso(data.enforce_sso);
        if (data.allow_idp_initiated !== undefined) setAllowIdpInitiated(data.allow_idp_initiated);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  function copyText(text: string, field: string) {
    void navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch("/api/settings/sso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          domain,
          idp_entity_id: idpEntityId,
          idp_sso_url: idpSsoUrl,
          idp_certificate: idpCertificate,
          enforce_sso: enforceSso,
          allow_idp_initiated: allowIdpInitiated,
        }),
      });
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/sso/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idp_sso_url: idpSsoUrl,
          idp_entity_id: idpEntityId,
          idp_certificate: idpCertificate,
        }),
      });
      if (res.ok) {
        const body = await res.json();
        setTestResult({
          success: body.success !== false,
          message: body.message || "Connection handshake successful.",
        });
      } else {
        setTestResult({ success: false, message: "Handshake failed." });
      }
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-slate-400">Loading Enterprise SSO configuration...</div>;
  }

  const isEnterprise = (config?.plan_tier || "enterprise") === "enterprise";

  if (!isEnterprise) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Enterprise Single Sign-On (SSO)</h1>
          <p className="text-sm text-slate-400">
            SAML 2.0 and OIDC authentication for Okta, Microsoft Azure AD (Entra ID), and Google Workspace.
          </p>
        </div>

        <Card className="border-amber-900/60 bg-amber-950/20 p-8 text-center space-y-4 max-w-2xl mx-auto">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-950 border border-amber-800 text-amber-400 mx-auto">
            <Lock size={24} />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-white">Enterprise Tier Feature</h2>
            <p className="text-xs text-slate-300 max-w-md mx-auto">
              Single Sign-On (SAML 2.0 / OIDC) and Just-In-Time (JIT) provisioning are exclusive to the Enterprise Plan.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-left max-w-md mx-auto text-xs text-slate-400 pt-2 font-mono">
            <div className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-emerald-400" /> Okta & Azure AD SAML 2.0</div>
            <div className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-emerald-400" /> Automated JIT Provisioning</div>
            <div className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-emerald-400" /> Domain-wide Enforcement</div>
            <div className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-emerald-400" /> Dedicated Security SLA</div>
          </div>

          <div className="pt-4">
            <Link href="/settings/billing">
              <Button className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold px-6">
                Upgrade to Enterprise Plan
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const acsUrl = config?.acs_url || "https://app.agentwatch.dev/api/auth/sso/saml/callback";
  const spEntityId = config?.sp_entity_id || "https://app.agentwatch.dev/api/auth/sso/saml/metadata";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Enterprise Single Sign-On (SAML 2.0)</h1>
          <p className="text-sm text-slate-400">
            Connect your corporate Identity Provider (IdP) for unified authentication and centralized user access control.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/docs/sso-setup"
            className="text-xs text-blue-400 hover:underline flex items-center gap-1 font-mono"
          >
            IdP Setup Manual <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>

      {/* Service Provider (SP) Metadata Box */}
      <Card className="border-slate-800 bg-slate-900/40 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-blue-400" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              AgentWatch Service Provider (SP) Coordinates
            </h2>
          </div>
          <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800 text-[10px] font-mono">
            SAML 2.0 READY
          </Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 text-xs">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Assertion Consumer Service (ACS) URL</span>
            <div className="flex items-center justify-between rounded bg-slate-950 border border-slate-800 p-2 font-mono text-[11px] text-slate-300">
              <span className="truncate mr-2">{acsUrl}</span>
              <button onClick={() => copyText(acsUrl, "acs")} className="text-slate-400 hover:text-white">
                <Copy size={12} className={copiedField === "acs" ? "text-emerald-400" : ""} />
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Entity ID / Audience URI</span>
            <div className="flex items-center justify-between rounded bg-slate-950 border border-slate-800 p-2 font-mono text-[11px] text-slate-300">
              <span className="truncate mr-2">{spEntityId}</span>
              <button onClick={() => copyText(spEntityId, "entity")} className="text-slate-400 hover:text-white">
                <Copy size={12} className={copiedField === "entity" ? "text-emerald-400" : ""} />
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Main IdP Configuration Form */}
      <form onSubmit={(e) => void handleSave(e)} className="space-y-6">
        <Card className="border-slate-800 bg-slate-900/40 p-6 space-y-6">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <KeyRound size={16} className="text-blue-400" /> Identity Provider (IdP) Connection Settings
            </h2>
            <p className="text-xs text-slate-400">
              Select your identity provider and input the SAML 2.0 endpoints and X.509 certificate.
            </p>
          </div>

          {/* Provider Selection Buttons */}
          <div className="space-y-2">
            <label className="text-[11px] text-slate-400 uppercase font-semibold">Identity Provider</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: "okta", label: "Okta SAML" },
                { id: "azure_ad", label: "Microsoft Entra ID" },
                { id: "google_workspace", label: "Google Workspace" },
                { id: "saml_custom", label: "Custom SAML 2.0" },
              ].map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setProvider(p.id)}
                  className={`p-3 rounded-lg border text-xs font-mono font-semibold transition-colors text-center ${
                    provider === p.id
                      ? "bg-blue-600/20 border-blue-500 text-blue-400"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Domain & SSO URL Inputs */}
          <div className="grid gap-4 sm:grid-cols-2 text-xs">
            <div>
              <label className="text-[11px] text-slate-400 uppercase font-semibold">
                Corporate Domain
              </label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="acmewatch.com"
                required
                className="w-full mt-1 rounded bg-slate-950 border border-slate-800 p-2.5 font-mono text-white text-xs"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Members with @{domain} will authenticate via SSO.</span>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 uppercase font-semibold">
                Identity Provider Issuer / Entity ID
              </label>
              <input
                type="text"
                value={idpEntityId}
                onChange={(e) => setIdpEntityId(e.target.value)}
                placeholder="http://www.okta.com/exk..."
                required
                className="w-full mt-1 rounded bg-slate-950 border border-slate-800 p-2.5 font-mono text-white text-xs"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 uppercase font-semibold">
              IdP Single Sign-On URL (SAML Entry Point)
            </label>
            <input
              type="url"
              value={idpSsoUrl}
              onChange={(e) => setIdpSsoUrl(e.target.value)}
              placeholder="https://acme.okta.com/app/agentwatch/sso/saml"
              required
              className="w-full mt-1 rounded bg-slate-950 border border-slate-800 p-2.5 font-mono text-white text-xs"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 uppercase font-semibold">
              Public X.509 Signing Certificate (PEM)
            </label>
            <textarea
              rows={4}
              value={idpCertificate}
              onChange={(e) => setIdpCertificate(e.target.value)}
              placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
              required
              className="w-full mt-1 rounded bg-slate-950 border border-slate-800 p-2.5 font-mono text-white text-xs"
            />
          </div>

          {/* Security & Enforcement Toggles */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <label className="text-[11px] text-slate-400 uppercase font-semibold">Security Enforcements</label>
            
            <div className="flex items-center justify-between rounded-lg bg-slate-950 border border-slate-800 p-3">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-white">Enforce SSO for all organization members</span>
                <p className="text-[11px] text-slate-400">Disable password & social logins for @{domain} users.</p>
              </div>
              <input
                type="checkbox"
                checked={enforceSso}
                onChange={(e) => setEnforceSso(e.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-950 border border-slate-800 p-3">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-white">Allow IdP-Initiated Login</span>
                <p className="text-[11px] text-slate-400">Allow users to log in directly from Okta/Azure dashboard tiles.</p>
              </div>
              <input
                type="checkbox"
                checked={allowIdpInitiated}
                onChange={(e) => setAllowIdpInitiated(e.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Action Buttons & Handshake Tester */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800">
            <Button
              type="button"
              onClick={() => void handleTestConnection()}
              disabled={testing}
              className="h-9 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 font-mono"
            >
              <RefreshCw size={13} className={testing ? "animate-spin" : ""} />
              {testing ? "Testing Handshake..." : "Test IdP Connection"}
            </Button>

            <Button
              type="submit"
              disabled={saving}
              className="h-9 text-xs bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5"
            >
              <Save size={13} /> {saving ? "Saving Configuration..." : "Save SSO Configuration"}
            </Button>
          </div>

          {/* Test Handshake Result Banner */}
          {testResult && (
            <div
              className={`rounded-lg border p-3 text-xs flex items-center gap-2 ${
                testResult.success
                  ? "bg-emerald-950/40 border-emerald-800 text-emerald-300"
                  : "bg-red-950/40 border-red-800 text-red-300"
              }`}
            >
              {testResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{testResult.message}</span>
            </div>
          )}
        </Card>
      </form>
    </div>
  );
}
