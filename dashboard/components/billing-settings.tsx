"use client";

import { useEffect, useState } from "react";
import { Check, CreditCard, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BillingUsage } from "@/lib/types";

declare global {
  interface Window {
    Razorpay: any;
  }
}

export function BillingSettings() {
  const [billing, setBilling] = useState<BillingUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  async function loadBilling() {
    try {
      const res = await fetch("/api/billing/usage");
      if (res.ok) {
        setBilling(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBilling();

    // Dynamically load Razorpay checkout SDK
    if (!document.getElementById("razorpay-sdk")) {
      const script = document.createElement("script");
      script.id = "razorpay-sdk";
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  async function handleSubscribe(planTier: string) {
    setSubscribing(planTier);
    setStatusMessage(null);

    try {
      // 1. Create order on server
      const res = await fetch("/api/billing/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planTier }),
      });

      const orderData = await res.json();

      if (!res.ok) {
        throw new Error(orderData.error || "Could not initiate payment");
      }

      // If in demo mode without Razorpay keys
      if (orderData.demo_mode) {
        setStatusMessage({
          type: "info",
          text: `Demo Mode: Add RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET in .env.local to enable live UPI / Card payments for ₹${orderData.amount.toLocaleString("en-IN")}.`,
        });
        return;
      }

      // 2. Open Razorpay Checkout Modal
      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "NetrAI",
        description: orderData.name,
        order_id: orderData.order_id,
        theme: { color: "#3b82f6" },
        handler: async function (response: any) {
          // 3. Verify payment signature on server
          const verifyRes = await fetch("/api/billing/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...response,
              plan: planTier,
            }),
          });

          const verifyData = await verifyRes.json();
          if (verifyRes.ok) {
            setStatusMessage({
              type: "success",
              text: `Payment successful! You are now upgraded to the ${planTier.toUpperCase()} plan (Payment ID: ${response.razorpay_payment_id}).`,
            });
            void loadBilling();
          } else {
            setStatusMessage({
              type: "error",
              text: verifyData.error || "Payment verification failed.",
            });
          }
        },
        modal: {
          ondismiss: function () {
            setSubscribing(null);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Something went wrong.",
      });
    } finally {
      setSubscribing(null);
    }
  }

  if (loading) {
    return <div className="text-sm text-slate-400">Loading billing details...</div>;
  }

  const currentTier = billing?.plan_tier || "free";
  const used = billing?.spans_used ?? 0;
  const limit = billing?.spans_limit ?? 50000;
  const pct = Math.min(100, Math.round((used / limit) * 100));

  const planFeatures: Record<string, string[]> = {
    free: ["50,000 spans / month", "7-day data retention", "1 user seat", "Community support"],
    pro: ["1,000,000 spans / month", "30-day data retention", "5 team seats", "Cost killswitch alerts", "Prompt injection blocking", "Priority support"],
    team: ["10,000,000 spans / month", "90-day data retention", "20 team seats", "GDPR Subject Rights workflow", "Golden dataset evals", "Enterprise SSO", "Dedicated support"],
  };

  return (
    <div className="space-y-8">
      {/* Current Subscription & Usage Card */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-slate-800 bg-slate-900/50 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-400">Current Subscription</h2>
            <Badge className={currentTier === "team" ? "bg-purple-950 text-purple-300" : currentTier === "pro" ? "bg-blue-950 text-blue-300" : "bg-slate-800 text-slate-300"}>
              {currentTier.toUpperCase()}
            </Badge>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">
              {currentTier === "team" ? "₹8,299" : currentTier === "pro" ? "₹2,499" : "₹0"}
            </span>
            <span className="text-sm text-slate-400">/ month</span>
          </div>
          <div className="mt-4 space-y-1 text-xs text-slate-400">
            <p>Status: <span className="font-medium capitalize text-slate-200">{billing?.subscription_status || "Active"}</span></p>
            {billing?.current_period_end && (
              <p>Renewal date: <span className="font-medium text-slate-200">{new Date(billing.current_period_end).toLocaleDateString()}</span></p>
            )}
            <p>Data Retention: <span className="font-medium text-slate-200">{billing?.retention_days ?? 7} days</span></p>
          </div>
        </Card>

        <Card className="border-slate-800 bg-slate-900/50 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-400">Monthly Span Usage</h2>
            <span className="text-xs text-slate-400">{used.toLocaleString()} / {limit.toLocaleString()} spans</span>
          </div>
          <div className="mt-4">
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full transition-all ${pct > 90 ? "bg-red-500" : pct > 75 ? "bg-amber-500" : "bg-blue-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-slate-400">
              <span>{pct}% utilized</span>
              <span>{(limit - used > 0 ? limit - used : 0).toLocaleString()} remaining</span>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Zap size={14} className="text-amber-400" /> Circuit breaker: {billing?.alert_rules_enabled ? "Enabled" : "Active"}
            </span>
          </div>
        </Card>
      </div>

      {statusMessage && (
        <div
          className={`rounded-lg border p-4 text-sm ${
            statusMessage.type === "success"
              ? "border-emerald-800 bg-emerald-950/40 text-emerald-300"
              : statusMessage.type === "error"
              ? "border-red-800 bg-red-950/40 text-red-300"
              : "border-blue-800 bg-blue-950/40 text-blue-300"
          }`}
        >
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} />
            <p className="font-medium">{statusMessage.text}</p>
          </div>
        </div>
      )}

      {/* Pricing & Plan Upgrade Grid in INR */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-white">Available Plans (INR)</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {/* Free Plan */}
          <Card className={`flex flex-col justify-between border-slate-800 bg-slate-900/40 p-6 ${currentTier === "free" ? "ring-2 ring-slate-600" : ""}`}>
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-white">Free Starter</h3>
                {currentTier === "free" && <Badge className="bg-slate-800 text-slate-300">Current Plan</Badge>}
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-white">₹0</span>
                <span className="text-xs text-slate-400">/mo</span>
              </div>
              <ul className="mt-6 space-y-2.5 text-xs text-slate-300">
                {planFeatures.free.map((feat) => (
                  <li key={feat} className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-400" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-8">
              <Button disabled className="w-full bg-slate-800 text-xs text-slate-400">
                {currentTier === "free" ? "Active" : "Included"}
              </Button>
            </div>
          </Card>

          {/* Pro Plan */}
          <Card className={`relative flex flex-col justify-between border-blue-900/60 bg-slate-900/80 p-6 ${currentTier === "pro" ? "ring-2 ring-blue-500" : ""}`}>
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={16} className="text-blue-400" />
                  <h3 className="text-base font-semibold text-white">Pro</h3>
                </div>
                {currentTier === "pro" ? (
                  <Badge className="bg-blue-950 text-blue-300">Current Plan</Badge>
                ) : (
                  <span className="rounded bg-blue-500/20 px-2 py-0.5 text-[10px] font-medium text-blue-300">Most Popular</span>
                )}
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-white">₹2,499</span>
                <span className="text-xs text-slate-400">/mo</span>
              </div>
              <ul className="mt-6 space-y-2.5 text-xs text-slate-300">
                {planFeatures.pro.map((feat) => (
                  <li key={feat} className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-400" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-8">
              <Button
                onClick={() => void handleSubscribe("pro")}
                disabled={currentTier === "pro" || subscribing === "pro"}
                className="w-full bg-blue-600 text-xs font-medium text-white hover:bg-blue-500"
              >
                {currentTier === "pro" ? "Active Plan" : subscribing === "pro" ? "Opening Razorpay..." : "Upgrade to Pro (₹2,499)"}
              </Button>
            </div>
          </Card>

          {/* Team Plan */}
          <Card className={`flex flex-col justify-between border-purple-900/60 bg-slate-900/80 p-6 ${currentTier === "team" ? "ring-2 ring-purple-500" : ""}`}>
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CreditCard size={16} className="text-purple-400" />
                  <h3 className="text-base font-semibold text-white">Team</h3>
                </div>
                {currentTier === "team" && <Badge className="bg-purple-950 text-purple-300">Current Plan</Badge>}
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-white">₹8,299</span>
                <span className="text-xs text-slate-400">/mo</span>
              </div>
              <ul className="mt-6 space-y-2.5 text-xs text-slate-300">
                {planFeatures.team.map((feat) => (
                  <li key={feat} className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-400" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-8">
              <Button
                onClick={() => void handleSubscribe("team")}
                disabled={currentTier === "team" || subscribing === "team"}
                className="w-full bg-purple-600 text-xs font-medium text-white hover:bg-purple-500"
              >
                {currentTier === "team" ? "Active Plan" : subscribing === "team" ? "Opening Razorpay..." : "Upgrade to Team (₹8,299)"}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
