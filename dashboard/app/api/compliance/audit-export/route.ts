import { NextRequest, NextResponse } from "next/server";
import { currentOrganization, ingestion } from "@/lib/organization";

export async function GET(request: NextRequest) {
  try {
    const org = await currentOrganization();
    const query = new URLSearchParams(request.nextUrl.searchParams);
    query.set("org_id", org.orgId);
    const response = await ingestion(`/v1/compliance/audit-export?${query}`);

    if (query.get("format") === "csv" || !query.has("format")) {
      const csvText = await response.text();
      return new NextResponse(csvText, {
        status: response.status,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename=audit-export-${org.orgId}.csv`,
        },
      });
    }

    const pdfBlob = await response.arrayBuffer();
    return new NextResponse(pdfBlob, {
      status: response.status,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=audit-export-${org.orgId}.pdf`,
      },
    });
  } catch (error) {
    return NextResponse.json({ detail: error instanceof Error ? error.message : "Unavailable" }, { status: 403 });
  }
}
