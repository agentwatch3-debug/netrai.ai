"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Building2, CheckCircle2, CreditCard, Database, FileCode2, FileSpreadsheet, FileText, KeyRound, Lock, MessagesSquare, Network, Radio, Scale, Share2, ShieldAlert, ShieldCheck, SlidersHorizontal, User, Users, UserX, ZapOff } from "lucide-react";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/traces", label: "Traces", icon: Network },
  { href: "/agents/graph", label: "Agent Topology", icon: Share2 },
  { href: "/sessions", label: "Sessions", icon: MessagesSquare },
  { href: "/evals", label: "Evaluations", icon: CheckCircle2 },
  { href: "/evals/datasets", label: "Golden Datasets", icon: Database },
  { href: "/prompts", label: "Prompts", icon: FileCode2 },
  { href: "/compliance/consent", label: "Consent & PII Audit", icon: FileSpreadsheet },
  { href: "/settings/data-requests", label: "Data Requests", icon: UserX },
  { href: "/security/injection-attempts", label: "Prompt Security", icon: ShieldAlert },
  { href: "/security/anomalies", label: "Scope Drift", icon: Radio },
  { href: "/settings/policies", label: "Output Policies", icon: Scale },
  { href: "/settings/quotas", label: "User Quotas", icon: Users },
  { href: "/settings/sso", label: "Enterprise SSO", icon: Lock },
  { href: "/settings/audit-log", label: "Audit Logs", icon: FileText },
  { href: "/settings/circuit-breaker", label: "Circuit Breaker", icon: ZapOff },
  { href: "/settings/api-keys", label: "API keys", icon: KeyRound },
  { href: "/settings/billing", label: "Billing", icon: CreditCard },
  { href: "/admin", label: "Admin Console", icon: SlidersHorizontal },
];

export function Sidebar() {
  const pathname = usePathname();
  const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  return (
    <aside className="flex min-h-screen w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-950 p-4">
      {/* Brand Header */}
      <div className="mb-8 flex items-center justify-between px-2">
        <Link className="flex items-center gap-2 text-lg font-bold tracking-tight text-white" href="/dashboard">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-black text-white">
            NA
          </div>
          <span>netrai</span>
        </Link>
        <span className="rounded border border-blue-900/60 bg-blue-950/40 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400">
          v1.0
        </span>
      </div>

      {/* Navigation Links */}
      <nav className="space-y-1">
        {links.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-slate-900 text-blue-400 border border-slate-800"
                  : "text-slate-400 hover:bg-slate-900/60 hover:text-slate-200"
              }`}
              href={href}
              key={href}
            >
              <Icon size={18} className={isActive ? "text-blue-400" : "text-slate-500"} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Compliance / Status Badge */}
      <div className="mt-6 rounded-lg border border-slate-800/80 bg-slate-900/30 p-3 text-xs text-slate-400">
        <div className="flex items-center gap-1.5 font-medium text-slate-300">
          <ShieldCheck size={14} className="text-emerald-400" />
          <span>DPDP India Pinned</span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">Region: ap-south-1 (Mumbai)</p>
      </div>

      {/* Bottom Tenant / User Footer */}
      <div className="mt-auto border-t border-slate-800/80 pt-4">
        {hasClerk ? (
          <div className="space-y-3">
            <OrganizationSwitcher hidePersonal appearance={{ elements: { rootBox: "w-full" } }} />
            <UserButton afterSignOutUrl="/sign-in" />
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-md bg-slate-900 p-2 text-xs">
              <Building2 size={15} className="text-blue-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-200">Acme Agents Corp</p>
                <p className="text-[10px] text-slate-400">org_dev_demo</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-1 text-xs text-slate-400">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800">
                <User size={12} className="text-slate-300" />
              </div>
              <span className="truncate">dev-admin@netrai.local</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
