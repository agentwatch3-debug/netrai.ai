import { NextRequest, NextResponse } from "next/server";
import { currentOrganization, ingestion } from "@/lib/organization";

export async function GET(request: NextRequest) {
  try {
    const org = await currentOrganization();
    const query = new URLSearchParams(request.nextUrl.searchParams);
    query.set("org_id", org.orgId);
    const response = await ingestion(`/v1/quotas/top-users?${query}`);
    return NextResponse.json(await response.json(), { status: response.status });
  } catch (error) {
    return NextResponse.json({ detail: error instanceof Error ? error.message : "Unavailable" }, { status: 403 });
  }
}
