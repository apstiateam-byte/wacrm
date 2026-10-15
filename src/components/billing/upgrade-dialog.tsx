"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BillingSummary, PlanLimitPayload } from "@/lib/billing/types";

/**
 * Explains why an action was blocked by the plan (limit reached,
 * feature not included, or workspace read-only) and links to
 * Settings → Billing & plan. Opened by <BillingProvider>.
 */
export function UpgradeDialog({
  open,
  onOpenChange,
  reason,
  summary,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: PlanLimitPayload | null;
  summary: BillingSummary | null;
}) {
  const t = useTranslations("Billing.upgrade");
  // Lowercase, mid-sentence labels ("12 contacts"), shared with the API errors.
  const tLimits = useTranslations("Api.billing.limits");
  const tFeatures = useTranslations("Billing.features");

  let body: string;
  if (!reason) {
    body = t("genericBody");
  } else if (reason.code === "account_read_only") {
    body = t("readOnlyBody");
  } else if (reason.code === "feature_not_in_plan" && reason.key) {
    body = t("featureBody", { feature: tFeatures(reason.key as "flows" | "ai" | "api") });
  } else if (reason.code === "plan_limit_reached" && reason.key) {
    body =
      reason.limit != null
        ? t("limitBody", { limit: reason.limit, what: tLimits(reason.key as "contacts") })
        : t("limitBodyNoNumber", { what: tLimits(reason.key as "contacts") });
  } else {
    body = t("genericBody");
  }

  const currentPlan = summary?.plans.find((p) => p.code === summary.entitlements.plan_code);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="size-5" />
          </div>
          <DialogTitle>
            {reason?.code === "account_read_only" ? t("readOnlyTitle") : t("title")}
          </DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        {currentPlan ? (
          <p className="text-sm text-muted-foreground">
            {t("currentPlan", { plan: currentPlan.name })}
          </p>
        ) : null}
        <DialogFooter>
          <button
            type="button"
            className={buttonVariants({ variant: "outline" })}
            onClick={() => onOpenChange(false)}
          >
            {t("notNow")}
          </button>
          <Link
            href="/settings?tab=billing"
            className={buttonVariants({ variant: "default" })}
            onClick={() => onOpenChange(false)}
          >
            {t("seePlans")}
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
