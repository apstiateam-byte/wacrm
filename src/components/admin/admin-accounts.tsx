"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { SettingsPanelHead } from "@/components/settings/settings-panel-head";
import { isReadOnlyState, LIMIT_KEYS, type Addon, type BillingState, type Plan } from "@/lib/billing/types";
import type { AdminAccountRow } from "@/app/api/admin/accounts/route";

const SELECT_CLASS =
  "w-full rounded-md border border-border bg-muted px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none";
const STATUSES = ["trialing", "active", "past_due", "canceled", "expired"] as const;

function fmtDate(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";
}

/** ISO → value for <input type="date">. */
function toDateInput(iso: string | null | undefined): string {
  return iso ? new Date(iso).toISOString().slice(0, 10) : "";
}

export function AdminAccounts({ plans, addons }: { plans: Plan[]; addons: Addon[] }) {
  const t = useTranslations("Admin.accounts");
  const tState = useTranslations("Billing.states");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<AdminAccountRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminAccountRow | null>(null);

  const load = useCallback(async (q: string, p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/accounts?q=${encodeURIComponent(q)}&page=${p}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setRows(data.accounts);
        setTotal(data.total);
        setPageSize(data.page_size);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => void load(query, page), 250);
    return () => clearTimeout(id);
  }, [query, page, load]);

  const planName = (code: string | undefined) => plans.find((p) => p.code === code)?.name ?? code ?? "—";

  return (
    <div>
      <SettingsPanelHead title={t("title")} description={t("description", { count: total })} />
      <div className="relative mb-3 max-w-sm">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder={t("search")}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
        />
      </div>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">{t("workspace")}</th>
                <th className="px-4 py-2.5 font-medium">{t("plan")}</th>
                <th className="px-4 py-2.5 font-medium">{t("status")}</th>
                <th className="px-4 py-2.5 font-medium">{t("renewsOrEnds")}</th>
                <th className="px-4 py-2.5 font-medium">{t("usage")}</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    <Loader2 className="mx-auto size-4 animate-spin" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    {t("empty")}
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const state = (r.entitlements?.state ?? "unlimited") as BillingState;
                  const ends = r.subscription?.status === "trialing" ? r.subscription.trial_ends_at : r.subscription?.current_period_end;
                  return (
                    <tr key={r.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">
                          {r.name}
                          {r.is_demo ? (
                            <Badge variant="outline" className="ml-2">
                              {t("demo")}
                            </Badge>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {r.owner_email ?? "—"} · {t("since", { date: fmtDate(r.created_at) })}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {planName(r.subscription?.plan_code)}
                        {r.subscription?.billing_interval ? (
                          <span className="text-xs text-muted-foreground"> · {r.subscription.billing_interval}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={isReadOnlyState(state) || state === "past_due" ? "destructive" : "secondary"}>
                          {tState(state)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(ends)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                        {t("usageLine", {
                          seats: r.entitlements?.usage.seats ?? 0,
                          contacts: r.entitlements?.usage.contacts ?? 0,
                        })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="outline" onClick={() => setEditing(r)}>
                          {t("manage")}
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
      {total > pageSize ? (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            {t("prev")}
          </Button>
          <span className="text-muted-foreground">
            {t("pageOf", { page: page + 1, pages: Math.ceil(total / pageSize) })}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={(page + 1) * pageSize >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            {t("next")}
          </Button>
        </div>
      ) : null}

      {editing ? (
        <ManageAccountDialog
          row={editing}
          plans={plans}
          addons={addons}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load(query, page);
          }}
        />
      ) : null}
    </div>
  );
}

function ManageAccountDialog({
  row,
  plans,
  addons,
  onClose,
  onSaved,
}: {
  row: AdminAccountRow;
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
