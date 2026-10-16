"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, ExternalLink, Search } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatInr } from "@/lib/billing/razorpay-checkout";
import { cn } from "@/lib/utils";
import {
  CustomerLink,
  DataTable,
  EmptyState,
  fmtCount,
  fmtDateTime,
  fmtPaise,
  LoadingBlock,
  PageHeader,
  Pagination,
  SELECT_CLASS,
  StatCard,
  StatusPill,
  Td,
  Th,
} from "./ui";

interface PaymentItem {
  id: string;
  account_id: string;
  account_name: string;
  owner_email: string | null;
  provider_payment_id: string;
  provider_invoice_id: string | null;
  plan_code: string | null;
  billing_interval: string | null;
  amount_paise: number;
  currency: string;
  status: string;
  invoice_url: string | null;
  paid_at: string | null;
  created_at: string;
}

interface PaymentsResponse {
  payments: PaymentItem[];
  total: number;
  page_size: number;
  summary: { count: number; collected_inr: number; failed: number; refunded: number };
}

const STATUSES: [string, string][] = [
  ["", "All statuses"],
  ["captured", "Captured"],
  ["failed", "Failed"],
  ["refunded", "Refunded"],
];

export function PaymentsList() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [data, setData] = useState<PaymentsResponse | null>(null);
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
    const id = setTimeout(() => {
      if ((params.get("q") ?? "") !== query.trim()) setParam({ q: query.trim() });
    }, 300);
    return () => clearTimeout(id);
  }, [query, params, setParam]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/payments?${params.toString()}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => !cancelled && setData(d))
      .catch((err) => console.error("[owner payments]", err));
    return () => {
      cancelled = true;
    };
  }, [params]);

  const csvParams = new URLSearchParams(params.toString());
  csvParams.delete("page");
  csvParams.set("format", "csv");

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Every Razorpay payment from every customer."
        actions={
          <a href={`/api/admin/payments?${csvParams.toString()}`} className={cn(buttonVariants({ variant: "outline" }))}>
            <Download className="size-4" /> Export CSV
          </a>
        }
      />

      {data ? (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Collected (filtered)" value={formatInr(data.summary.collected_inr)} hint="Incl. GST" tone="good" />
          <StatCard label="Payments" value={fmtCount(data.summary.count)} />
          <StatCard label="Failed" value={fmtCount(data.summary.failed)} tone={data.summary.failed ? "bad" : "default"} />
          <StatCard label="Refunded" value={fmtCount(data.summary.refunded)} tone={data.summary.refunded ? "warn" : "default"} />
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="pay_… or workspace / email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search payments"
          />
        </div>
        <select
          className={SELECT_CLASS}
          value={params.get("status") ?? ""}
          onChange={(e) => setParam({ status: e.target.value })}
          aria-label="Status"
        >
          {STATUSES.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          From
          <input type="date" className={SELECT_CLASS} value={params.get("from") ?? ""} onChange={(e) => setParam({ from: e.target.value })} />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          To
          <input type="date" className={SELECT_CLASS} value={params.get("to") ?? ""} onChange={(e) => setParam({ to: e.target.value })} />
        </label>
      </div>

      <Card className="overflow-hidden p-0">
        {!data ? (
          <LoadingBlock />
        ) : data.payments.length === 0 ? (
          <EmptyState>No payments match these filters.</EmptyState>
        ) : (
          <DataTable
            minWidth={900}
            head={
              <>
                <Th>Date</Th>
                <Th>Customer</Th>
                <Th>Payment ID</Th>
                <Th>Plan</Th>
                <Th className="text-right">Amount</Th>
                <Th>Status</Th>
                <Th />
              </>
            }
          >
            {data.payments.map((p) => (
              <tr key={p.id}>
                <Td className="whitespace-nowrap text-muted-foreground">{fmtDateTime(p.paid_at ?? p.created_at)}</Td>
                <Td className="max-w-56">
                  <CustomerLink id={p.account_id} name={p.account_name} email={p.owner_email} />
                </Td>
                <Td>
                  <a
                    href={`https://dashboard.razorpay.com/app/payments/${p.provider_payment_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-xs hover:text-primary"
                  >
                    {p.provider_payment_id} <ExternalLink className="size-3" />
                  </a>
                </Td>
                <Td>
                  {p.plan_code ?? "Add-on"}
                  {p.billing_interval ? <span className="block text-xs text-muted-foreground capitalize">{p.billing_interval}</span> : null}
                </Td>
                <Td className="text-right font-medium tabular-nums">{fmtPaise(p.amount_paise)}</Td>
                <Td><StatusPill status={p.status} /></Td>
                <Td className="text-right">
                  {p.invoice_url ? (
                    <a href={p.invoice_url} target="_blank" rel="noreferrer" className="text-xs font-medium text-primary hover:underline">
                      Invoice
                    </a>
                  ) : null}
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
        {data ? <Pagination page={page} pageSize={data.page_size} total={data.total} onPage={(p) => setParam({ page: String(p) })} /> : null}
      </Card>
    </div>
  );
}
