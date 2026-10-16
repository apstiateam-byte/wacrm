"use client";

// ============================================================
// Platform admin — the SaaS operator's console (/admin).
//
// Headline metrics, the platform billing switches, the plan catalogue
// editor and the workspace list. Data comes from /api/admin/*, which
// only answers users listed in `platform_admins`.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SettingsPanelHead } from "@/components/settings/settings-panel-head";
import { formatInr } from "@/lib/billing/razorpay-checkout";
import { cn } from "@/lib/utils";
import { FEATURE_KEYS, LIMIT_KEYS, finalPriceInr, type Addon, type Plan } from "@/lib/billing/types";
import { PaymentsCard, type PaymentsInfo } from "./payments-card";

interface PlatformSettings {
  billing_enabled: boolean;
  trial_days: number;
  grace_days: number;
  gst_percent: number;
  prices_include_gst?: boolean;
}

interface AdminOverview {
  settings: PlatformSettings;
  plans: Plan[];
  addons: Addon[];
  metrics: { total: number; trialing: number; active: number; past_due: number; lapsed: number; mrr_inr: number };
  razorpay_configured: boolean;
  razorpay_webhook_configured: boolean;
  payments: PaymentsInfo;
}

/** Loads /api/admin/settings (settings, plans, add-ons, payment config). */
function useAdminSettings() {
  const t = useTranslations("Admin");
  const [data, setData] = useState<AdminOverview | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as AdminOverview);
    } catch (err) {
      console.error("[admin settings] load error:", err);
      toast.error(t("loadFailed"));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, load };
}

function Loading() {
  const t = useTranslations("Admin");
  return (
    <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> {t("loading")}
    </div>
  );
}

/** Owner console → Settings: billing switches, GST, Razorpay keys. */
export function AdminSettingsView() {
  const { data, load } = useAdminSettings();
  if (!data) return <Loading />;
  return (
    <div className="space-y-8">
      <PlatformSettingsCard data={data} onSaved={load} />
      <PaymentsCard info={data.payments} onSaved={load} />
    </div>
  );
}

/** Owner console → Plans: prices, limits and features per plan. */
export function AdminPlansView() {
  const { data, load } = useAdminSettings();
  if (!data) return <Loading />;
  return <PlansEditor plans={data.plans} onSaved={load} />;
}

/** Plans + add-ons catalogue for pickers elsewhere in the console. */
export function useAdminCatalog() {
  const { data } = useAdminSettings();
  return { plans: data?.plans ?? [], addons: data?.addons ?? [] };
}

function StatusDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      {ok ? <CheckCircle2 className="size-4 text-primary" /> : <XCircle className="size-4 text-destructive" />}
      {label}
    </span>
  );
}

/** Sample list price for the GST-treatment preview. */
const PRICE_TAX_EXAMPLE = 4999;

