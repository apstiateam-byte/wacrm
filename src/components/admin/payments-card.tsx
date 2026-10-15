"use client";

// ============================================================
// Platform admin → Payments (Razorpay).
//
// Enter the Razorpay Key ID, Key Secret and Webhook Secret. Secrets are
// sent once, stored encrypted server-side and never shown again — the
// fields stay blank afterwards ("saved — leave blank to keep").
// Environment variables, when set, take precedence and lock the form.
// ============================================================

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCircle2, Copy, Loader2, PlugZap, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsPanelHead } from "@/components/settings/settings-panel-head";

export interface PaymentsInfo {
  keys_source: "env" | "admin" | null;
  webhook_source: "env" | "admin" | null;
  key_id: string | null;
  mode: "live" | "test" | null;
}

const WEBHOOK_EVENTS = [
  "subscription.activated",
  "subscription.charged",
  "subscription.pending",
  "subscription.halted",
  "subscription.cancelled",
  "subscription.completed",
  "order.paid",
];

export function PaymentsCard({ info, onSaved }: { info: PaymentsInfo; onSaved: () => Promise<void> }) {
  const t = useTranslations("Admin.payments");
  const [keyId, setKeyId] = useState(info.keys_source === "admin" ? info.key_id ?? "" : "");
  const [keySecret, setKeySecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const fromEnv = info.keys_source === "env";
  const webhookUrl =
    typeof window !== "undefined" ? `${window.location.origin}/api/billing/webhook` : "/api/billing/webhook";

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payments: { key_id: keyId, key_secret: keySecret, webhook_secret: webhookSecret } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? t("saveFailed"));
        return;
      }
      toast.success(t("saved"));
      setKeySecret("");
      setWebhookSecret("");
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    try {
      // Test what's typed if both fields are filled, otherwise the saved keys.
      const body = keyId && keySecret ? { key_id: keyId, key_secret: keySecret } : {};
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (data.ok) toast.success(t("testOk"));
      else toast.error(t("testFailed", { error: data.error ?? "unknown" }));
    } finally {
      setTesting(false);
    }
  }

  async function clear() {
    if (!confirm(t("clearConfirm"))) return;
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payments: { clear: true } }),
    });
    if (res.ok) {
      setKeyId("");
      toast.success(t("cleared"));
      await onSaved();
    }
  }

  const status = (ok: boolean, label: string, source: string | null) => (
    <span className="inline-flex items-center gap-1.5 text-sm">
      {ok ? <CheckCircle2 className="size-4 text-primary" /> : <XCircle className="size-4 text-destructive" />}
      {label}
      {source ? <span className="text-xs text-muted-foreground">({source === "env" ? t("fromEnv") : t("fromAdmin")})</span> : null}
    </span>
  );

  return (
    <div id="payments" className="scroll-mt-20">
      <SettingsPanelHead
        title={t("title")}
        description={t("description")}
        action={
          info.mode ? (
            <Badge variant={info.mode === "live" ? "default" : "secondary"}>
              {info.mode === "live" ? t("modeLive") : t("modeTest")}
            </Badge>
          ) : null
        }
      />
      <Card>
        <CardContent className="space-y-5 py-5">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {status(info.keys_source !== null, t("apiKeys"), info.keys_source)}
            {status(info.webhook_source !== null, t("webhookSecret"), info.webhook_source)}
          </div>

          {fromEnv ? (
            <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{t("envLocked")}</p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rzp-key-id">{t("keyId")}</Label>
              <Input
                id="rzp-key-id"
                placeholder="rzp_test_xxxxxxxxxxxx"
                value={keyId}
                disabled={fromEnv}
                onChange={(e) => setKeyId(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rzp-key-secret">{t("keySecret")}</Label>
              <Input
                id="rzp-key-secret"
                type="password"
                placeholder={info.keys_source === "admin" ? t("savedKeep") : ""}
                value={keySecret}
                disabled={fromEnv}
                onChange={(e) => setKeySecret(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="rzp-webhook-secret">{t("webhookSecret")}</Label>
              <Input
                id="rzp-webhook-secret"
                type="password"
                placeholder={info.webhook_source === "admin" ? t("savedKeep") : t("webhookSecretHint")}
                value={webhookSecret}
                disabled={info.webhook_source === "env"}
                onChange={(e) => setWebhookSecret(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm">
            <p className="font-medium text-foreground">{t("webhookSetupTitle")}</p>
            <p className="mt-1 text-muted-foreground">{t("webhookSetupBody")}</p>
            <div className="mt-3 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md bg-background px-2.5 py-1.5 text-xs">{webhookUrl}</code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(webhookUrl);
                  toast.success(t("copied"));
                }}
              >
                <Copy className="size-3.5" /> {t("copy")}
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{t("events")}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {WEBHOOK_EVENTS.map((e) => (
                <code key={e} className="rounded bg-background px-1.5 py-0.5 text-[11px]">
                  {e}
                </code>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={saving || fromEnv}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("save")}
            </Button>
            <Button variant="outline" onClick={test} disabled={testing}>
              {testing ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" />}
              {t("test")}
            </Button>
            {info.keys_source === "admin" || info.webhook_source === "admin" ? (
              <Button variant="ghost" onClick={clear}>
                {t("clear")}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
