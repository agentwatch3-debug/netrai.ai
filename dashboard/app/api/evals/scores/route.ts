import { NextRequest, NextResponse } from "next/server";
import { currentOrganization, ingestion } from "@/lib/organization";

export async function GET(request: NextRequest) {
  try {
    const org = await currentOrganization();
    const query = new URLSearchParams(request.nextUrl.searchParams);
    query.set("org_id", org.orgId);
    const response = await ingestion(`/v1/evals/scores?${query}`);
    return NextResponse.json(await response.json(), { status: response.status });
  } catch (error) {
    return NextResponse.json({ detail: error instanceof Error ? error.message : "Unavailable" }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const org = await currentOrganization();
    const body = await request.json();
    const response = await ingestion("/v1/evals/scores", {
      method: "POST",
      body: JSON.stringify({ ...body, org_id: org.orgId }),
    });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch (error) {
    return NextResponse.json({ detail: error instanceof Error ? error.message : "Unavailable" }, { status: 403 });
  }
}