function PlatformSettingsCard({ data, onSaved }: { data: AdminOverview; onSaved: () => Promise<void> }) {
  const t = useTranslations("Admin.settings");
  const [form, setForm] = useState<PlatformSettings>(data.settings);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (form.billing_enabled && !data.settings.billing_enabled && !confirm(t("enableConfirm"))) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: form }),
      });
      if (!res.ok) toast.error(t("saveFailed"));
      else {
        toast.success(t("saved"));
        await onSaved();
      }
    } finally {
      setSaving(false);
    }
  }

  const num = (key: "trial_days" | "grace_days" | "gst_percent") => (
    <div className="space-y-1.5">
      <Label htmlFor={`ps-${key}`}>{t(key)}</Label>
      <Input
        id={`ps-${key}`}
        type="number"
        min={0}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: Number(e.target.value) }))}
      />
    </div>
  );

  return (
    <div>
      <SettingsPanelHead title={t("title")} description={t("description")} />
      <Card>
        <CardContent className="space-y-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium text-foreground">{t("billingEnabled")}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{t("billingEnabledHint")}</p>
            </div>
            <Switch
              checked={form.billing_enabled}
              onCheckedChange={(v) => setForm((f) => ({ ...f, billing_enabled: !!v }))}
              aria-label={t("billingEnabled")}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {num("trial_days")}
            {num("grace_days")}
            {num("gst_percent")}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">{t("priceTax")}</p>
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t("priceTax")}>
              {([false, true] as const).map((inclusive) => {
                const tax = { gstPercent: form.gst_percent, pricesIncludeGst: inclusive };
                const selected = (form.prices_include_gst === true) === inclusive;
                return (
                  <button
                    key={String(inclusive)}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setForm((f) => ({ ...f, prices_include_gst: inclusive }))}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors",
                      selected ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:bg-muted/40",
                    )}
                  >
                    <span className="block text-sm font-medium text-foreground">
                      {inclusive ? t("priceTaxInclusive") : t("priceTaxExclusive")}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {t("priceTaxExample", {
                        price: formatInr(PRICE_TAX_EXAMPLE),
                        charged: formatInr(finalPriceInr(PRICE_TAX_EXAMPLE, tax)),
                      })}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">{t("priceTaxHint")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <StatusDot ok={data.razorpay_configured} label={t("razorpayKeys")} />
            <StatusDot ok={data.razorpay_webhook_configured} label={t("razorpayWebhook")} />
            {!data.razorpay_configured ? (
              <a href="#payments" className="text-sm font-medium text-primary hover:underline">
                {t("configurePayments")}
              </a>
            ) : null}
          </div>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("save")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function PlansEditor({ plans, onSaved }: { plans: Plan[]; onSaved: () => Promise<void> }) {
  const t = useTranslations("Admin.plans");
  const tl = useTranslations("Billing.limits");
  const tf = useTranslations("Billing.features");
  const [draft, setDraft] = useState<Plan[]>(plans);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(plans), [plans]);

  const patch = (code: string, change: Partial<Plan>) =>
    setDraft((d) => d.map((p) => (p.code === code ? { ...p, ...change } : p)));

  const priceInput = (v: string): number | null => (v.trim() === "" ? null : Math.max(0, Math.floor(Number(v))));

  async function save() {
    setSaving(true);
    try {
      // Send every limit key: a missing key would read as "unlimited".
      const body = draft.map((p) => ({
        ...p,
        limits: Object.fromEntries(LIMIT_KEYS.map((k) => [k, p.limits[k] ?? null])),
      }));
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plans: body }),
      });
      if (!res.ok) toast.error(t("saveFailed"));
      else {
        toast.success(t("saved"));
        await onSaved();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <SettingsPanelHead
        title={t("title")}
        description={t("description")}
        action={
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("save")}
          </Button>
        }
      />
      <div className="grid gap-4 xl:grid-cols-2">
        {draft.map((p) => (
          <Card key={p.code}>
            <CardContent className="space-y-4 py-5">
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  className="max-w-48 font-semibold"
                  value={p.name}
                  onChange={(e) => patch(p.code, { name: e.target.value })}
                  aria-label={t("name")}
                />
                <code className="text-xs text-muted-foreground">{p.code}</code>
                <label className="ml-auto flex items-center gap-2 text-sm">
                  <Switch checked={p.is_public} onCheckedChange={(v) => patch(p.code, { is_public: !!v })} />
                  {t("public")}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={p.highlighted} onCheckedChange={(v) => patch(p.code, { highlighted: !!v })} />
                  {t("highlighted")}
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t("monthly")}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={p.price_inr_monthly ?? ""}
                    onChange={(e) => patch(p.code, { price_inr_monthly: priceInput(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("annual")}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={p.price_inr_annual ?? ""}
                    onChange={(e) => patch(p.code, { price_inr_annual: priceInput(e.target.value) })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {LIMIT_KEYS.map((k) => (
                  <div key={k} className="space-y-1">
                    <Label className="text-xs">{tl(k)}</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder={t("unlimited")}
                      value={p.limits[k] ?? ""}
                      onChange={(e) =>
                        patch(p.code, { limits: { ...p.limits, [k]: priceInput(e.target.value) } })
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-4">
                {FEATURE_KEYS.map((f) => (
                  <label key={f} className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={p.features[f] === true}
                      onCheckedChange={(v) => patch(p.code, { features: { ...p.features, [f]: !!v } })}
                    />
                    {tf(f)}
                  </label>
                ))}
              </div>
              {p.price_inr_monthly != null ? (
                <p className="text-xs text-muted-foreground">
                  {t("preview", { monthly: formatInr(p.price_inr_monthly) })}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t("priceChangeNote")}</p>
    </div>
  );
}
