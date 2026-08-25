import { NextRequest, NextResponse } from "next/server";
import { currentOrganization, ingestion } from "@/lib/organization";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const org = await currentOrganization();
    const resolvedParams = await params;
    const response = await ingestion(`/v1/policies/templates/${resolvedParams.id}/toggle`, {
      method: "POST",
      body: JSON.stringify({ org_id: org.orgId }),
    });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch (error) {
    return NextResponse.json({ detail: error instanceof Error ? error.message : "Unavailable" }, { status: 403 });
  }
}
