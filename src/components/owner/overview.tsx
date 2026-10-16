"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { BarChart } from "@/components/tremor/bar-chart";
import { formatInr } from "@/lib/billing/razorpay-checkout";
import type { CustomerStatus, OverviewMetrics } from "@/lib/admin/metrics";
import {
  CustomerLink,
  DataTable,
  EmptyState,
  fmtCount,
  fmtDate,
  fmtPaise,
  fmtRelative,
  LoadingBlock,
  PageHeader,
  Panel,
  StatCard,
  StatusPill,
  Td,
  Th,
} from "./ui";

interface Labelled {
  account_id: string;
  account_name: string;
  owner_email: string | null;
}

interface OverviewData {
  metrics: OverviewMetrics;
  revenue_by_month: { month: string; revenue: number }[];
  signups_by_month: { month: string; signups: number }[];
  plan_mix: { plan: string; customers: number; mrr: number }[];
  failed_events: number;
  trials_ending: (Labelled & { plan_name: string; trial_ends_at: string })[];
  past_due: (Labelled & { plan_name: string; current_period_end: string | null })[];
  recent_signups: (Labelled & { created_at: string; status: CustomerStatus; plan_name: string | null })[];
  recent_payments: (Labelled & {
    id: string;
    provider_payment_id: string;
    amount_paise: number;
    status: string;
    plan_name: string | null;
    paid_at: string;
  })[];
}

const monthLabel = (ym: string) =>
  new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });

const compactInr = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 }).format(v);

