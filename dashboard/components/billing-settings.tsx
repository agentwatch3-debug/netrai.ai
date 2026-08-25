"use client";

import { useEffect, useState } from "react";
import { Check, CreditCard, Sparkles, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BillingUsage, PlanInfo } from "@/lib/types";

export function BillingSettings() {
  const [billing, setBilling] = useState<BillingUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [subscriptionInfo, setSubscriptionInfo] = useState<any>(null);

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
  }, []);

  async function handleSubscribe(planTier: string) {
    setSubscribing(planTier);
    try {
      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planTier }),
      });
      if (res.ok) {
        const data = await res.json();
        setSubscriptionInfo(data);
        // If razorpay checkout is available on window or redirect
        if (data.short_url) {
          window.open(data.short_url, "_blank");
        }
      }
    } finally {
      setSubscribing(null);
      void loadBilling();
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
    pro: ["1,000,000 spans / month", "30-day data retention", "5 team seats", "Alert rules & webhooks", "Standard support"],
    team: ["10,000,000 spans / month", "90-day data retention", "20 team seats", "Alert rules & webhooks", "Gated PII unmasking", "Dedicated support"],
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
              {currentTier === "team" ? "₹9,999" : currentTier === "pro" ? "₹1,999" : "₹0"}
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
              <Zap size={14} className="text-amber-400" /> Alert rules: {billing?.alert_rules_enabled ? "Enabled" : "Upgrade required"}
            </span>
          </div>
        </Card>
      </div>

      {subscriptionInfo && (
        <div className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-4 text-sm">
          <p className="font-medium text-emerald-300">Subscription Created via Razorpay!</p>
          <p className="mt-1 text-xs text-slate-300">
            Subscription ID: <code className="font-mono">{subscriptionInfo.subscription_id}</code>. Complete payment at the checkout link to activate your tier.
          </p>
        </div>
      )}

      {/* Pricing & Plan Upgrade Grid */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-white">Available Plans</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {/* Free Plan */}
          <Card className={`flex flex-col justify-between border-slate-800 bg-slate-900/40 p-6 ${currentTier === "free" ? "ring-2 ring-slate-600" : ""}`}>
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-white">Free</h3>
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
                  <span className="rounded bg-blue-500/20 px-2 py-0.5 text-[10px] font-medium text-blue-300">Popular</span>
                )}
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-white">₹1,999</span>
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
                {currentTier === "pro" ? "Active Plan" : subscribing === "pro" ? "Processing..." : "Upgrade to Pro"}
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
                <span className="text-2xl font-bold text-white">₹9,999</span>
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
                {currentTier === "team" ? "Active Plan" : subscribing === "team" ? "Processing..." : "Upgrade to Team"}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
