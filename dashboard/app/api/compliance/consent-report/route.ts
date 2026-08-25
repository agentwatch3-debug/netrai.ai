import { NextRequest, NextResponse } from "next/server";
import { currentOrganization, ingestion } from "@/lib/organization";

export async function GET(request: NextRequest) {
  try {
    const org = await currentOrganization();
    const query = new URLSearchParams(request.nextUrl.searchParams);
    query.set("org_id", org.orgId);
    const response = await ingestion(`/v1/compliance/consent-report?${query}`);

    if (query.get("format") === "csv" || !query.has("format")) {
      const csvText = await response.text();
      return new NextResponse(csvText, {
        status: response.status,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename=consent_audit_report_${org.orgId}.csv`,
        },
      });
    }

    return NextResponse.json(await response.json(), { status: response.status });
  } catch (error) {
    return NextResponse.json({ detail: error instanceof Error ? error.message : "Unavailable" }, { status: 403 });
  }
}
