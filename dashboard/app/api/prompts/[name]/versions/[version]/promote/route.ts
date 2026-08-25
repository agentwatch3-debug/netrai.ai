import { NextRequest, NextResponse } from "next/server";
import { currentOrganization, ingestion } from "@/lib/organization";

export async function POST(request: NextRequest, { params }: { params: { name: string; version: string } }) {
  try {
    const org = await currentOrganization();
    const label = request.nextUrl.searchParams.get("label") || "production";
    const response = await ingestion(`/v1/prompts/${params.name}/versions/${params.version}/promote?label=${label}&org_id=${org.orgId}`, {
      method: "POST",
    });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch (error) {
    return NextResponse.json({ detail: error instanceof Error ? error.message : "Unavailable" }, { status: 403 });
  }
}
