import { NextResponse } from "next/server";
import { currentOrganization, ingestion } from "@/lib/organization";
export async function POST(request: Request) { try { const org = await currentOrganization(); const body = await request.json(); const response = await ingestion("/v1/api-keys", { method: "POST", body: JSON.stringify({ ...body, org_id: org.orgId }) }); return NextResponse.json(await response.json(), { status: response.status }); } catch (error) { return NextResponse.json({ detail: error instanceof Error ? error.message : "Unavailable" }, { status: 403 }); } }
