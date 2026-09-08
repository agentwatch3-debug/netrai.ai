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
    return <div className="text-xs font-mono text-inkDim py-4">Loading Enterprise SSO configuration...</div>;
  }

  const isEnterprise = (config?.plan_tier || "enterprise") === "enterprise";

  if (!isEnterprise) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border pb-4">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Enterprise Single Sign-On (SSO)</h1>
          <p className="mt-1 text-xs text-inkDim">
            SAML 2.0 and OIDC authentication for Okta, Microsoft Azure AD (Entra ID), and Google Workspace.
          </p>
        </div>

        <Card className="border border-border bg-surface p-8 text-center space-y-4 max-w-2xl mx-auto">
          <div className="flex h-12 w-12 items-center justify-center border border-border bg-paper text-ink mx-auto">
            <Lock size={24} />
          </div>

          <div className="space-y-1">
            <h2 className="text-base font-bold text-ink">Enterprise Tier Feature</h2>
            <p className="text-xs text-inkDim max-w-md mx-auto">
              Single Sign-On (SAML 2.0 / OIDC) and Just-In-Time (JIT) provisioning are exclusive to the Enterprise Plan.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-left max-w-md mx-auto text-xs text-inkDim pt-2 font-mono">
            <div className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-good" /> Okta & Azure AD SAML 2.0</div>
            <div className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-good" /> Automated JIT Provisioning</div>
            <div className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-good" /> Domain-wide Enforcement</div>
            <div className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-good" /> Dedicated Security SLA</div>
          </div>

          <div className="pt-4">
            <Link href="/settings/billing">
              <Button variant="primary" className="text-xs font-mono px-6">
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
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Enterprise Single Sign-On (SAML 2.0)</h1>
          <p className="mt-1 text-xs text-inkDim">
            Connect your corporate Identity Provider (IdP) for unified authentication and centralized user access control.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/docs/sso-setup"
            className="text-xs text-accent hover:underline flex items-center gap-1 font-mono"
          >
            IdP Setup Manual <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>

      {/* Service Provider (SP) Metadata Box */}
      <Card className="border border-border bg-surface p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-2.5">
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-accent" />
            <h2 className="text-xs font-bold text-ink uppercase tracking-wider font-mono">
              AgentWatch Service Provider (SP) Coordinates
            </h2>
          </div>
          <Badge variant="good" className="text-[10px] font-mono">
            SAML 2.0 READY
          </Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 text-xs">
          <div className="space-y-1">
            <span className="text-[10px] text-inkDim uppercase font-mono font-semibold">Assertion Consumer Service (ACS) URL</span>
            <div className="flex items-center justify-between border border-border bg-paper p-2 font-mono text-[11px] text-ink">
              <span className="truncate mr-2">{acsUrl}</span>
              <button onClick={() => copyText(acsUrl, "acs")} className="text-inkDim hover:text-ink">
                <Copy size={12} className={copiedField === "acs" ? "text-good" : ""} />
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-inkDim uppercase font-mono font-semibold">Entity ID / Audience URI</span>
            <div className="flex items-center justify-between border border-border bg-paper p-2 font-mono text-[11px] text-ink">
              <span className="truncate mr-2">{spEntityId}</span>
              <button onClick={() => copyText(spEntityId, "entity")} className="text-inkDim hover:text-ink">
                <Copy size={12} className={copiedField === "entity" ? "text-good" : ""} />
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Main IdP Configuration Form */}
      <form onSubmit={(e) => void handleSave(e)} className="space-y-6">
        <Card className="border border-border bg-surface p-6 space-y-6">
          <div className="border-b border-border pb-3">
            <h2 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-2 font-mono">
              <KeyRound size={16} className="text-accent" /> Identity Provider (IdP) Connection Settings
            </h2>
            <p className="text-xs text-inkDim mt-0.5">
              Select your identity provider and input the SAML 2.0 endpoints and X.509 certificate.
            </p>
          </div>

          {/* Provider Selection Buttons */}
          <div className="space-y-2">
            <label className="text-[11px] text-inkDim uppercase font-mono font-semibold">Identity Provider</label>
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
                  className={`p-3 border text-xs font-mono font-semibold transition-colors text-center ${
                    provider === p.id
                      ? "border-ink bg-ink text-paper"
                      : "border-border bg-surface text-ink hover:bg-paper"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Domain & SSO URL Inputs */}
          <div className="grid gap-4 sm:grid-cols-2 text-xs font-mono">
            <div>
              <label className="text-[11px] text-inkDim uppercase font-semibold">
                Corporate Domain
              </label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="acmewatch.com"
                required
                className="w-full mt-1 border border-border bg-surface p-2.5 text-ink placeholder-inkFaint focus:border-ink focus:outline-none text-xs font-mono"
              />
              <span className="text-[10px] text-inkFaint mt-1 block">Members with @{domain} will authenticate via SSO.</span>
            </div>

            <div>
              <label className="text-[11px] text-inkDim uppercase font-semibold">
                Identity Provider Issuer / Entity ID
              </label>
              <input
                type="text"
                value={idpEntityId}
                onChange={(e) => setIdpEntityId(e.target.value)}
                placeholder="http://www.okta.com/exk..."
                required
                className="w-full mt-1 border border-border bg-surface p-2.5 text-ink placeholder-inkFaint focus:border-ink focus:outline-none text-xs font-mono"
              />
            </div>
          </div>

          <div className="font-mono text-xs">
            <label className="text-[11px] text-inkDim uppercase font-semibold">
              IdP Single Sign-On URL (SAML Entry Point)
            </label>
            <input
              type="url"
              value={idpSsoUrl}
              onChange={(e) => setIdpSsoUrl(e.target.value)}
              placeholder="https://acme.okta.com/app/agentwatch/sso/saml"
              required
              className="w-full mt-1 border border-border bg-surface p-2.5 text-ink placeholder-inkFaint focus:border-ink focus:outline-none text-xs font-mono"
            />
          </div>

          <div className="font-mono text-xs">
            <label className="text-[11px] text-inkDim uppercase font-semibold">
              Public X.509 Signing Certificate (PEM)
            </label>
            <textarea
              rows={4}
              value={idpCertificate}
              onChange={(e) => setIdpCertificate(e.target.value)}
              placeholder="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
              required
              className="w-full mt-1 border border-border bg-paper p-2.5 text-ink placeholder-inkFaint focus:border-ink focus:outline-none text-xs font-mono"
            />
          </div>

          {/* Security & Enforcement Toggles */}
          <div className="space-y-3 pt-2 border-t border-border">
            <label className="text-[11px] text-inkDim uppercase font-mono font-semibold">Security Enforcements</label>
            
            <div className="flex items-center justify-between border border-border bg-paper p-3">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-ink">Enforce SSO for all organization members</span>
                <p className="text-[11px] text-inkDim">Disable password & social logins for @{domain} users.</p>
              </div>
              <input
                type="checkbox"
                checked={enforceSso}
                onChange={(e) => setEnforceSso(e.target.checked)}
                className="h-4 w-4 border-border text-ink focus:ring-ink"
              />
            </div>

            <div className="flex items-center justify-between border border-border bg-paper p-3">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-ink">Allow IdP-Initiated Login</span>
                <p className="text-[11px] text-inkDim">Allow users to log in directly from Okta/Azure dashboard tiles.</p>
              </div>
              <input
                type="checkbox"
                checked={allowIdpInitiated}
                onChange={(e) => setAllowIdpInitiated(e.target.checked)}
                className="h-4 w-4 border-border text-ink focus:ring-ink"
              />
            </div>
          </div>

          {/* Action Buttons & Handshake Tester */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-border">
            <Button
              type="button"
              onClick={() => void handleTestConnection()}
              disabled={testing}
              variant="outline"
              className="h-9 text-xs flex items-center gap-1.5 font-mono"
            >
              <RefreshCw size={13} className={testing ? "animate-spin" : ""} />
              {testing ? "Testing Handshake..." : "Test IdP Connection"}
            </Button>

            <Button
              type="submit"
              disabled={saving}
              variant="primary"
              className="h-9 text-xs flex items-center gap-1.5 font-mono"
            >
              <Save size={13} /> {saving ? "Saving Configuration..." : "Save SSO Configuration"}
            </Button>
          </div>

          {/* Test Handshake Result Banner */}
          {testResult && (
            <div
              className={`border p-3 text-xs flex items-center gap-2 font-mono ${
                testResult.success
                  ? "border-good bg-good/10 text-good"
                  : "border-bad bg-bad/10 text-bad"
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
