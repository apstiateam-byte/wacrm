"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, ExternalLink, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ManageAccountDialog } from "@/components/admin/admin-accounts";
import { useAdminCatalog } from "@/components/admin/admin-console";
import { formatInr } from "@/lib/billing/razorpay-checkout";
import { LIMIT_KEYS, FEATURE_KEYS, type Entitlements, type LimitKey } from "@/lib/billing/types";
import type { CustomerStatus } from "@/lib/admin/metrics";
import { cn } from "@/lib/utils";
import {
  DataTable,
  EmptyState,
  fmtCount,
  fmtDate,
  fmtDateTime,
  fmtPaise,
  fmtRelative,
  LoadingBlock,
  Panel,
  StatCard,
  StatusPill,
  Td,
  Th,
} from "./ui";

interface CustomerDetailData {
  account: {
    id: string;
    name: string;
    owner_user_id: string;
    created_at: string;
    suspended_at: string | null;
    is_demo: boolean;
    limit_overrides: { limits?: Record<string, number | null>; features?: Record<string, boolean> } | null;
    billing_name: string | null;
    billing_email: string | null;
    billing_gstin: string | null;
    billing_address: string | null;
    billing_state: string | null;
  };
  subscription: {
    plan_code: string;
    plan_name: string;
    status: string;
    status_bucket: CustomerStatus;
    billing_interval: string | null;
    trial_ends_at: string | null;
    current_period_start: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    provider: string | null;
    provider_subscription_id: string | null;
    pending_plan_code: string | null;
    pending_interval: string | null;
    mrr_inr: number;
  } | null;
  addons: { addon_code: string; quantity: number; cancel_at_period_end: boolean; provider_subscription_id: string | null }[];
  entitlements: Entitlements | null;
  team: {
    user_id: string;
    full_name: string;
    email: string;
    role: string;
    is_owner: boolean;
    joined_at: string;
    last_sign_in_at: string | null;
  }[];
  whatsapp: { phone_number_id: string; waba_id: string | null; status: string; connected_at: string | null } | null;
  counts: Record<string, number>;
  last_activity_at: string | null;
  payments: {
    id: string;
    provider_payment_id: string;
    provider_invoice_id: string | null;
    plan_code: string | null;
    billing_interval: string | null;
    amount_paise: number;
    status: string;
    invoice_url: string | null;
    paid_at: string | null;
    created_at: string;
  }[];
  lifetime_value_paise: number;
  events: {
    id: string;
    event_type: string;
    event_id: string;
    processed_at: string | null;
    error: string | null;
    created_at: string;
    payload: unknown;
  }[];
}

const LIMIT_LABELS: Record<LimitKey, string> = {
  seats: "Team seats",
  contacts: "Contacts",
  broadcast_recipients_monthly: "Broadcast recipients / month",
  pipelines: "Pipelines",
  automations: "Automations",
  flows: "Chatbot flows",
  api_keys: "API keys",
  webhook_endpoints: "Webhook endpoints",
};
const FEATURE_LABELS: Record<string, string> = { flows: "Chatbot flows", ai: "AI replies & agents", api: "Public API & webhooks" };
const COUNT_LABELS: [string, string][] = [
  ["contacts", "Contacts"],
  ["conversations", "Conversations"],
  ["deals", "Deals"],
  ["broadcasts", "Broadcasts"],
  ["automations", "Automations"],
  ["flows", "Chatbot flows"],
  ["message_templates", "Templates"],
];

function eventStatus(e: { processed_at: string | null; error: string | null }) {
  return e.processed_at ? "processed" : e.error ? "failed" : "pending";
}

function razorpayUrl(id: string | null | undefined): string | null {
  if (!id) return null;
  if (id.startsWith("sub_")) return `https://dashboard.razorpay.com/app/subscriptions/${id}`;
  if (id.startsWith("pay_")) return `https://dashboard.razorpay.com/app/payments/${id}`;
  if (id.startsWith("order:order_")) return `https://dashboard.razorpay.com/app/orders/${id.slice(6)}`;
  return null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right break-words text-foreground">{children ?? "—"}</dd>
    </div>
  );
}

function ExtId({ id }: { id: string | null | undefined }) {
  if (!id) return <>—</>;
  const href = razorpayUrl(id);
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs">
      {id}
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" aria-label="Open in Razorpay" className="text-muted-foreground hover:text-primary">
          <ExternalLink className="size-3.5" />
        </a>
      ) : null}
    </span>
  );
}

