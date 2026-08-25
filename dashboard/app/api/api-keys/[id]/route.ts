import { NextResponse } from "next/server";
import { currentOrganization, ingestion } from "@/lib/organization";
export async function DELETE(_: Request, { params }: { params: { id: string } }) { try { const org = await currentOrganization(); const response = await ingestion(`/v1/api-keys/${params.id}?org_id=${org.orgId}`, { method: "DELETE" }); return NextResponse.json(await response.json(), { status: response.status }); } catch (error) { return NextResponse.json({ detail: error instanceof Error ? error.message : "Unavailable" }, { status: 403 }); } }
