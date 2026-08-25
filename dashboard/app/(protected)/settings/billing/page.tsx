import { BillingSettings } from "@/components/billing-settings";

export default function BillingPage() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Subscription & Billing</h1>
        <p className="text-sm text-slate-400">
          Manage your plan, review span usage against monthly limits, and upgrade with Razorpay.
        </p>
      </div>
      <BillingSettings />
    </>
  );
}
