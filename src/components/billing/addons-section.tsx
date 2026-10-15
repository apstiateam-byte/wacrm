"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Minus, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckoutDismissedError,
  formatInr,
  openRazorpayCheckout,
  type CheckoutSession,
} from "@/lib/billing/razorpay-checkout";
import type { BillingSummary } from "@/lib/billing/types";
import { APP_NAME } from "@/lib/brand";

const BUSINESS_NAME = APP_NAME;

/**
 * Buy / change / stop add-ons (extra seats, contacts, flows). Each
 * add-on is its own monthly Razorpay subscription; changing the
 * quantity buys a new one, which replaces the old once it's active.
 */
export function AddonsSection({
  summary,
  canPurchase,
  onChanged,
}: {
  summary: BillingSummary;
  canPurchase: boolean;
  onChanged: () => Promise<void>;
}) {
  const t = useTranslations("Billing.addons");
  const owned = new Map(summary.account_addons.map((a) => [a.addon_code, a]));
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(summary.addons.map((a) => [a.code, Math.max(1, owned.get(a.code)?.quantity ?? 1)])),
  );
  const [busy, setBusy] = useState<string | null>(null);

  async function buy(code: string, name: string) {
    setBusy(code);
    try {
      const res = await fetch("/api/billing/addons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addon_code: code, quantity: qty[code] }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? t("failed"));
        return;
      }
      const payment = await openRazorpayCheckout(data as CheckoutSession, {
        businessName: BUSINESS_NAME,
        description: t("checkoutDescription", { addon: name, quantity: qty[code] }),
      });
      const verify = await fetch("/api/billing/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payment),
      });
      if (verify.ok) toast.success(t("added", { addon: name }));
      else toast.message(t("processing"));
      await onChanged();
    } catch (err) {
      if (!(err instanceof CheckoutDismissedError)) {
        toast.error(err instanceof Error ? err.message : t("failed"));
      }
    } finally {
      setBusy(null);
    }
  }

  async function stop(code: string) {
    if (!confirm(t("stopConfirm"))) return;
    setBusy(code);
    try {
      const res = await fetch("/api/billing/addons", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addon_code: code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) toast.error(data.error ?? t("failed"));
      else toast.success(t("stopped"));
      await onChanged();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {summary.addons.map((a) => {
        const mine = owned.get(a.code);
        const q = qty[a.code] ?? 1;
        const changed = !mine || mine.quantity !== q;
        return (
          <Card key={a.code}>
            <CardContent className="flex h-full flex-col gap-3 py-5">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-foreground">{a.name}</p>
                {mine ? (
                  <Badge variant={mine.cancel_at_period_end ? "outline" : "secondary"}>
                    {mine.cancel_at_period_end ? t("ending") : t("active", { quantity: mine.quantity })}
                  </Badge>
                ) : null}
              </div>
              <p className="flex-1 text-sm text-muted-foreground">{a.description}</p>
              <p className="text-sm">
                <span className="font-semibold">{formatInr(a.price_inr_monthly)}</span>
                <span className="text-muted-foreground"> {t("perUnit")}</span>
              </p>
              {mine?.managed ? (
                <p className="text-xs text-muted-foreground">{t("managed")}</p>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center rounded-md border border-border">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("decrease")}
                      disabled={q <= 1 || busy !== null}
                      onClick={() => setQty((s) => ({ ...s, [a.code]: Math.max(1, q - 1) }))}
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <span className="w-8 text-center text-sm tabular-nums">{q}</span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("increase")}
                      disabled={q >= 100 || busy !== null}
                      onClick={() => setQty((s) => ({ ...s, [a.code]: Math.min(100, q + 1) }))}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                  <Button size="sm" disabled={!canPurchase || !changed || busy !== null} onClick={() => buy(a.code, a.name)}>
                    {busy === a.code ? <Loader2 className="size-4 animate-spin" /> : null}
                    {mine ? t("update") : t("buy")}
                  </Button>
                  {mine && !mine.cancel_at_period_end ? (
                    <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => stop(a.code)}>
                      {t("stop")}
                    </Button>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
