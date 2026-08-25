import { NextResponse } from "next/server";
import { currentOrganization, ingestion } from "@/lib/organization";
export async function GET(_: Request, { params }: { params: { id: string } }) { try { const org = await currentOrganization(); const response = await ingestion(`/v1/traces/${params.id}?org_id=${org.orgId}`); return NextResponse.json(await response.json(), { status: response.status }); } catch (error) { return NextResponse.json({ detail: error instanceof Error ? error.message : "Unavailable" }, { status: 403 }); } }
