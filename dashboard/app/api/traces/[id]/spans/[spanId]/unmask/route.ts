import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { currentOrganization, ingestion } from "@/lib/organization";

export async function POST(_: Request, { params }: { params: { id: string; spanId: string } }) {
  if (process.env.CLERK_SECRET_KEY) {
    try {
      const { has } = await auth();
      if (!has({ permission: "org:traces:unmask" })) {
        return NextResponse.json({ detail: "Unmask permission required" }, { status: 403 });
      }
    } catch {
      // In dev fallback, proceed
    }
  }

  try {
    await currentOrganization();
    const response = await ingestion(`/v1/spans/${params.spanId}/unmask`, { method: "POST" });
    const data = await response.json();
    return NextResponse.json(data.replacements ?? data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ detail: error instanceof Error ? error.message : "Unavailable" }, { status: 403 });
  }
}
