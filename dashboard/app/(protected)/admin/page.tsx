import { isSuperAdmin } from "@/lib/admin";
import { AdminPanel } from "@/components/admin-panel";
import { ShieldAlert, Lock, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function AdminPage() {
  const authorized = await isSuperAdmin();

  if (!authorized) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center border border-border bg-paper text-bad mb-5">
          <Lock size={32} />
        </div>
        <h1 className="font-display text-2xl font-bold text-ink">SuperAdmin Access Restricted</h1>
        <p className="mt-2 max-w-md text-xs text-inkDim leading-relaxed">
          This platform management console is restricted exclusively to the NetrAI system owner and superadministrators. Your account does not have platform administrative privileges.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/dashboard">
            <Button variant="primary" className="text-xs font-mono flex items-center gap-2">
              <ArrowLeft size={14} /> Return to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return <AdminPanel />;
}
