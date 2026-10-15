"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { useBilling } from "@/hooks/use-billing";
import { daysUntil, isReadOnlyState } from "@/lib/billing/types";

/**
 * Compact plan strip at the bottom of the sidebar: plan name and, for
 * trials, days left with a progress bar. Links to Billing & plan.
 * Hidden while billing is disabled.
 */
export function SidebarPlanCard() {
  const { summary } = useBilling();
  const t = useTranslations("Billing.sidebar");
  if (!summary?.billing_enabled) return null;

  const { entitlements: ent, subscription: sub } = summary;
  const plan = summary.plans.find((p) => p.code === ent.plan_code);
  const readOnly = isReadOnlyState(ent.state);
  const trialDays = ent.state === "trialing" ? daysUntil(sub?.trial_ends_at) : null;
  // Bar scale: the default trial length, stretched if a longer trial was granted.
  const trialScale = Math.max(14, trialDays ?? 0);

  return (
    <div className="shrink-0 px-3 pb-3">
      <Link
        href="/settings?tab=billing"
        className={cn(
          "block rounded-lg border p-3 text-xs transition-colors hover:bg-muted/60",
          readOnly ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/30",
        )}
      >
        <div className="flex items-center gap-2">
          <Sparkles className={cn("size-3.5", readOnly ? "text-destructive" : "text-primary")} />
          <span className="font-semibold text-foreground">{plan?.name ?? ent.plan_code}</span>
          <span className="ml-auto text-muted-foreground">
            {trialDays != null
              ? t("daysLeft", { days: trialDays })
              : readOnly
                ? t("readOnly")
                : null}
          </span>
        </div>
        {trialDays != null ? (
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.max(4, (trialDays / trialScale) * 100)}%` }}
            />
          </div>
        ) : null}
        {ent.state === "trialing" || readOnly ? (
          <p className="mt-2 font-medium text-primary">{t("upgrade")}</p>
        ) : null}
      </Link>
    </div>
  );
}
