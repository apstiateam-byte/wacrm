"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BillingDetails } from "@/lib/billing/types";

/** GST / invoice details (admin+). Saved via PATCH /api/billing. */
export function BillingDetailsForm({
  initial,
  onSaved,
}: {
  initial: BillingDetails;
  onSaved: () => void | Promise<void>;
}) {
  const t = useTranslations("Billing.details");
  const [form, setForm] = useState<BillingDetails>(initial);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof BillingDetails) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/billing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? t("saveFailed"));
        return;
      }
      toast.success(t("saved"));
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="py-5">
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="billing_name">{t("name")}</Label>
            <Input id="billing_name" value={form.billing_name ?? ""} onChange={(e) => set("billing_name")(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="billing_email">{t("email")}</Label>
            <Input
              id="billing_email"
              type="email"
              value={form.billing_email ?? ""}
              onChange={(e) => set("billing_email")(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="billing_gstin">{t("gstin")}</Label>
            <Input
              id="billing_gstin"
              value={form.billing_gstin ?? ""}
              placeholder="22AAAAA0000A1Z5"
              maxLength={15}
              onChange={(e) => set("billing_gstin")(e.target.value.toUpperCase())}
            />
            <p className="text-xs text-muted-foreground">{t("gstinHint")}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="billing_state">{t("state")}</Label>
            <Input id="billing_state" value={form.billing_state ?? ""} onChange={(e) => set("billing_state")(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="billing_address">{t("address")}</Label>
            <Textarea
              id="billing_address"
              rows={3}
              value={form.billing_address ?? ""}
              onChange={(e) => set("billing_address")(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("save")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
