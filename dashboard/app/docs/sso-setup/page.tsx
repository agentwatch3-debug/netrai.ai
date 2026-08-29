import Link from "next/link";
import { ArrowLeft, CheckCircle2, Copy, Globe, KeyRound, Lock, ShieldCheck, Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export default function SsoSetupDocPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Back Link */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <Link
            href="/settings/sso"
            className="inline-flex items-center gap-2 text-xs font-mono text-blue-400 hover:underline"
          >
            <ArrowLeft size={14} /> Back to SSO Settings
          </Link>
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-950/80 text-emerald-400 border-emerald-800 text-[10px] font-mono">
              SAML 2.0 Certified
            </Badge>
          </div>
        </div>

        {/* Title Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-400">
              <Lock size={18} />
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white">
              Enterprise SAML 2.0 Identity Provider (IdP) Setup Manual
            </h1>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed">
            Step-by-step instructions for configuring NetrAI as a Service Provider (SP) in Okta, Microsoft Entra ID (Azure AD), Google Workspace, and PingFederate.
          </p>
        </div>

        {/* SP Coordinates Box */}
        <Card className="border-slate-800 bg-slate-900/40 p-6 rounded-2xl space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <Globe size={15} className="text-blue-400" /> NetrAI Service Provider (SP) Coordinates
            </h2>
            <span className="text-[11px] text-slate-500 font-mono">Required by your IdP</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-1">
              <span className="text-[10px] text-slate-500 block uppercase">Assertion Consumer Service (ACS URL)</span>
              <code className="text-blue-400 break-all select-all block">
                https://agentwatch-19dt.vercel.app/api/auth/sso/saml/callback
              </code>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-1">
              <span className="text-[10px] text-slate-500 block uppercase">SP Entity ID / Audience URI</span>
              <code className="text-blue-400 break-all select-all block">
                https://agentwatch-19dt.vercel.app/api/auth/sso/saml/metadata
              </code>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-1">
              <span className="text-[10px] text-slate-500 block uppercase">NameID Format</span>
              <code className="text-emerald-400 select-all block">
                urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress
              </code>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-1">
              <span className="text-[10px] text-slate-500 block uppercase">Single Logout (SLO) URL (Optional)</span>
              <code className="text-slate-300 break-all select-all block">
                https://agentwatch-19dt.vercel.app/api/auth/sso/saml/logout
              </code>
            </div>
          </div>
        </Card>

        {/* Provider Setup Tabs */}
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-white">Select Your Identity Provider</h2>

          {/* Okta Guide */}
          <Card className="border-slate-800 bg-slate-900/30 p-6 rounded-2xl space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              <h3 className="font-bold text-white text-base">Option A: Okta Configuration</h3>
            </div>
            <ol className="list-decimal list-inside space-y-3 text-xs text-slate-300 leading-relaxed font-mono">
              <li>Log in to your <strong>Okta Admin Console</strong> and navigate to <strong>Applications $\rightarrow$ Create App Integration</strong>.</li>
              <li>Select <strong>SAML 2.0</strong> as the sign-in method and click <strong>Next</strong>.</li>
              <li>Set the App Name to <span className="text-white font-bold">NetrAI</span>.</li>
              <li>
                In the <strong>SAML Settings</strong> screen:
                <ul className="list-disc list-inside pl-5 mt-1 text-slate-400 space-y-1">
                  <li>Single sign-on URL: <code className="text-blue-400">https://agentwatch-19dt.vercel.app/api/auth/sso/saml/callback</code></li>
                  <li>Audience URI (SP Entity ID): <code className="text-blue-400">https://agentwatch-19dt.vercel.app/api/auth/sso/saml/metadata</code></li>
                  <li>Name ID format: <code className="text-emerald-400">EmailAddress</code></li>
                </ul>
              </li>
              <li>
                Under <strong>Attribute Statements</strong>, add the following mappings:
                <ul className="list-disc list-inside pl-5 mt-1 text-slate-400 space-y-1">
                  <li><code className="text-slate-200">email</code> $\rightarrow$ <code className="text-blue-400">user.email</code></li>
                  <li><code className="text-slate-200">firstName</code> $\rightarrow$ <code className="text-blue-400">user.firstName</code></li>
                  <li><code className="text-slate-200">lastName</code> $\rightarrow$ <code className="text-blue-400">user.lastName</code></li>
                </ul>
              </li>
              <li>Save and copy your <strong>IdP Single Sign-On URL</strong> and <strong>X.509 Certificate</strong> into the NetrAI SSO Settings page.</li>
            </ol>
          </Card>

          {/* Microsoft Entra ID (Azure AD) Guide */}
          <Card className="border-slate-800 bg-slate-900/30 p-6 rounded-2xl space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
              <div className="h-2 w-2 rounded-full bg-indigo-500" />
              <h3 className="font-bold text-white text-base">Option B: Microsoft Entra ID (Azure AD)</h3>
            </div>
            <ol className="list-decimal list-inside space-y-3 text-xs text-slate-300 leading-relaxed font-mono">
              <li>In the Azure Portal, open <strong>Microsoft Entra ID</strong> $\rightarrow$ <strong>Enterprise Applications</strong> $\rightarrow$ <strong>New Application</strong> $\rightarrow$ <strong>Create your own application</strong>.</li>
              <li>Select <strong>Integrate any other application you don&apos;t find in the gallery (Non-gallery)</strong>.</li>
              <li>Go to <strong>Single sign-on</strong> $\rightarrow$ select <strong>SAML</strong>.</li>
              <li>
                Edit <strong>Basic SAML Configuration</strong>:
                <ul className="list-disc list-inside pl-5 mt-1 text-slate-400 space-y-1">
                  <li>Identifier (Entity ID): <code className="text-blue-400">https://agentwatch-19dt.vercel.app/api/auth/sso/saml/metadata</code></li>
                  <li>Reply URL (Assertion Consumer Service URL): <code className="text-blue-400">https://agentwatch-19dt.vercel.app/api/auth/sso/saml/callback</code></li>
                </ul>
              </li>
              <li>Download the <strong>Certificate (Base64)</strong> and copy the <strong>Login URL</strong> into your NetrAI SSO settings.</li>
            </ol>
          </Card>

          {/* Google Workspace Guide */}
          <Card className="border-slate-800 bg-slate-900/30 p-6 rounded-2xl space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <h3 className="font-bold text-white text-base">Option C: Google Workspace SAML</h3>
            </div>
            <ol className="list-decimal list-inside space-y-3 text-xs text-slate-300 leading-relaxed font-mono">
              <li>Open <strong>Google Admin Console</strong> (admin.google.com) $\rightarrow$ <strong>Apps</strong> $\rightarrow$ <strong>Web and mobile apps</strong> $\rightarrow$ <strong>Add custom SAML app</strong>.</li>
              <li>Set Application Name to <strong>NetrAI</strong>.</li>
              <li>Copy Google&apos;s SSO URL and Certificate.</li>
              <li>
                Enter Service Provider details:
                <ul className="list-disc list-inside pl-5 mt-1 text-slate-400 space-y-1">
                  <li>ACS URL: <code className="text-blue-400">https://agentwatch-19dt.vercel.app/api/auth/sso/saml/callback</code></li>
                  <li>Entity ID: <code className="text-blue-400">https://agentwatch-19dt.vercel.app/api/auth/sso/saml/metadata</code></li>
                  <li>Name ID: Primary Email</li>
                </ul>
              </li>
              <li>Turn ON user access for your organizational units.</li>
            </ol>
          </Card>
        </div>

        {/* Next Step Banner */}
        <div className="rounded-2xl border border-blue-900/60 bg-blue-950/30 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="font-bold text-white text-sm">Ready to Test Your SSO Connection?</h4>
            <p className="text-xs text-slate-400 mt-0.5">Paste your IdP SSO URL and Certificate into the settings page and click &quot;Test Connection&quot;.</p>
          </div>
          <Link
            href="/settings/sso"
            className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-4 py-2 transition-colors shrink-0"
          >
            Configure SSO Now
          </Link>
        </div>
      </div>
    </div>
  );
}