export function OwnerOverview() {
  const [data, setData] = useState<OverviewData | null>(null);

  useEffect(() => {
    fetch("/api/admin/overview", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setData)
      .catch((err) => {
        console.error("[owner overview]", err);
        toast.error("Couldn't load the overview.");
      });
  }, []);

  if (!data) return <LoadingBlock />;
  const m = data.metrics;
  const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" description="Revenue, customers and what needs your attention. Demo workspace excluded." />

      {data.failed_events > 0 ? (
        <Link
          href="/admin/events?status=failed"
          className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive hover:bg-destructive/10"
        >
          <AlertTriangle className="size-4 shrink-0" />
          <span className="flex-1">
            {data.failed_events} Razorpay webhook {data.failed_events === 1 ? "event" : "events"} failed to process — a
            payment may not have activated a plan.
          </span>
          <ArrowRight className="size-4" />
        </Link>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="MRR" value={formatInr(m.mrr_inr)} hint={`ARR ${formatInr(m.arr_inr)} · excl. GST`} tone="good" />
        <StatCard label="Paying customers" value={fmtCount(m.paying + m.past_due)} hint={`ARPA ${formatInr(m.arpa_inr)}/mo`} />
        <StatCard label="Collected (last 30 days)" value={formatInr(m.revenue_30d_inr)} hint={`This month ${formatInr(m.revenue_mtd_inr)}`} />
        <StatCard label="Lifetime revenue" value={formatInr(m.revenue_total_inr)} hint="Incl. GST, captured payments" />
        <StatCard label="Active trials" value={fmtCount(m.trialing)} hint={`${fmtCount(data.trials_ending.length)} ending within 7 days`} />
        <StatCard label="Trial → paid" value={pct(m.trial_conversion)} hint="Of trials that have ended" />
        <StatCard
          label="Past due"
          value={fmtCount(m.past_due)}
          hint="Renewal payment failed"
          tone={m.past_due > 0 ? "warn" : "default"}
        />
        <StatCard
          label="Customers"
          value={fmtCount(m.customers)}
          hint={`+${fmtCount(m.signups_30d)} in 30 days · ${fmtCount(m.churned + m.trial_expired)} lapsed`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Revenue collected" description="Captured payments per month, incl. GST">
          <BarChart
            data={data.revenue_by_month.map((r) => ({ month: monthLabel(r.month), Revenue: r.revenue }))}
            index="month"
            categories={["Revenue"]}
            colors={["primary"]}
            valueFormatter={compactInr}
            showLegend={false}
            yAxisWidth={56}
            className="h-56"
          />
        </Panel>
        <Panel title="New signups" description="Workspaces created per month">
          <BarChart
            data={data.signups_by_month.map((r) => ({ month: monthLabel(r.month), Signups: r.signups }))}
            index="month"
            categories={["Signups"]}
            colors={["emerald"]}
            valueFormatter={(v) => fmtCount(v)}
            allowDecimals={false}
            showLegend={false}
            yAxisWidth={40}
            className="h-56"
          />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Plan mix" description="Paying customers by plan" flush>
          {data.plan_mix.length === 0 ? (
            <EmptyState>No paying customers yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {data.plan_mix.map((p) => {
                const share = m.mrr_inr ? p.mrr / m.mrr_inr : 0;
                return (
                  <li key={p.plan} className="px-5 py-3">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium text-foreground">{p.plan}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {fmtCount(p.customers)} · {formatInr(p.mrr)}/mo
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(share * 100)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel
          title="Trials ending soon"
          description="Next 7 days — good time to reach out"
          className="lg:col-span-2"
          flush
          action={
            <Link href="/admin/customers?status=trialing" className="text-xs font-medium text-primary hover:underline">
              All trials
            </Link>
          }
        >
          {data.trials_ending.length === 0 ? (
            <EmptyState>No trials end in the next 7 days.</EmptyState>
          ) : (
            <DataTable minWidth={460} head={<><Th>Customer</Th><Th>Plan</Th><Th>Ends</Th></>}>
              {data.trials_ending.map((r) => (
                <tr key={r.account_id}>
                  <Td><CustomerLink id={r.account_id} name={r.account_name} email={r.owner_email} /></Td>
                  <Td>{r.plan_name}</Td>
                  <Td className="whitespace-nowrap">
                    {fmtDate(r.trial_ends_at)} <span className="text-xs text-muted-foreground">({fmtRelative(r.trial_ends_at)})</span>
                  </Td>
                </tr>
              ))}
            </DataTable>
          )}
        </Panel>
      </div>

      {data.past_due.length > 0 ? (
        <Panel title="Failed renewals" description="Razorpay is retrying these charges — the customer may need to update their payment method" flush>
          <DataTable minWidth={460} head={<><Th>Customer</Th><Th>Plan</Th><Th>Period ended</Th></>}>
            {data.past_due.map((r) => (
              <tr key={r.account_id}>
                <Td><CustomerLink id={r.account_id} name={r.account_name} email={r.owner_email} /></Td>
                <Td>{r.plan_name}</Td>
                <Td>{fmtDate(r.current_period_end)}</Td>
              </tr>
            ))}
          </DataTable>
        </Panel>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Recent payments"
          flush
          action={<Link href="/admin/payments" className="text-xs font-medium text-primary hover:underline">View all</Link>}
        >
          {data.recent_payments.length === 0 ? (
            <EmptyState>No payments yet.</EmptyState>
          ) : (
            <DataTable minWidth={480} head={<><Th>Customer</Th><Th>Amount</Th><Th>Status</Th><Th>Date</Th></>}>
              {data.recent_payments.map((p) => (
                <tr key={p.id}>
                  <Td><CustomerLink id={p.account_id} name={p.account_name} email={p.plan_name} /></Td>
                  <Td className="font-medium tabular-nums">{fmtPaise(p.amount_paise)}</Td>
                  <Td><StatusPill status={p.status} /></Td>
                  <Td className="whitespace-nowrap text-muted-foreground">{fmtDate(p.paid_at)}</Td>
                </tr>
              ))}
            </DataTable>
          )}
        </Panel>
        <Panel
          title="Newest customers"
          flush
          action={<Link href="/admin/customers" className="text-xs font-medium text-primary hover:underline">View all</Link>}
        >
          {data.recent_signups.length === 0 ? (
            <EmptyState>No signups yet.</EmptyState>
          ) : (
            <DataTable minWidth={480} head={<><Th>Customer</Th><Th>Status</Th><Th>Signed up</Th></>}>
              {data.recent_signups.map((r) => (
                <tr key={r.account_id}>
                  <Td><CustomerLink id={r.account_id} name={r.account_name} email={r.owner_email} /></Td>
                  <Td><StatusPill status={r.status} /></Td>
                  <Td className="whitespace-nowrap text-muted-foreground">{fmtRelative(r.created_at)}</Td>
                </tr>
              ))}
            </DataTable>
          )}
        </Panel>
      </div>
    </div>
  );
}
