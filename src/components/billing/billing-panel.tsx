"use client";

// ============================================================
// Settings → Billing & plan
//
// Current plan + status, usage meters, plan picker with Razorpay
// checkout, GST/invoice details and payment history. Every member can
// see the plan and usage; only admins can buy, owners can cancel.
// ============================================================

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useBilling } from "@/hooks/use-billing";
import {
  CheckoutDismissedError,
  formatInr,
  openRazorpayCheckout,
  type CheckoutSession,
} from "@/lib/billing/razorpay-checkout";
import { daysUntil, isReadOnlyState, type BillingInterval, type BillingState, type Plan } from "@/lib/billing/types";
import { SettingsPanelHead } from "@/components/settings/settings-panel-head";
import { APP_NAME } from "@/lib/brand";
import { UsageMeters } from "./usage-meters";
import { PlanPicker } from "./plan-picker";
import { BillingDetailsForm } from "./billing-details-form";
import { AddonsSection } from "./addons-section";

const SALES_HREF = process.env.NEXT_PUBLIC_SALES_URL || "mailto:sales@example.com";
const BUSINESS_NAME = APP_NAME;

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function stateVariant(state: BillingState): "default" | "secondary" | "destructive" | "outline" {
  if (state === "active" || state === "unlimited") return "default";
  if (state === "trialing" || state === "canceled") return "secondary";
  if (state === "past_due" || isReadOnlyState(state)) return "destructive";
  return "outline";
}

