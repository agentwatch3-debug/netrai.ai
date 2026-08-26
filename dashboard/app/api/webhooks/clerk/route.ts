import { NextRequest } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const event = await verifyWebhook(request);
    if (event.type === "organization.created") {
      const organization = event.data as { id: string; name: string };
      await db.query(
        "INSERT INTO orgs (clerk_org_id, name) VALUES ($1, $2) ON CONFLICT (clerk_org_id) DO UPDATE SET name = EXCLUDED.name",
        [organization.id, organization.name]
      );
    }
    return new Response("ok");
  } catch {
    return new Response("Invalid webhook", { status: 400 });
  }
}