export function CustomerDetail({ id }: { id: string }) {
  const [data, setData] = useState<CustomerDetailData | null>(null);
  const [missing, setMissing] = useState(false);
  const [managing, setManaging] = useState(false);
  const { plans, addons } = useAdminCatalog();

  // Bumped after a save to reload.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/accounts/${id}`, { cache: "no-store" })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) setMissing(true);
        else if (!res.ok) toast.error("Couldn't load this customer.");
        else setData(await res.json());
      })
      .catch(() => toast.error("Couldn't load this customer."));
    return () => {
      cancelled = true;
    };
  }, [id, version]);

  if (missing) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Customer not found. <Link href="/admin/customers" className="text-primary hover:underline">Back to customers</Link>
      </div>
    );
  }
  if (!data) return <LoadingBlock />;

  const { account, subscription: sub, entitlements: ent } = data;
  const owner = data.team.find((m) => m.is_owner);
  const overrideLimits = account.limit_overrides?.limits ?? {};
  const status = sub?.status_bucket ?? "none";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/customers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Customers
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">{account.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {account.is_demo ? <StatusPill status="demo" /> : <StatusPill status={status} />}
              {account.suspended_at ? <StatusPill status="suspended" /> : null}
              <span>{owner ? `${owner.full_name} · ${owner.email}` : "No owner"}</span>
            </div>
          </div>
          <Button onClick={() => setManaging(true)} disabled={!plans.length}>
            <Settings2 className="size-4" /> Manage subscription
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Plan" value={sub?.plan_name ?? "—"} hint={sub?.billing_interval ? `Billed ${sub.billing_interval}` : undefined} />
        <StatCard label="MRR" value={sub?.mrr_inr ? formatInr(sub.mrr_inr) : "—"} hint="Excl. GST" />
        <StatCard label="Lifetime value" value={fmtPaise(data.lifetime_value_paise)} hint={`${fmtCount(data.payments.length)} payments`} />
        <StatCard label="Customer since" value={fmtDate(account.created_at)} hint={fmtRelative(account.created_at)} />
        <StatCard label="Last conversation" value={data.last_activity_at ? fmtRelative(data.last_activity_at) : "—"} hint={fmtDateTime(data.last_activity_at)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel title="Subscription">
            {sub ? (
              <dl className="grid gap-x-8 divide-y divide-border sm:grid-cols-2 sm:divide-y-0">
                <div className="divide-y divide-border">
                  <Field label="Status"><StatusPill status={status} /></Field>
                  <Field label="Plan">{sub.plan_name}</Field>
                  <Field label="Billing">{sub.billing_interval ? <span className="capitalize">{sub.billing_interval}</span> : "—"}</Field>
                  <Field label="Trial ends">{fmtDate(sub.trial_ends_at)}</Field>
                  {sub.pending_plan_code ? (
                    <Field label="Checkout started">
                      {sub.pending_plan_code} · {sub.pending_interval}
                    </Field>
                  ) : null}
                </div>
                <div className="divide-y divide-border">
                  <Field label="Current period">
                    {sub.current_period_start ? `${fmtDate(sub.current_period_start)} – ${fmtDate(sub.current_period_end)}` : fmtDate(sub.current_period_end)}
                  </Field>
                  <Field label="Auto-renew">{sub.cancel_at_period_end ? "No — ends at period end" : sub.provider === "razorpay" ? "Yes" : "—"}</Field>
                  <Field label="Managed by"><span className="capitalize">{sub.provider ?? "—"}</span></Field>
                  <Field label="Razorpay ID"><ExtId id={sub.provider_subscription_id} /></Field>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">No subscription row — billing treats this workspace as unlimited.</p>
            )}
            {data.addons.length ? (
              <div className="mt-4 border-t border-border pt-4">
                <p className="mb-2 text-xs font-medium text-muted-foreground uppercase">Add-ons</p>
                <ul className="space-y-1 text-sm">
                  {data.addons.map((a) => (
                    <li key={a.addon_code} className="flex items-center justify-between gap-2">
                      <span>
                        {addons.find((x) => x.code === a.addon_code)?.name ?? a.addon_code} × {a.quantity}
                        {a.cancel_at_period_end ? <span className="text-xs text-muted-foreground"> · ending</span> : null}
                      </span>
                      <ExtId id={a.provider_subscription_id} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Panel>

          <Panel title="Usage vs. limits" description={Object.keys(overrideLimits).length ? "Custom limit overrides are set for this workspace" : undefined}>
            {ent ? (
              <>
                <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                  {LIMIT_KEYS.map((key) => {
                    const used = ent.usage[key] ?? 0;
                    const limit = ent.limits[key];
                    const ratio = limit == null ? 0 : limit === 0 ? (used > 0 ? 1 : 0) : Math.min(1, used / limit);
                    return (
                      <li key={key}>
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="text-muted-foreground">
                            {LIMIT_LABELS[key]}
                            {key in overrideLimits ? <span className="ml-1 text-xs text-primary">(override)</span> : null}
                          </span>
                          <span className="tabular-nums text-foreground">
                            {fmtCount(used)} / {limit == null ? "∞" : fmtCount(limit)}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn("h-full rounded-full", ratio >= 1 ? "bg-destructive" : ratio >= 0.8 ? "bg-amber-500" : "bg-primary")}
                            style={{ width: `${limit == null ? 0 : Math.round(ratio * 100)}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
                  {FEATURE_KEYS.map((f) => (
                    <StatusPill key={f} status={ent.features[f] ? "active" : "none"} label={`${FEATURE_LABELS[f]}: ${ent.features[f] ? "on" : "off"}`} />
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Entitlements unavailable.</p>
            )}
          </Panel>

          <Panel title="Payment history" flush>
            {data.payments.length === 0 ? (
              <EmptyState>No payments yet.</EmptyState>
            ) : (
              <DataTable minWidth={640} head={<><Th>Date</Th><Th>Payment</Th><Th>Plan</Th><Th className="text-right">Amount</Th><Th>Status</Th><Th /></>}>
                {data.payments.map((p) => (
                  <tr key={p.id}>
                    <Td className="whitespace-nowrap text-muted-foreground">{fmtDateTime(p.paid_at ?? p.created_at)}</Td>
                    <Td><ExtId id={p.provider_payment_id} /></Td>
                    <Td>
                      {p.plan_code ?? "Add-on"}
                      {p.billing_interval ? <span className="text-xs text-muted-foreground"> · {p.billing_interval}</span> : null}
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
          </Panel>

          <Panel title="Billing webhook log" description="Latest 50 Razorpay events for this workspace" flush>
            {data.events.length === 0 ? (
              <EmptyState>No webhook events yet.</EmptyState>
            ) : (
              <ul className="divide-y divide-border">
                {data.events.map((e) => (
                  <li key={e.id} className="px-5 py-3">
                    <details className="group">
                      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <span className="font-mono text-xs text-foreground">{e.event_type}</span>
                        <StatusPill status={eventStatus(e)} />
                        <span className="ml-auto text-xs text-muted-foreground">{fmtDateTime(e.created_at)}</span>
                      </summary>
                      {e.error ? <p className="mt-2 text-xs text-destructive">{e.error}</p> : null}
                      <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-muted p-3 text-[11px] leading-relaxed">
                        {JSON.stringify(e.payload, null, 2)}
                      </pre>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Workspace">
            <dl className="divide-y divide-border">
              <Field label="Workspace ID">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 font-mono text-xs hover:text-primary"
                  onClick={() => {
                    void navigator.clipboard.writeText(account.id);
                    toast.success("Copied");
                  }}
                >
                  {account.id.slice(0, 8)}… <Copy className="size-3" />
                </button>
              </Field>
              <Field label="Created">{fmtDateTime(account.created_at)}</Field>
              <Field label="Billing name">{account.billing_name}</Field>
              <Field label="Billing email">{account.billing_email}</Field>
              <Field label="GSTIN">{account.billing_gstin ? <span className="font-mono text-xs">{account.billing_gstin}</span> : null}</Field>
              <Field label="State">{account.billing_state}</Field>
              <Field label="Address">{account.billing_address}</Field>
              {account.suspended_at ? <Field label="Suspended">{fmtDateTime(account.suspended_at)}</Field> : null}
            </dl>
          </Panel>

          <Panel title={`Team (${data.team.length})`} flush>
            <ul className="divide-y divide-border">
              {data.team.map((m) => (
                <li key={m.user_id} className="px-5 py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-foreground">{m.full_name || m.email}</span>
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground capitalize">{m.role}</span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Last sign-in {m.last_sign_in_at ? fmtRelative(m.last_sign_in_at) : "never"}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="WhatsApp">
            {data.whatsapp ? (
              <dl className="divide-y divide-border">
                <Field label="Status"><StatusPill status={data.whatsapp.status} /></Field>
                <Field label="Phone number ID"><span className="font-mono text-xs">{data.whatsapp.phone_number_id}</span></Field>
                <Field label="WABA ID"><span className="font-mono text-xs">{data.whatsapp.waba_id ?? "—"}</span></Field>
                <Field label="Connected">{fmtDate(data.whatsapp.connected_at)}</Field>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">Not connected yet.</p>
            )}
          </Panel>

          <Panel title="Activity" flush>
            <dl className="grid grid-cols-2">
              {COUNT_LABELS.map(([key, label]) => (
                <div key={key} className="border-b border-border px-5 py-3 odd:border-r">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{fmtCount(data.counts[key] ?? 0)}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
      </div>

      {managing ? (
        <ManageAccountDialog
          row={{
            id: account.id,
            name: account.name,
            owner_email: owner?.email ?? null,
            suspended_at: account.suspended_at,
            limit_overrides: account.limit_overrides ?? {},
            addons: data.addons.map((a) => ({ addon_code: a.addon_code, quantity: a.quantity })),
            subscription: sub
              ? {
                  plan_code: sub.plan_code,
                  status: sub.status,
                  billing_interval: sub.billing_interval,
                  trial_ends_at: sub.trial_ends_at,
                  current_period_end: sub.current_period_end,
                  cancel_at_period_end: sub.cancel_at_period_end,
                  provider: sub.provider,
                }
              : null,
          }}
          plans={plans}
          addons={addons}
          onClose={() => setManaging(false)}
          onSaved={() => {
            setManaging(false);
            setVersion((v) => v + 1);
          }}
        />
      ) : null}
    </div>
  );
}
