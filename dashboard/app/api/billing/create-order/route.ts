import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { currentOrganization } from "@/lib/organization";

// Plan pricing in INR (amount in paise for Razorpay)
const PLANS: Record<string, { amount: number; name: string; description: string }> = {
  pro: {
    amount: 249900, // ₹2,499.00
    name: "AgentWatch Pro Plan",
    description: "1,000,000 Spans/mo + Cost Killswitch + Injection Shield",
  },
  team: {
    amount: 829900, // ₹8,299.00
    name: "AgentWatch Team Plan",
    description: "10,000,000 Spans/mo + GDPR Workflow + SSO + Dedicated Support",
  },
};

export async function POST(request: Request) {
  try {
    const org = await currentOrganization();
    const body = await request.json();
    const planTier = (body.plan || "pro").toLowerCase();

    const selectedPlan = PLANS[planTier];
    if (!selectedPlan) {
      return NextResponse.json({ error: "Invalid plan selected" }, { status: 400 });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    // If Razorpay keys are not configured yet, return demo mock mode with clear instructions
    if (!keyId || !keySecret) {
      return NextResponse.json({
        demo_mode: true,
        message: "Razorpay keys not configured yet in .env.local",
        plan: planTier,
        amount: selectedPlan.amount / 100,
        currency: "INR",
        key_id: "rzp_test_placeholder",
      });
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const options = {
      amount: selectedPlan.amount,
      currency: "INR",
      receipt: `rcpt_${org.orgId.slice(0, 8)}_${Date.now()}`,
      notes: {
        org_id: org.orgId,
        plan_tier: planTier,
        app: "AgentWatch",
      },
    };

    const order = await razorpay.orders.create(options);

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: keyId,
      plan: planTier,
      name: selectedPlan.name,
      description: selectedPlan.description,
    });
  } catch (error) {
    console.error("Razorpay order creation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create Razorpay order" },
      { status: 500 }
    );
  }
}
