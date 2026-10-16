"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatInr } from "@/lib/billing/razorpay-checkout";
import type { AdminAccountRow } from "@/app/api/admin/accounts/route";
import { useAdminCatalog } from "@/components/admin/admin-console";
import {
  CustomerLink,
  DataTable,
  EmptyState,
  fmtCount,
  fmtDate,
  LoadingBlock,
  PageHeader,
  Pagination,
  SELECT_CLASS,
  StatusPill,
  Td,
  Th,
} from "./ui";

const STATUS_FILTERS: [string, string][] = [
  ["", "All customers"],
  ["active", "Paying"],
  ["trialing", "In trial"],
  ["trial_expired", "Trial expired"],
  ["past_due", "Past due"],
  ["canceled", "Canceled"],
  ["expired", "Churned"],
  ["suspended", "Suspended"],
  ["demo", "Demo"],
];

const SORTS: [string, string][] = [
  ["newest", "Newest first"],
  ["oldest", "Oldest first"],
  ["mrr", "Highest MRR"],
  ["name", "Name A–Z"],
];

export function CustomersList() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { plans } = useAdminCatalog();

  const [query, setQuery] = useState(params.get("q") ?? "");
  const status = params.get("status") ?? "";
  const plan = params.get("plan") ?? "";
  const sort = params.get("sort") ?? "newest";
  const page = Number(params.get("page") ?? 0) || 0;

  const [rows, setRows] = useState<AdminAccountRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(25);

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

  // Debounce the search box into the URL.
  useEffect(() => {
    const id = setTimeout(() => {
      if ((params.get("q") ?? "") !== query.trim()) setParam({ q: query.trim() });
    }, 300);
    return () => clearTimeout(id);
  }, [query, params, setParam]);

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams({ q: params.get("q") ?? "", status, plan, sort, page: String(page) });
    fetch(`/api/admin/accounts?${qs.toString()}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        if (cancelled) return;
        setRows(data.accounts);
        setTotal(data.total);
        setPageSize(data.page_size);
      })
      .catch((err) => console.error("[owner customers]", err));
    return () => {
      cancelled = true;
    };
  }, [params, status, plan, sort, page]);

  return (
    <div>
      <PageHeader title="Customers" description={`${fmtCount(total)} workspaces match.`} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search workspace or owner email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search customers"
          />
        </div>
        <select className={SELECT_CLASS} value={status} onChange={(e) => setParam({ status: e.target.value })} aria-label="Status">
          {STATUS_FILTERS.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select className={SELECT_CLASS} value={plan} onChange={(e) => setParam({ plan: e.target.value })} aria-label="Plan">
          <option value="">All plans</option>
          {plans.map((p) => (
            <option key={p.code} value={p.code}>{p.name}</option>
          ))}
        </select>
        <select className={SELECT_CLASS} value={sort} onChange={(e) => setParam({ sort: e.target.value })} aria-label="Sort">
          {SORTS.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      <Card className="overflow-hidden p-0">
        {rows === null ? (
          <LoadingBlock />
        ) : rows.length === 0 ? (
          <EmptyState>No customers match these filters.</EmptyState>
        ) : (
          <DataTable
            minWidth={960}
            head={
              <>
                <Th>Customer</Th>
                <Th>Plan</Th>
                <Th>Status</Th>
                <Th className="text-right">MRR</Th>
                <Th>Usage</Th>
                <Th>Renews / ends</Th>
                <Th>Signed up</Th>
              </>
            }
          >
            {rows.map((r) => {
              const sub = r.subscription;
              const ends = sub?.status === "trialing" ? sub.trial_ends_at : sub?.current_period_end;
              const usage = r.entitlements?.usage;
              return (
                <tr
                  key={r.id}
                  className="cursor-pointer transition-colors hover:bg-muted/40"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("a")) return;
                    router.push(`/admin/customers/${r.id}`);
                  }}
                >
                  <Td className="max-w-64">
                    <CustomerLink id={r.id} name={r.name} email={r.owner_email} />
                  </Td>
                  <Td>
                    {r.plan_name ?? "—"}
                    {sub?.billing_interval ? <span className="block text-xs text-muted-foreground capitalize">{sub.billing_interval}</span> : null}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {r.is_demo ? <StatusPill status="demo" /> : <StatusPill status={r.status} />}
                      {r.suspended_at ? <StatusPill status="suspended" /> : null}
                      {sub?.cancel_at_period_end && sub.billing_interval !== "annual" && r.status === "active" ? (
                        <StatusPill status="canceled" label="Cancels at period end" />
                      ) : null}
                    </div>
                  </Td>
                  <Td className="text-right font-medium tabular-nums">{r.mrr_inr ? formatInr(r.mrr_inr) : "—"}</Td>
                  <Td className="text-xs text-muted-foreground tabular-nums">
                    {fmtCount(r.members)} {r.members === 1 ? "member" : "members"}
                    <span className="block">{fmtCount(usage?.contacts ?? 0)} contacts</span>
                  </Td>
                  <Td className="whitespace-nowrap text-muted-foreground">{fmtDate(ends)}</Td>
                  <Td className="whitespace-nowrap text-muted-foreground">{fmtDate(r.created_at)}</Td>
                </tr>
              );
            })}
          </DataTable>
        )}
        <Pagination page={page} pageSize={pageSize} total={total} onPage={(p) => setParam({ page: String(p) })} />
      </Card>
    </div>
  );
}
