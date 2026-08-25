import { NextResponse } from "next/server";
import { currentOrganization, ingestion } from "@/lib/organization";

export async function GET() {
  try {
    const org = await currentOrganization();
    const response = await ingestion(`/v1/circuit-breaker/status?org_id=${org.orgId}`);
    return NextResponse.json(await response.json(), { status: response.status });
  } catch (error) {
    return NextResponse.json({ detail: error instanceof Error ? error.message : "Unavailable" }, { status: 403 });
  }
}
