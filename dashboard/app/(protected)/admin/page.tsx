import { isSuperAdmin } from "@/lib/admin";
import { AdminPanel } from "@/components/admin-panel";
import { ShieldAlert, Lock, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function AdminPage() {
  const authorized = await isSuperAdmin();

  if (!authorized) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-400 shadow-2xl mb-5">
          <Lock size={32} />
        </div>
        <h1 className="text-2xl font-extrabold text-white">SuperAdmin Access Restricted</h1>
        <p className="mt-2 max-w-md text-sm text-slate-400 leading-relaxed">
          This platform management console is restricted exclusively to the NetrAI system owner and superadministrators. Your account does not have platform administrative privileges.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 border border-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} /> Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <AdminPanel />;
}
