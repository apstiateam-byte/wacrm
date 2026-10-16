"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Card } from "@/components/ui/card";
import {
  EmptyState,
  fmtCount,
  fmtDateTime,
  LoadingBlock,
  PageHeader,
  Pagination,
  SELECT_CLASS,
  StatusPill,
} from "./ui";

interface EventItem {
  id: string;
  event_id: string;
  event_type: string;
  account_id: string | null;
  account_name: string | null;
  processed_at: string | null;
  error: string | null;
  created_at: string;
  payload: unknown;
}

const STATUSES: [string, string][] = [
  ["", "All events"],
  ["failed", "Failed"],
  ["pending", "Pending"],
  ["processed", "Processed"],
];

const TYPES = [
  "subscription.activated",
  "subscription.charged",
  "subscription.pending",
  "subscription.halted",
  "subscription.cancelled",
  "subscription.completed",
  "payment.captured",
  "payment.failed",
  "order.paid",
  "refund.processed",
];

export function EventsList() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [data, setData] = useState<{ events: EventItem[]; total: number; page_size: number } | null>(null);
  const page = Number(params.get("page") ?? 0) || 0;

  const setParam = useCallback(
    (changes: Record<string, string>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(changes)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      if (!("page" in changes)) next.delete("page");
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/events?${params.toString()}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => !cancelled && setData(d))
      .catch((err) => console.error("[owner events]", err));
    return () => {
      cancelled = true;
    };
  }, [params]);

  return (
    <div>
      <PageHeader
        title="Webhook events"
        description="Every Razorpay webhook received. A failed event means a payment or renewal may not have been applied — Razorpay retries failed deliveries automatically."
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select className={SELECT_CLASS} value={params.get("status") ?? ""} onChange={(e) => setParam({ status: e.target.value })} aria-label="Status">
          {STATUSES.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select className={SELECT_CLASS} value={params.get("type") ?? ""} onChange={(e) => setParam({ type: e.target.value })} aria-label="Event type">
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        {data ? <span className="text-sm text-muted-foreground">{fmtCount(data.total)} events</span> : null}
      </div>

      <Card className="overflow-hidden p-0">
        {!data ? (
          <LoadingBlock />
        ) : data.events.length === 0 ? (
          <EmptyState>No webhook events match.</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {data.events.map((e) => {
              const status = e.processed_at ? "processed" : e.error ? "failed" : "pending";
              return (
                <li key={e.id} className="px-5 py-3">
                  <details>
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span className="font-mono text-xs text-foreground">{e.event_type}</span>
                      <StatusPill status={status} />
                      {e.account_id ? (
                        <Link
                          href={`/admin/customers/${e.account_id}`}
                          className="text-sm text-muted-foreground hover:text-primary hover:underline"
                          onClick={(ev) => ev.stopPropagation()}
                        >
                          {e.account_name ?? e.account_id.slice(0, 8)}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">No workspace matched</span>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground">{fmtDateTime(e.created_at)}</span>
                    </summary>
                    <p className="mt-2 font-mono text-[11px] text-muted-foreground">Event ID {e.event_id}</p>
                    {e.error ? <p className="mt-1 text-xs text-destructive">{e.error}</p> : null}
                    <pre className="mt-2 max-h-80 overflow-auto rounded-md bg-muted p-3 text-[11px] leading-relaxed">
                      {JSON.stringify(e.payload, null, 2)}
                    </pre>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
        {data ? <Pagination page={page} pageSize={data.page_size} total={data.total} onPage={(p) => setParam({ page: String(p) })} /> : null}
      </Card>
    </div>
  );
}
