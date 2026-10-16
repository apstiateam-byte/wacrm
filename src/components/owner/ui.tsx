"use client";

// Small building blocks shared by the owner console pages.

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatInr } from "@/lib/billing/razorpay-checkout";
import type { CustomerStatus } from "@/lib/admin/metrics";

export function fmtDate(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }) : "—";
}

export function fmtDateTime(iso: string | null | undefined): string {
  return iso
    ? new Date(iso).toLocaleString("en-IN", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";
}

/** "3 days ago" / "in 5 days" style relative time. */
export function fmtRelative(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "—";
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [365 * 86_400_000, "year"],
    [30 * 86_400_000, "month"],
    [86_400_000, "day"],
    [3_600_000, "hour"],
    [60_000, "minute"],
  ];
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [ms, unit] of units) {
    if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return "just now";
}

export const fmtPaise = (paise: number) => formatInr(Math.round(paise) / 100);
export const fmtCount = (n: number) => new Intl.NumberFormat("en-IN").format(n);

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p
          className={cn(
            "mt-1.5 text-2xl font-semibold tabular-nums tracking-tight",
            tone === "good" && "text-emerald-700 dark:text-emerald-400",
            tone === "warn" && "text-amber-700 dark:text-amber-400",
            tone === "bad" && "text-destructive",
            tone === "default" && "text-foreground",
          )}
        >
          {value}
        </p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className,
  flush = false,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** No inner padding (tables). */
  flush?: boolean;
}) {
  return (
    <Card className={className}>
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3.5">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className={flush ? "" : "p-5"}>{children}</div>
    </Card>
  );
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  captured: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  processed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  connected: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  trialing: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
  pending: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
  past_due: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  trial_expired: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  refunded: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  canceled: "bg-muted text-muted-foreground",
  expired: "bg-muted text-muted-foreground",
  none: "bg-muted text-muted-foreground",
  disconnected: "bg-muted text-muted-foreground",
  demo: "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
  suspended: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
};

export const STATUS_LABELS: Record<CustomerStatus | string, string> = {
  active: "Paying",
  trialing: "Trial",
  trial_expired: "Trial expired",
  past_due: "Past due",
  canceled: "Canceled",
  expired: "Churned",
  none: "No plan",
  suspended: "Suspended",
  demo: "Demo",
  captured: "Captured",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
  pending: "Pending",
  processed: "Processed",
  connected: "Connected",
  disconnected: "Disconnected",
};

export function StatusPill({ status, label }: { status: string; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        STATUS_STYLES[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {label ?? STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function LoadingBlock() {
  return (
    <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> Loading…
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="px-5 py-8 text-center text-sm text-muted-foreground">{children}</p>;
}

/** Table wrapper: horizontal scroll on narrow screens, consistent cells. */
export function DataTable({ head, children, minWidth = 720 }: { head: ReactNode; children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth }}>
        <thead className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
          <tr>{head}</tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

export const Th = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <th className={cn("px-4 py-2.5 font-medium whitespace-nowrap", className)}>{children}</th>
);
export const Td = ({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) => (
  <td colSpan={colSpan} className={cn("px-4 py-3 align-top", className)}>
    {children}
  </td>
);

export function CustomerLink({ id, name, email }: { id: string; name: string; email?: string | null }) {
  return (
    <Link href={`/admin/customers/${id}`} className="group block min-w-0">
      <span className="block truncate font-medium text-foreground group-hover:text-primary group-hover:underline">{name}</span>
      {email ? <span className="block truncate text-xs text-muted-foreground">{email}</span> : null}
    </Link>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  if (total <= pageSize) return null;
  const pages = Math.ceil(total / pageSize);
  return (
    <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3 text-sm">
      <span className="text-muted-foreground">
        {fmtCount(page * pageSize + 1)}–{fmtCount(Math.min(total, (page + 1) * pageSize))} of {fmtCount(total)}
      </span>
      <div className="flex items-center gap-1">
        <Button size="icon-sm" variant="outline" aria-label="Previous page" disabled={page === 0} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="px-2 tabular-nums text-muted-foreground">
          {page + 1} / {pages}
        </span>
        <Button size="icon-sm" variant="outline" aria-label="Next page" disabled={page + 1 >= pages} onClick={() => onPage(page + 1)}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export const SELECT_CLASS =
  "h-9 rounded-md border border-border bg-background px-2.5 text-sm text-foreground focus:border-primary focus:outline-none";
