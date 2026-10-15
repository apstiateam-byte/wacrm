"use client";

// ============================================================
// "Get started" checklist on the dashboard.
//
// Five setup milestones, each derived from data that already exists
// (no new tables): WhatsApp connected, a template, contacts, a teammate,
// a first broadcast. Hides itself once everything is done or when the
// user dismisses it (remembered per browser).
// ============================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CheckCircle2, Circle, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const DISMISS_KEY = "wacrm.onboarding.dismissed";

type StepId = "whatsapp" | "template" | "contacts" | "team" | "broadcast";

const STEPS: { id: StepId; href: string }[] = [
  { id: "whatsapp", href: "/settings?tab=whatsapp" },
  { id: "template", href: "/settings?tab=templates" },
  { id: "contacts", href: "/contacts" },
  { id: "team", href: "/settings?tab=members" },
  { id: "broadcast", href: "/broadcasts/new" },
];

function readDismissed(accountId: string | null): boolean {
  if (!accountId) return false;
  try {
    return window.localStorage.getItem(`${DISMISS_KEY}.${accountId}`) === "1";
  } catch {
    return false;
  }
}

export function OnboardingChecklist() {
  const t = useTranslations("Dashboard.onboarding");
  const { accountId } = useAuth();
  const [done, setDone] = useState<Record<StepId, boolean> | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    const supabase = createClient();
    const count = (table: string) =>
      supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId)
        .then(({ count: c }) => c ?? 0);

    Promise.all([
      count("whatsapp_config"),
      count("message_templates"),
      count("contacts"),
      count("profiles"),
      count("broadcasts"),
    ]).then(([wa, templates, contacts, members, broadcasts]) => {
      if (cancelled) return;
      setDismissed(readDismissed(accountId));
      setDone({
        whatsapp: wa > 0,
        template: templates > 0,
        contacts: contacts > 0,
        team: members > 1,
        broadcast: broadcasts > 0,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  if (!done || dismissed) return null;
  const completed = STEPS.filter((s) => done[s.id]).length;
  if (completed === STEPS.length) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(`${DISMISS_KEY}.${accountId}`, "1");
    } catch {
      // Storage blocked — it simply reappears next visit.
    }
  };

  return (
    <section className="rounded-xl border border-primary/30 bg-primary/5 p-5" aria-labelledby="onboarding-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="onboarding-title" className="font-semibold text-foreground">
            {t("title")}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("progress", { done: completed, total: STEPS.length })}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("dismiss")}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(completed / STEPS.length) * 100}%` }} />
      </div>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {STEPS.map((step) => {
          const isDone = done[step.id];
          return (
            <li key={step.id}>
              <Link
                href={step.href}
                className={cn(
                  "flex h-full items-start gap-2 rounded-lg border bg-background p-3 text-sm transition-colors hover:border-primary/50",
                  isDone ? "border-border text-muted-foreground" : "border-border text-foreground",
                )}
              >
                {isDone ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                ) : (
                  <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                )}
                <span>
                  <span className={cn("block font-medium", isDone && "line-through")}>{t(`steps.${step.id}.title`)}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{t(`steps.${step.id}.body`)}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
