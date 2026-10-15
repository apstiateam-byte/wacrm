"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { LIMIT_KEYS, usageRatio, type Entitlements, type LimitKey } from "@/lib/billing/types";

/** Meters that matter on every plan; the rest only show when capped. */
const ALWAYS_SHOWN: readonly LimitKey[] = ["seats", "contacts", "broadcast_recipients_monthly"];

/**
 * Usage vs. limit bars for the current plan. Amber from 80%, red at
 * 100%, "Unlimited" when the plan has no cap.
 */
export function UsageMeters({ entitlements }: { entitlements: Entitlements }) {
  const t = useTranslations("Billing.limits");
  const tm = useTranslations("Billing.meters");
  const fmt = new Intl.NumberFormat();

  const keys = LIMIT_KEYS.filter(
    (k) => ALWAYS_SHOWN.includes(k) || entitlements.limits[k] != null,
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {keys.map((key) => {
        const used = entitlements.usage[key] ?? 0;
        const limit = entitlements.limits[key];
        const ratio = usageRatio(used, limit);
        const tone =
          ratio == null ? "bg-primary/40" : ratio >= 1 ? "bg-destructive" : ratio >= 0.8 ? "bg-amber-500" : "bg-primary";
        return (
          <div key={key} className="min-w-0">
            <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate text-foreground">{t(key)}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {limit == null
                  ? tm("usedUnlimited", { used: fmt.format(used) })
                  : tm("usedOf", { used: fmt.format(used), limit: fmt.format(limit) })}
              </span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label={t(key)}
              aria-valuemin={0}
              aria-valuemax={limit ?? undefined}
              aria-valuenow={used}
            >
              <div
                className={cn("h-full rounded-full transition-[width]", tone)}
                style={{ width: `${ratio == null ? 100 : Math.max(ratio * 100, used > 0 ? 2 : 0)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
