import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  if (process.env.CLERK_SECRET_KEY) {
    const { userId } = await auth();
    if (!userId) {
      redirect("/sign-in");
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <Sidebar />
      <main className="min-w-0 flex-1 p-6 md:p-8 overflow-y-auto">{children}</main>
    </div>
  );
}
