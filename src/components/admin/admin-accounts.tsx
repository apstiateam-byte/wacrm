"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { LIMIT_KEYS, type Addon, type Plan } from "@/lib/billing/types";
import type { AdminAccountRow } from "@/app/api/admin/accounts/route";

const SELECT_CLASS =
  "w-full rounded-md border border-border bg-muted px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none";
const STATUSES = ["trialing", "active", "past_due", "canceled", "expired"] as const;

/** ISO → value for <input type="date">. */
function toDateInput(iso: string | null | undefined): string {
  return iso ? new Date(iso).toISOString().slice(0, 10) : "";
}

/** The fields of a workspace the manage dialog reads and edits. */
export type ManageableAccount = Pick<
  AdminAccountRow,
  "id" | "name" | "owner_email" | "subscription" | "suspended_at" | "addons" | "limit_overrides"
>;

export function ManageAccountDialog({
  row,
  plans,
  addons,
  onClose,
  onSaved,
}: {
  row: ManageableAccount;
  plans: Plan[];
  addons: Addon[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("Admin.manage");
  const tl = useTranslations("Billing.limits");
  const tStatus = useTranslations("Admin.statuses");
  const sub = row.subscription;
  const overrides = (row.limit_overrides?.limits ?? {}) as Record<string, number | null>;

  const [planCode, setPlanCode] = useState(sub?.plan_code ?? "trial");
  const [status, setStatus] = useState(sub?.status ?? "trialing");
  const [interval, setBillingInterval] = useState(sub?.billing_interval ?? "");
  const [trialEnds, setTrialEnds] = useState(toDateInput(sub?.trial_ends_at));
  const [periodEnds, setPeriodEnds] = useState(toDateInput(sub?.current_period_end));
  const [suspended, setSuspended] = useState(row.suspended_at != null);
  const [addonQty, setAddonQty] = useState<Record<string, number>>(
    Object.fromEntries(addons.map((a) => [a.code, row.addons.find((x) => x.addon_code === a.code)?.quantity ?? 0])),
  );
  const [limitOverrides, setLimitOverrides] = useState<Record<string, string>>(
    Object.fromEntries(
      LIMIT_KEYS.filter((k) => k in overrides).map((k) => [k, overrides[k] == null ? "unlimited" : String(overrides[k])]),
    ),
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const limits: Record<string, number | null> = {};
      for (const [k, v] of Object.entries(limitOverrides)) {
        const trimmed = v.trim().toLowerCase();
        if (trimmed === "") continue;
        limits[k] = trimmed === "unlimited" ? null : Math.max(0, Math.floor(Number(trimmed)));
      }
      const res = await fetch(`/api/admin/accounts/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_code: planCode,
          status,
          billing_interval: interval || null,
          trial_ends_at: trialEnds ? new Date(`${trialEnds}T23:59:59`).toISOString() : null,
          current_period_end: periodEnds ? new Date(`${periodEnds}T23:59:59`).toISOString() : null,
          suspended,
          addons: addonQty,
          limit_overrides: { limits, features: row.limit_overrides?.features ?? {} },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) toast.error(data.error ?? t("saveFailed"));
      else {
        toast.success(t("saved"));
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  }

  const extendTrial = (days: number) => {
    const base = trialEnds ? new Date(trialEnds) : new Date();
    const from = base.getTime() < Date.now() ? new Date() : base;
    setTrialEnds(toDateInput(new Date(from.getTime() + days * 86_400_000).toISOString()));
    setStatus("trialing");
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{row.name}</DialogTitle>
          <DialogDescription>{row.owner_email ?? row.id}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>{t("plan")}</Label>
            <select className={SELECT_CLASS} value={planCode} onChange={(e) => setPlanCode(e.target.value)}>
              {plans.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("status")}</Label>
            <select className={SELECT_CLASS} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {tStatus(s)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("interval")}</Label>
            <select className={SELECT_CLASS} value={interval} onChange={(e) => setBillingInterval(e.target.value)}>
              <option value="">—</option>
              <option value="monthly">{t("monthly")}</option>
              <option value="annual">{t("annual")}</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t("trialEnds")}</Label>
            <Input type="date" value={trialEnds} onChange={(e) => setTrialEnds(e.target.value)} />
            <div className="flex gap-2">
              <Button type="button" size="xs" variant="outline" onClick={() => extendTrial(7)}>
                {t("extend", { days: 7 })}
              </Button>
              <Button type="button" size="xs" variant="outline" onClick={() => extendTrial(14)}>
                {t("extend", { days: 14 })}
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("periodEnds")}</Label>
            <Input type="date" value={periodEnds} onChange={(e) => setPeriodEnds(e.target.value)} />
            <p className="text-xs text-muted-foreground">{t("periodHint")}</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-foreground">{t("addons")}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {addons.map((a) => (
              <div key={a.code} className="space-y-1">
                <Label className="text-xs">{a.name}</Label>
                <Input
                  type="number"
                  min={0}
                  value={addonQty[a.code] ?? 0}
                  onChange={(e) => setAddonQty((q) => ({ ...q, [a.code]: Math.max(0, Number(e.target.value)) }))}
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-foreground">{t("overrides")}</p>
          <p className="mb-2 text-xs text-muted-foreground">{t("overridesHint")}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {LIMIT_KEYS.map((k) => (
              <div key={k} className="space-y-1">
                <Label className="text-xs">{tl(k)}</Label>
                <Input
                  placeholder={t("planDefault")}
                  value={limitOverrides[k] ?? ""}
                  onChange={(e) => setLimitOverrides((o) => ({ ...o, [k]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </div>

        <label className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 p-3 text-sm">
          <span>
            <span className="font-medium text-foreground">{t("suspend")}</span>
            <span className="block text-xs text-muted-foreground">{t("suspendHint")}</span>
          </span>
          <Switch checked={suspended} onCheckedChange={(v) => setSuspended(!!v)} />
        </label>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
