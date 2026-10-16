// ============================================================
// Owner-console metrics. Pure functions over rows the admin API
// loads with the service-role client, so they're easy to test.
//
// Money: MRR/ARR are list prices excluding tax (annual ÷ 12).
// Revenue is what was actually collected (billing_payments, paise,
// including tax) — the two are deliberately different numbers.
// ============================================================

export interface SubRow {
  account_id: string;
  plan_code: string;
  status: string;
  billing_interval: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
}

export interface PlanPriceRow {
  code: string;
  name: string;
  price_inr_monthly: number | null;
  price_inr_annual: number | null;
}

export interface PaymentRow {
  account_id: string;
  amount_paise: number;
  status: string;
  paid_at: string | null;
  created_at: string;
}

/** Customer lifecycle bucket shown across the console. */
export type CustomerStatus = 'trialing' | 'trial_expired' | 'active' | 'past_due' | 'canceled' | 'expired' | 'none';

export function customerStatus(sub: Pick<SubRow, 'status' | 'trial_ends_at'> | null | undefined, now = Date.now()): CustomerStatus {
  if (!sub) return 'none';
  if (sub.status === 'trialing') {
    return sub.trial_ends_at && new Date(sub.trial_ends_at).getTime() <= now ? 'trial_expired' : 'trialing';
  }
  if (['active', 'past_due', 'canceled', 'expired'].includes(sub.status)) return sub.status as CustomerStatus;
  return 'none';
}

/** Monthly recurring revenue of one subscription, in rupees (0 when not paying). */
export function subscriptionMrr(sub: SubRow, priceBy: Map<string, PlanPriceRow>): number {
  if (sub.status !== 'active' && sub.status !== 'past_due') return 0;
  const plan = priceBy.get(sub.plan_code);
  if (!plan) return 0;
  return sub.billing_interval === 'annual'
    ? Math.round((plan.price_inr_annual ?? 0) / 12)
    : (plan.price_inr_monthly ?? 0);
}

export const isCollected = (p: Pick<PaymentRow, 'status'>) => p.status === 'captured' || p.status === 'paid';

/** `YYYY-MM` keys for the last `count` months, oldest first. */
export function lastMonths(count: number, now = new Date()): string[] {
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

export interface OverviewMetrics {
  customers: number;
  paying: number;
  trialing: number;
  trial_expired: number;
  past_due: number;
  churned: number;
  mrr_inr: number;
  arr_inr: number;
  arpa_inr: number;
  /** Paying ÷ (paying + churned + expired trials), 0..1. */
  trial_conversion: number | null;
  signups_30d: number;
  revenue_30d_inr: number;
  revenue_mtd_inr: number;
  revenue_total_inr: number;
}

export function computeOverview(args: {
  accounts: { id: string; created_at: string }[];
  subs: SubRow[];
  plans: PlanPriceRow[];
  payments: PaymentRow[];
  now?: Date;
}): {
  metrics: OverviewMetrics;
  revenueByMonth: { month: string; revenue: number }[];
  signupsByMonth: { month: string; signups: number }[];
  planMix: { plan: string; customers: number; mrr: number }[];
} {
  const now = args.now ?? new Date();
  const nowMs = now.getTime();
  const priceBy = new Map(args.plans.map((p) => [p.code, p]));
  const subBy = new Map(args.subs.map((s) => [s.account_id, s]));

  const m: OverviewMetrics = {
    customers: args.accounts.length,
    paying: 0,
    trialing: 0,
    trial_expired: 0,
    past_due: 0,
    churned: 0,
    mrr_inr: 0,
    arr_inr: 0,
    arpa_inr: 0,
    trial_conversion: null,
    signups_30d: 0,
    revenue_30d_inr: 0,
    revenue_mtd_inr: 0,
    revenue_total_inr: 0,
  };
  const mix = new Map<string, { customers: number; mrr: number }>();

  for (const a of args.accounts) {
    if (nowMs - new Date(a.created_at).getTime() <= 30 * 86_400_000) m.signups_30d++;
    const sub = subBy.get(a.id) ?? null;
    const status = customerStatus(sub, nowMs);
    if (status === 'active') m.paying++;
    else if (status === 'past_due') m.past_due++;
    else if (status === 'trialing') m.trialing++;
    else if (status === 'trial_expired') m.trial_expired++;
    else if (status === 'canceled' || status === 'expired') m.churned++;
    if (sub && (status === 'active' || status === 'past_due')) {
      const mrr = subscriptionMrr(sub, priceBy);
      m.mrr_inr += mrr;
      const name = priceBy.get(sub.plan_code)?.name ?? sub.plan_code;
      const entry = mix.get(name) ?? { customers: 0, mrr: 0 };
      entry.customers++;
      entry.mrr += mrr;
      mix.set(name, entry);
    }
  }
  m.arr_inr = m.mrr_inr * 12;
  const payingTotal = m.paying + m.past_due;
  m.arpa_inr = payingTotal ? Math.round(m.mrr_inr / payingTotal) : 0;
  const decided = payingTotal + m.churned + m.trial_expired;
  m.trial_conversion = decided ? payingTotal / decided : null;

  const months = lastMonths(12, now);
  const revenue = new Map(months.map((k) => [k, 0]));
  const signups = new Map(months.map((k) => [k, 0]));
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  for (const p of args.payments) {
    if (!isCollected(p)) continue;
    const at = p.paid_at ?? p.created_at;
    const rupees = p.amount_paise / 100;
    m.revenue_total_inr += rupees;
    const ms = new Date(at).getTime();
    if (nowMs - ms <= 30 * 86_400_000) m.revenue_30d_inr += rupees;
    if (ms >= monthStart) m.revenue_mtd_inr += rupees;
    const key = at.slice(0, 7);
    if (revenue.has(key)) revenue.set(key, revenue.get(key)! + rupees);
  }
  for (const a of args.accounts) {
    const key = a.created_at.slice(0, 7);
    if (signups.has(key)) signups.set(key, signups.get(key)! + 1);
  }
  const round2 = (n: number) => Math.round(n * 100) / 100;
  m.revenue_30d_inr = round2(m.revenue_30d_inr);
  m.revenue_mtd_inr = round2(m.revenue_mtd_inr);
  m.revenue_total_inr = round2(m.revenue_total_inr);

  return {
    metrics: m,
    revenueByMonth: months.map((month) => ({ month, revenue: round2(revenue.get(month)!) })),
    signupsByMonth: months.map((month) => ({ month, signups: signups.get(month)! })),
    planMix: [...mix.entries()]
      .map(([plan, v]) => ({ plan, ...v }))
      .sort((a, b) => b.mrr - a.mrr),
  };
}
