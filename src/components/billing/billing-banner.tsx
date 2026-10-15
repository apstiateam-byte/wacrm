"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Clock, CreditCard, Lock, Sparkles } from "lucide-react";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { useBilling } from "@/hooks/use-billing";
import { daysUntil } from "@/lib/billing/types";
import { createClient } from "@/lib/supabase/client";

/**
 * Shown inside the shared live-demo workspace. "Start free trial" signs
 * the visitor out of the demo first, since /signup redirects signed-in
 * users to the dashboard.
 */
function DemoBanner() {
  const t = useTranslations("Billing.demo");
  const startTrial = async () => {
    await createClient().auth.signOut();
    // Full reload on purpose: drop every bit of the demo session's
    // client state before the real signup.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/signup");
  };
  return (
    <Alert className="mb-4 border-primary/40 bg-primary/5">
      <Sparkles />
      <AlertTitle>{t("title")}</AlertTitle>
      <AlertDescription>{t("body")}</AlertDescription>
      <AlertAction>
        <button type="button" onClick={startTrial} className={buttonVariants({ size: "sm" })}>
          {t("cta")}
        </button>
      </AlertAction>
    </Alert>
  );
}

/** Show the trial countdown only in its last days, to stay out of the way. */
const TRIAL_WARN_DAYS = 7;

/**
 * Plan status strip above every dashboard page: trial ending soon,
 * payment failed, cancelled, or read-only. Renders nothing while
 * billing is disabled (self-hosted) or the account is in good standing.
 */
export function BillingBanner() {
  const { summary } = useBilling();
  const t = useTranslations("Billing.banner");

  if (summary?.is_demo) return <DemoBanner />;
  if (!summary?.billing_enabled) return null;
  const { state } = summary.entitlements;
  const sub = summary.subscription;

  const cta = (label: string) => (
    <AlertAction>
      <Link href="/settings?tab=billing" className={buttonVariants({ size: "sm" })}>
        {label}
      </Link>
    </AlertAction>
  );

  if (state === "trialing") {
    const days = daysUntil(sub?.trial_ends_at);
    if (days == null || days > TRIAL_WARN_DAYS) return null;
    return (
      <Alert className="mb-4">
        <Clock />
        <AlertTitle>{t("trialTitle", { days })}</AlertTitle>
        <AlertDescription>{t("trialBody")}</AlertDescription>
        {cta(t("choosePlan"))}
      </Alert>
    );
  }

  if (state === "past_due") {
    return (
      <Alert variant="destructive" className="mb-4">
        <CreditCard />
        <AlertTitle>{t("pastDueTitle")}</AlertTitle>
        <AlertDescription>{t("pastDueBody")}</AlertDescription>
        {cta(t("fixPayment"))}
      </Alert>
    );
  }

  if (state === "canceled") {
    const days = daysUntil(sub?.current_period_end);
    return (
      <Alert className="mb-4">
        <Clock />
        <AlertTitle>{t("canceledTitle", { days: days ?? 0 })}</AlertTitle>
        <AlertDescription>{t("canceledBody")}</AlertDescription>
        {cta(t("resubscribe"))}
      </Alert>
    );
  }

  if (state === "active" && sub?.billing_interval === "annual" && sub.cancel_at_period_end) {
    const days = daysUntil(sub.current_period_end);
    if (days == null || days > 14) return null;
    return (
      <Alert className="mb-4">
        <Clock />
        <AlertTitle>{t("renewTitle", { days })}</AlertTitle>
        <AlertDescription>{t("renewBody")}</AlertDescription>
        {cta(t("renew"))}
      </Alert>
    );
  }

  if (state === "trial_expired" || state === "expired" || state === "suspended") {
    return (
      <Alert variant="destructive" className="mb-4">
        <Lock />
        <AlertTitle>
          {state === "trial_expired"
            ? t("trialExpiredTitle")
            : state === "suspended"
              ? t("suspendedTitle")
              : t("expiredTitle")}
        </AlertTitle>
        <AlertDescription>
          {state === "suspended" ? t("suspendedBody") : t("readOnlyBody")}
        </AlertDescription>
        {state !== "suspended" ? cta(t("choosePlan")) : null}
      </Alert>
    );
  }

  return null;
}
