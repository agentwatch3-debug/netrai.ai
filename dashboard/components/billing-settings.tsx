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
      const res = await fetch("/api/billing/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planTier }),
      });

      const orderData = await res.json();

      if (!res.ok) {
        throw new Error(orderData.error || "Could not initiate payment");
      }

      if (orderData.demo_mode) {
        setStatusMessage({
          type: "info",
          text: `Demo Mode: Add RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET in .env.local to enable live UPI / Card payments for ₹${orderData.amount.toLocaleString("en-IN")}.`,
        });
        return;
      }

      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "NetrAI",
        description: orderData.name,
        order_id: orderData.order_id,
        theme: { color: "#161616" },
        handler: async function (response: any) {
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
    return <div className="text-xs font-mono text-inkDim py-4">Loading billing details...</div>;
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
        <Card className="border border-border bg-surface p-5">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h2 className="text-xs font-bold text-ink uppercase tracking-wider font-mono">Current Subscription</h2>
            <Badge variant="good" className="font-mono text-[10px]">
              {currentTier.toUpperCase()}
            </Badge>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-ink font-mono">
              {currentTier === "team" ? "₹8,299" : currentTier === "pro" ? "₹2,499" : "₹0"}
            </span>
            <span className="text-xs text-inkDim font-mono">/ month</span>
          </div>
          <div className="mt-3 space-y-1 text-xs text-inkDim font-mono">
            <p>Status: <span className="font-medium capitalize text-ink">{billing?.subscription_status || "Active"}</span></p>
            {billing?.current_period_end && (
              <p>Renewal date: <span className="font-medium text-ink">{new Date(billing.current_period_end).toLocaleDateString()}</span></p>
            )}
            <p>Data Retention: <span className="font-medium text-ink">{billing?.retention_days ?? 7} days</span></p>
          </div>
        </Card>

        <Card className="border border-border bg-surface p-5">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h2 className="text-xs font-bold text-ink uppercase tracking-wider font-mono">Monthly Span Usage</h2>
            <span className="text-xs text-inkDim font-mono">{used.toLocaleString()} / {limit.toLocaleString()} spans</span>
          </div>
          <div className="mt-4">
            <div className="h-2 w-full bg-paper border border-border overflow-hidden">
              <div
                className={`h-full ${pct > 90 ? "bg-bad" : pct > 75 ? "bg-warn" : "bg-ink"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-inkDim font-mono">
              <span>{pct}% utilized</span>
              <span>{(limit - used > 0 ? limit - used : 0).toLocaleString()} remaining</span>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3 text-xs text-inkDim font-mono">
            <span className="flex items-center gap-1">
              <Zap size={14} className="text-warn" /> Circuit breaker: {billing?.alert_rules_enabled ? "Enabled" : "Active"}
            </span>
          </div>
        </Card>
      </div>

      {statusMessage && (
        <div
          className={`border p-4 text-xs font-mono ${
            statusMessage.type === "success"
              ? "border-good bg-good/10 text-good"
              : statusMessage.type === "error"
              ? "border-bad bg-bad/10 text-bad"
              : "border-accent bg-accentSoft text-accent"
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
        <h2 className="mb-4 text-xs font-bold text-ink uppercase tracking-wider font-mono">Available Plans (INR)</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {/* Free Plan */}
          <Card className={`flex flex-col justify-between border p-6 ${currentTier === "free" ? "border-ink bg-paper" : "border-border bg-surface"}`}>
            <div>
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h3 className="text-sm font-bold text-ink font-mono">Free Starter</h3>
                {currentTier === "free" && <Badge variant="secondary" className="font-mono text-[10px]">Current Plan</Badge>}
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-ink font-mono">₹0</span>
                <span className="text-xs text-inkDim font-mono">/mo</span>
              </div>
              <ul className="mt-5 space-y-2 text-xs text-inkDim font-mono">
                {planFeatures.free.map((feat) => (
                  <li key={feat} className="flex items-center gap-2">
                    <Check size={14} className="text-good" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-6">
              <Button disabled variant="outline" className="w-full text-xs font-mono">
                {currentTier === "free" ? "Active" : "Included"}
              </Button>
            </div>
          </Card>

          {/* Pro Plan */}
          <Card className={`flex flex-col justify-between border p-6 ${currentTier === "pro" ? "border-ink bg-paper" : "border-border bg-surface"}`}>
            <div>
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={16} className="text-accent" />
                  <h3 className="text-sm font-bold text-ink font-mono">Pro</h3>
                </div>
                {currentTier === "pro" ? (
                  <Badge variant="good" className="font-mono text-[10px]">Current Plan</Badge>
                ) : (
                  <Badge variant="accent" className="font-mono text-[10px]">Most Popular</Badge>
                )}
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-ink font-mono">₹2,499</span>
                <span className="text-xs text-inkDim font-mono">/mo</span>
              </div>
              <ul className="mt-5 space-y-2 text-xs text-inkDim font-mono">
                {planFeatures.pro.map((feat) => (
                  <li key={feat} className="flex items-center gap-2">
                    <Check size={14} className="text-good" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-6">
              <Button
                onClick={() => void handleSubscribe("pro")}
                disabled={currentTier === "pro" || subscribing === "pro"}
                variant="primary"
                className="w-full text-xs font-mono"
              >
                {currentTier === "pro" ? "Active Plan" : subscribing === "pro" ? "Opening Razorpay..." : "Upgrade to Pro (₹2,499)"}
              </Button>
            </div>
          </Card>

          {/* Team Plan */}
          <Card className={`flex flex-col justify-between border p-6 ${currentTier === "team" ? "border-ink bg-paper" : "border-border bg-surface"}`}>
            <div>
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="flex items-center gap-1.5">
                  <CreditCard size={16} className="text-accent" />
                  <h3 className="text-sm font-bold text-ink font-mono">Team</h3>
                </div>
                {currentTier === "team" && <Badge variant="good" className="font-mono text-[10px]">Current Plan</Badge>}
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-ink font-mono">₹8,299</span>
                <span className="text-xs text-inkDim font-mono">/mo</span>
              </div>
              <ul className="mt-5 space-y-2 text-xs text-inkDim font-mono">
                {planFeatures.team.map((feat) => (
                  <li key={feat} className="flex items-center gap-2">
                    <Check size={14} className="text-good" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-6">
              <Button
                onClick={() => void handleSubscribe("team")}
                disabled={currentTier === "team" || subscribing === "team"}
                variant="primary"
                className="w-full text-xs font-mono"
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
