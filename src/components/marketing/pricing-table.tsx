"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Minus } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatInr } from "@/lib/billing/razorpay-checkout";
import {
  annualMonthlyEquivalent,
  annualSavingPercent,
  LIMIT_KEYS,
  type Addon,
  type BillingInterval,
  type FeatureKey,
  type LimitKey,
  type Plan,
} from "@/lib/billing/types";

// The public site is English (see src/content/marketing.ts), so labels
// live here rather than in the app's translation catalogues.
const LIMIT_LABELS: Record<LimitKey, string> = {
  seats: "Team seats",
  contacts: "Contacts",
  broadcast_recipients_monthly: "Broadcast recipients / month",
  pipelines: "Sales pipelines",
  automations: "Automations",
  flows: "Chatbot flows",
  api_keys: "API keys",
  webhook_endpoints: "Webhook endpoints",
};
const FEATURE_LABELS: Record<FeatureKey, string> = {
  flows: "No-code chatbot flows",
  ai: "AI replies & AI agents",
  api: "Public API, webhooks & MCP",
};
const ALWAYS_INCLUDED = [
  "Shared team inbox",
  "Templates & quick replies",
  "Broadcast campaigns",
  "Contacts, tags & custom fields",
  "Analytics dashboard",
];
const CARD_LIMITS: readonly LimitKey[] = ["seats", "contacts", "broadcast_recipients_monthly", "automations"];

const fmt = new Intl.NumberFormat("en-IN");

function limitText(plan: Plan, key: LimitKey): string {
  if (key === "flows" && plan.features.flows === false) return "—";
  const v = plan.limits[key];
  if (v == null) return "Unlimited";
  return v === 0 ? "—" : fmt.format(v);
}

export function PricingTable({
  plans,
  addons,
  gstPercent,
  salesHref,
  compact = false,
}: {
  plans: Plan[];
  addons: Addon[];
  gstPercent: number;
  salesHref: string;
  /** Landing-page version: plan cards only (no comparison table / add-ons). */
  compact?: boolean;
}) {
  const [interval, setBillingInterval] = useState<BillingInterval>("monthly");
  const saving = Math.max(0, ...plans.map((p) => annualSavingPercent(p) ?? 0));

  return (
    <>
      <div className="mt-10 flex justify-center">
        <div className="inline-flex rounded-lg border border-border bg-card p-1" role="radiogroup" aria-label="Billing period">
          {(["monthly", "annual"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={interval === value}
              onClick={() => setBillingInterval(value)}
              className={cn(
                "rounded-md px-4 py-2 text-sm font-medium transition-colors",
                interval === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {value === "monthly" ? "Monthly" : "Annual"}
              {value === "annual" && saving > 0 ? <span className="ml-1.5 text-xs opacity-80">save {saving}%</span> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const monthly = interval === "monthly" ? plan.price_inr_monthly : annualMonthlyEquivalent(plan);
          return (
            <div
              key={plan.code}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-card p-6",
                plan.highlighted ? "border-primary shadow-lg shadow-primary/10 ring-1 ring-primary/40" : "border-border",
              )}
            >
              {plan.highlighted ? (
                <span className="absolute -top-3 left-6 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
                  Most popular
                </span>
              ) : null}
              <h2 className="text-lg font-semibold">{plan.name}</h2>
              <p className="mt-1 min-h-10 text-sm text-muted-foreground">{plan.description}</p>
              <div className="mt-5 min-h-[4.5rem]">
                {plan.contact_sales || monthly == null ? (
                  <p className="text-3xl font-bold">Custom</p>
                ) : (
                  <>
                    <p className="text-3xl font-bold">
                      {formatInr(monthly)}
                      <span className="text-sm font-normal text-muted-foreground">/month</span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {interval === "annual" && plan.price_inr_annual != null
                        ? `${formatInr(plan.price_inr_annual)} billed yearly`
                        : "Billed monthly"}
                      {gstPercent > 0 ? ` · +${gstPercent}% GST` : ""}
                    </p>
                  </>
                )}
              </div>
              {plan.contact_sales ? (
                <a href={salesHref} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "mt-5 w-full")}>
                  Contact sales
                </a>
              ) : (
                <Link
                  href={`/signup?plan=${encodeURIComponent(plan.code)}&interval=${interval}`}
                  className={cn(buttonVariants({ variant: plan.highlighted ? "default" : "outline", size: "lg" }), "mt-5 w-full")}
                >
                  Start free trial
                </Link>
              )}
              <ul className="mt-6 space-y-2.5 text-sm">
                {CARD_LIMITS.map((key) => (
                  <li key={key} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>
                      <span className="font-medium">{limitText(plan, key)}</span> {LIMIT_LABELS[key].toLowerCase()}
                    </span>
                  </li>
                ))}
                {(Object.keys(FEATURE_LABELS) as FeatureKey[]).map((f) => (
                  <li key={f} className={cn("flex items-start gap-2", !plan.features[f] && "text-muted-foreground")}>
                    {plan.features[f] ? <Check className="mt-0.5 size-4 shrink-0 text-primary" /> : <Minus className="mt-0.5 size-4 shrink-0" />}
                    {FEATURE_LABELS[f]}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {compact ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Prices exclude GST. WhatsApp message charges are billed by Meta with no markup.{" "}
          <Link href="/pricing" className="font-medium text-primary underline-offset-4 hover:underline">
            Compare all features & add-ons →
          </Link>
        </p>
      ) : null}

      {/* Full comparison */}
      {compact ? null : (<>
      <div className="mt-16 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">Plan comparison</caption>
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Compare plans</th>
              {plans.map((p) => (
                <th key={p.code} scope="col" className="px-4 py-3 font-semibold">{p.name}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ALWAYS_INCLUDED.map((label) => (
              <tr key={label}>
                <th scope="row" className="px-4 py-2.5 text-left font-normal text-muted-foreground">{label}</th>
                {plans.map((p) => (
                  <td key={p.code} className="px-4 py-2.5"><Check className="size-4 text-primary" aria-label="Included" /></td>
                ))}
              </tr>
            ))}
            {LIMIT_KEYS.map((key) => (
              <tr key={key}>
                <th scope="row" className="px-4 py-2.5 text-left font-normal text-muted-foreground">{LIMIT_LABELS[key]}</th>
                {plans.map((p) => (
                  <td key={p.code} className="px-4 py-2.5 tabular-nums">{limitText(p, key)}</td>
                ))}
              </tr>
            ))}
            {(Object.keys(FEATURE_LABELS) as FeatureKey[]).map((f) => (
              <tr key={f}>
                <th scope="row" className="px-4 py-2.5 text-left font-normal text-muted-foreground">{FEATURE_LABELS[f]}</th>
                {plans.map((p) => (
                  <td key={p.code} className="px-4 py-2.5">
                    {p.features[f] ? <Check className="size-4 text-primary" aria-label="Included" /> : <Minus className="size-4 text-muted-foreground" aria-label="Not included" />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {addons.length ? (
        <div className="mt-16">
          <h2 className="text-center text-2xl font-bold tracking-tight">Add-ons</h2>
          <div className="mx-auto mt-8 grid max-w-4xl gap-4 sm:grid-cols-3">
            {addons.map((a) => (
              <div key={a.code} className="rounded-xl border border-border bg-card p-5">
                <p className="font-medium">{a.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{a.description}</p>
                <p className="mt-3 font-semibold">
                  {formatInr(a.price_inr_monthly)}
                  <span className="text-sm font-normal text-muted-foreground">/month</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      </>)}
    </>
  );
}
