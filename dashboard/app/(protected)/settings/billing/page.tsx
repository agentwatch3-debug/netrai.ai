import { BillingSettings } from "@/components/billing-settings";

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Billing & Subscriptions</h1>
        <p className="mt-1 text-xs text-inkDim">
          Manage your subscription tier, monthly span usage, and payment methods (Razorpay UPI / Cards in INR).
        </p>
      </div>
      <BillingSettings />
    </div>
  );
}
