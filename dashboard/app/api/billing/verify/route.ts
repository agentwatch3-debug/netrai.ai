import { NextResponse } from "next/server";
import crypto from "crypto";
import { currentOrganization } from "@/lib/organization";
import { getPool } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const org = await currentOrganization();
    const body = await request.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = body;

    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (keySecret) {
      const generatedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      if (generatedSignature !== razorpay_signature) {
        return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
      }
    }

    const planTier = (plan || "pro").toLowerCase();
    const spanLimits: Record<string, number> = {
      free: 50000,
      pro: 1000000,
      team: 10000000,
    };

    // Update organization plan in PostgreSQL
    const pool = getPool();
    await pool.query(
      `
      UPDATE orgs 
      SET plan_tier = $1, 
          spans_limit = $2, 
          subscription_status = 'active',
          updated_at = NOW()
      WHERE id = $3;
      `,
      [planTier, spanLimits[planTier] || 1000000, org.orgId]
    );

    return NextResponse.json({
      success: true,
      message: `Successfully upgraded to ${planTier.toUpperCase()} plan!`,
      plan: planTier,
      payment_id: razorpay_payment_id,
    });
  } catch (error) {
    console.error("Razorpay verification error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Payment verification failed" },
      { status: 500 }
    );
  }
}
