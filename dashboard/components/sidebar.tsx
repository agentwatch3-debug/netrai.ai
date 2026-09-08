"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Building2, CheckCircle2, Coins, CreditCard, Database, FileCode2, FileSpreadsheet, FileText, KeyRound, Lock, MessagesSquare, Network, Radio, Scale, Share2, ShieldAlert, ShieldCheck, SlidersHorizontal, User, Users, UserX, ZapOff } from "lucide-react";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/analytics/cost-breakdown", label: "Cost Breakdown", icon: Coins },
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
    <aside className="flex min-h-screen w-64 shrink-0 flex-col border-r border-border bg-surface p-4 text-ink font-sans">
      {/* Brand Header */}
      <div className="mb-6 flex items-center justify-between px-2">
        <Link className="flex items-center gap-2 text-base font-bold tracking-tight text-ink font-display" href="/dashboard">
          <div className="flex h-6 w-6 items-center justify-center border border-ink bg-ink text-[11px] font-bold text-paper font-mono">
            NA
          </div>
          <span className="tracking-tight">netrai</span>
        </Link>
        <span className="border border-border bg-paper px-1.5 py-0.5 text-[10px] font-mono font-medium text-inkDim">
          v1.0
        </span>
      </div>

      {/* Navigation Links */}
      <nav className="space-y-0.5">
        {links.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              className={`flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium transition-colors border ${
                isActive
                  ? "bg-accentSoft text-accent border-accent/20 font-semibold"
                  : "text-inkDim border-transparent hover:bg-paper hover:text-ink"
              }`}
              href={href}
              key={href}
            >
              <Icon size={15} className={isActive ? "text-accent" : "text-inkFaint"} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Compliance / Status Badge */}
      <div className="mt-6 border border-border bg-paper p-3 text-xs text-inkDim space-y-1">
        <div className="flex items-center gap-1.5 font-medium text-ink">
          <ShieldCheck size={14} className="text-good" />
          <span>DPDP India Pinned</span>
        </div>
        <p className="text-[10.5px] text-inkFaint font-mono">Region: ap-south-1 (Mumbai)</p>
      </div>

      {/* Bottom Tenant / User Footer */}
      <div className="mt-auto border-t border-border pt-4">
        {hasClerk ? (
          <div className="space-y-3">
            <OrganizationSwitcher hidePersonal appearance={{ elements: { rootBox: "w-full" } }} />
            <UserButton afterSignOutUrl="/sign-in" />
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 border border-border bg-paper p-2 text-xs">
              <Building2 size={15} className="text-accent" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">Acme Agents Corp</p>
                <p className="text-[10px] font-mono text-inkFaint">org_dev_demo</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-1 text-xs text-inkDim font-mono">
              <div className="flex h-4 w-4 items-center justify-center border border-border bg-surface text-inkDim">
                <User size={10} />
              </div>
              <span className="truncate text-[11px]">dev-admin@netrai.local</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
