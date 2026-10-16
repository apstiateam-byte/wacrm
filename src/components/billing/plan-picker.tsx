"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Loader2, Minus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatInr } from "@/lib/billing/razorpay-checkout";
import {
  annualMonthlyEquivalent,
  annualSavingPercent,
  finalPriceInr,
  type BillingInterval,
  type FeatureKey,
  type LimitKey,
  type Plan,
} from "@/lib/billing/types";

const HEADLINE_LIMITS: readonly LimitKey[] = [
  "seats",
  "contacts",
  "broadcast_recipients_monthly",
  "automations",
  "flows",
];
const FEATURES: readonly FeatureKey[] = ["flows", "ai", "api"];

export interface PlanPickerProps {
  plans: Plan[];
  currentPlanCode: string | null;
  /** The current plan is a paid, running subscription (not a trial). */
  currentIsPaid: boolean;
  currentInterval: BillingInterval | null;
  gstPercent: number;
  /** List prices already include GST (charged as-is). */
  pricesIncludeGst: boolean;
  canPurchase: boolean;
  /** Plan code + interval currently going through checkout. */
  busy: string | null;
  onChoose: (plan: Plan, interval: BillingInterval) => void;
  salesHref: string;
}

/**
 * Pricing cards with a monthly / annual toggle. The highlighted plan
 * gets the "Most popular" badge; Enterprise-style plans link to sales.
 */
export function PlanPicker(props: PlanPickerProps) {
  const t = useTranslations("Billing.plans");
  const tl = useTranslations("Billing.limits");
  const tf = useTranslations("Billing.features");
  const [interval, setBillingInterval] = useState<BillingInterval>(props.currentInterval ?? "monthly");
  const fmt = new Intl.NumberFormat();

  const visible = props.plans.filter((p) => p.is_public);
  const bestSaving = Math.max(0, ...visible.map((p) => annualSavingPercent(p) ?? 0));

  return (
    <div>
      <div className="mb-4 inline-flex rounded-lg border border-border bg-muted/40 p-0.5" role="radiogroup" aria-label={t("intervalLabel")}>
        {(["monthly", "annual"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={interval === value}
            onClick={() => setBillingInterval(value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              interval === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {value === "monthly" ? t("monthly") : t("annual")}
            {value === "annual" && bestSaving > 0 ? (
              <span className="ml-1.5 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                {t("savePercent", { percent: bestSaving })}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {visible.map((plan) => {
          const isCurrent = plan.code === props.currentPlanCode && props.currentIsPaid;
          const isCurrentInterval = isCurrent && props.currentInterval === interval;
          const monthly =
            interval === "monthly" ? plan.price_inr_monthly : annualMonthlyEquivalent(plan);
          const busyKey = `${plan.code}:${interval}`;
          // GST added on top: show the amount actually charged too.
          const listPrice = interval === "monthly" ? plan.price_inr_monthly : plan.price_inr_annual;
          const charged =
            !props.pricesIncludeGst && props.gstPercent > 0 && listPrice != null && !plan.contact_sales
              ? finalPriceInr(listPrice, { gstPercent: props.gstPercent, pricesIncludeGst: false })
              : null;
          return (
            <div
              key={plan.code}
              className={cn(
                "relative flex flex-col rounded-xl border bg-card p-5",
                plan.highlighted ? "border-primary shadow-sm ring-1 ring-primary/30" : "border-border",
              )}
            >
              {plan.highlighted ? (
                <Badge className="absolute -top-2.5 left-5">{t("mostPopular")}</Badge>
              ) : null}
              <h3 className="text-base font-semibold text-foreground">{plan.name}</h3>
              {plan.description ? (
                <p className="mt-1 min-h-10 text-sm text-muted-foreground">{plan.description}</p>
              ) : null}

              <div className="mt-4 min-h-16">
                {plan.contact_sales || monthly == null ? (
                  <p className="text-2xl font-bold text-foreground">{t("custom")}</p>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-foreground">
                      {formatInr(monthly)}
                      <span className="text-sm font-normal text-muted-foreground">{t("perMonth")}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {interval === "annual" && plan.price_inr_annual != null
                        ? t("billedYearly", { amount: formatInr(plan.price_inr_annual) })
                        : t("billedMonthly")}
                      {props.gstPercent > 0
                        ? ` · ${t(props.pricesIncludeGst ? "inclGst" : "plusGst", { percent: props.gstPercent })}`
                        : ""}
                    </p>
                    {charged != null ? (
                      <p className="mt-0.5 text-xs font-medium text-foreground">
                        {interval === "annual"
                          ? t("totalYearly", { amount: formatInr(charged) })
                          : t("totalMonthly", { amount: formatInr(charged) })}
                      </p>
                    ) : null}
                  </>
                )}
              </div>

              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {HEADLINE_LIMITS.map((key) => {
                  const value = plan.limits[key];
                  const off = key === "flows" && plan.features.flows === false;
                  return (
                    <li key={key} className={cn("flex items-start gap-2", off && "text-muted-foreground")}>
                      {off ? <Minus className="mt-0.5 size-4 shrink-0" /> : <Check className="mt-0.5 size-4 shrink-0 text-primary" />}
                      <span>
                        {off
                          ? tl(key)
                          : value == null
                            ? t("unlimitedOf", { what: tl(key) })
                            : t("countOf", { count: fmt.format(value), what: tl(key) })}
                      </span>
                    </li>
                  );
                })}
                {FEATURES.filter((f) => f !== "flows").map((f) => (
                  <li key={f} className={cn("flex items-start gap-2", !plan.features[f] && "text-muted-foreground")}>
                    {plan.features[f] ? (
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    ) : (
                      <Minus className="mt-0.5 size-4 shrink-0" />
                    )}
                    <span>{tf(f)}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-5">
                {plan.contact_sales ? (
                  <a href={props.salesHref} className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
                    {t("contactSales")}
                  </a>
                ) : isCurrentInterval ? (
                  <Button variant="outline" className="w-full" disabled>
                    {t("currentPlan")}
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant={plan.highlighted ? "default" : "outline"}
                    disabled={!props.canPurchase || props.busy !== null}
                    onClick={() => props.onChoose(plan, interval)}
                  >
                    {props.busy === busyKey ? <Loader2 className="size-4 animate-spin" /> : null}
                    {isCurrent ? t("switchInterval") : t("choose", { plan: plan.name })}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {interval === "annual" ? (
        <p className="mt-3 text-xs text-muted-foreground">{t("annualNote")}</p>
      ) : null}
    </div>
  );
}