export function BillingPanel() {
  const t = useTranslations("Billing.panel");
  const tState = useTranslations("Billing.states");
  const { canEditSettings, isOwner } = useAuth();
  const { summary, loading, refresh } = useBilling();
  const [busy, setBusy] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  if (loading || !summary) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> {t("loading")}
      </div>
    );
  }

  if (!summary.billing_enabled) {
    return (
      <div>
        <SettingsPanelHead title={t("title")} description={t("description")} />
        <Card>
          <CardContent className="flex items-start gap-3 py-5">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium text-foreground">{t("disabledTitle")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("disabledBody")}</p>
              {summary.is_platform_admin ? (
                <Link href="/admin" className={buttonVariants({ variant: "outline", size: "sm", className: "mt-3" })}>
                  {t("openAdmin")}
                </Link>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { entitlements: ent, subscription: sub } = summary;
  const plan = summary.plans.find((p) => p.code === ent.plan_code);
  const isPaid = sub?.status !== "trialing" && ent.state !== "trial_expired";
  const canCancel =
    isOwner &&
    sub?.billing_interval === "monthly" &&
    !sub.cancel_at_period_end &&
    (ent.state === "active" || ent.state === "past_due");

  let statusLine: string;
  if (ent.state === "trialing") statusLine = t("trialEnds", { date: fmtDate(sub?.trial_ends_at), days: daysUntil(sub?.trial_ends_at) ?? 0 });
  else if (ent.state === "trial_expired") statusLine = t("trialEnded", { date: fmtDate(sub?.trial_ends_at) });
  else if (ent.state === "active" && sub?.cancel_at_period_end) statusLine = t("endsOn", { date: fmtDate(sub.current_period_end) });
  else if (ent.state === "active") statusLine = t("renewsOn", { date: fmtDate(sub?.current_period_end) });
  else if (ent.state === "canceled") statusLine = t("endsOn", { date: fmtDate(sub?.current_period_end) });
  else if (ent.state === "past_due") statusLine = t("pastDue");
  else if (ent.state === "suspended") statusLine = t("suspended");
  else statusLine = t("expiredOn", { date: fmtDate(sub?.current_period_end) });

  async function choose(next: Plan, interval: BillingInterval) {
    const key = `${next.code}:${interval}`;
    setBusy(key);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_code: next.code, interval }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? t("checkoutFailed"));
        return;
      }
      const session = data as CheckoutSession;
      const payment = await openRazorpayCheckout(session, {
        businessName: BUSINESS_NAME,
        description: t("checkoutDescription", {
          plan: next.name,
          interval: interval === "monthly" ? t("intervalMonthly") : t("intervalAnnual"),
        }),
      });
      const verify = await fetch("/api/billing/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payment),
      });
      if (!verify.ok) {
        const v = await verify.json().catch(() => ({}));
        // Paid but our verify call failed — the webhook will still
        // activate the plan; tell the user it's processing.
        toast.message(v.error ?? t("paymentProcessing"));
      } else {
        toast.success(t("paymentSuccess", { plan: next.name }));
      }
      await refresh();
    } catch (err) {
      if (!(err instanceof CheckoutDismissedError)) {
        toast.error(err instanceof Error ? err.message : t("checkoutFailed"));
      }
    } finally {
      setBusy(null);
    }
  }

  async function cancel() {
    if (!confirm(t("cancelConfirm"))) return;
    setCancelling(true);
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) toast.error(data.error ?? t("cancelFailed"));
      else toast.success(t("cancelDone", { date: fmtDate(data.access_until) }));
      await refresh();
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <SettingsPanelHead title={t("title")} description={t("description")} />
        <Card>
          <CardContent className="space-y-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-semibold text-foreground">{plan?.name ?? ent.plan_code}</h3>
                  <Badge variant={stateVariant(ent.state)}>{tState(ent.state)}</Badge>
                  {sub?.billing_interval ? (
                    <Badge variant="outline">
                      {sub.billing_interval === "monthly" ? t("intervalMonthly") : t("intervalAnnual")}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{statusLine}</p>
              </div>
              {canCancel ? (
                <Button variant="outline" size="sm" onClick={cancel} disabled={cancelling}>
                  {cancelling ? <Loader2 className="size-4 animate-spin" /> : null}
                  {t("cancel")}
                </Button>
              ) : null}
            </div>
            <UsageMeters entitlements={ent} />
          </CardContent>
        </Card>
      </div>

      <div>
        <SettingsPanelHead
          title={t("plansTitle")}
          description={canEditSettings ? t("plansDescription") : t("plansAdminOnly")}
        />
        {!summary.checkout_available ? (
          <div
            role="note"
            className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200"
          >
            <span>{summary.is_platform_admin ? t("checkoutAdminHint") : t("checkoutNotConfigured")}</span>
            {summary.is_platform_admin ? (
              <Link href="/admin/settings#payments" className={buttonVariants({ size: "sm" })}>
                {t("checkoutAdminLink")}
              </Link>
            ) : null}
          </div>
        ) : null}
        <PlanPicker
          plans={summary.plans}
          currentPlanCode={ent.plan_code}
          currentIsPaid={isPaid}
          currentInterval={sub?.billing_interval ?? null}
          gstPercent={summary.gst_percent}
          pricesIncludeGst={summary.prices_include_gst}
          canPurchase={canEditSettings && summary.checkout_available && ent.state !== "suspended"}
          busy={busy}
          onChoose={choose}
          salesHref={SALES_HREF}
        />
      </div>

      {summary.addons.length > 0 ? (
        <div>
          <SettingsPanelHead
            title={t("addonsTitle")}
            description={
              ent.state === "active" || ent.state === "past_due" ? t("addonsDescription") : t("addonsNeedPlan")
            }
          />
          <AddonsSection
            summary={summary}
            canPurchase={
              canEditSettings &&
              summary.checkout_available &&
              (ent.state === "active" || ent.state === "past_due")
            }
            onChanged={refresh}
          />
        </div>
      ) : null}

      {summary.details ? (
        <div>
          <SettingsPanelHead title={t("detailsTitle")} description={t("detailsDescription")} />
          <BillingDetailsForm initial={summary.details} onSaved={refresh} />
        </div>
      ) : null}

      {summary.payments ? (
        <div>
          <SettingsPanelHead title={t("historyTitle")} />
          {summary.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("historyEmpty")}</p>
          ) : (
            <Card>
              <CardContent className="divide-y divide-border p-0">
                {summary.payments.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">
                        {summary.plans.find((x) => x.code === p.plan_code)?.name ?? p.plan_code ?? "—"}
                        {p.billing_interval ? (
                          <span className="ml-1 text-muted-foreground">
                            · {p.billing_interval === "monthly" ? t("intervalMonthly") : t("intervalAnnual")}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {fmtDate(p.paid_at ?? p.created_at)} · {p.provider_payment_id}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={p.status === "captured" ? "secondary" : "outline"}>{p.status}</Badge>
                      <span className="tabular-nums">{formatInr(p.amount_paise / 100)}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          <p className="mt-2 text-xs text-muted-foreground">{t("invoiceNote")}</p>
        </div>
      ) : null}
    </div>
  );
}
