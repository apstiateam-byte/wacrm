// ============================================================
// GET /api/admin/overview — the owner console's dashboard: revenue and
// customer KPIs, 12-month trends, plan mix, and the lists that need
// attention (trials ending, failed payments, webhook errors).
// Platform admins only. The live-demo workspace is excluded.
// ============================================================

import { NextResponse } from 'next/server';

import { toErrorResponse } from '@/lib/auth/account';
import { requirePlatformAdmin } from '@/lib/billing/admin-guard';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { accountLabels, demoAccountIds, fetchAll } from '@/lib/admin/data';
import { computeOverview, customerStatus, type PaymentRow, type PlanPriceRow, type SubRow } from '@/lib/admin/metrics';

export async function GET() {
  try {
    await requirePlatformAdmin();
    const db = supabaseAdmin();
    const demo = await demoAccountIds(db);

    const [accounts, subs, plans, payments, failedEvents] = await Promise.all([
      fetchAll<{ id: string; name: string; owner_user_id: string; created_at: string }>(() =>
        db.from('accounts').select('id, name, owner_user_id, created_at').order('created_at'),
      ),
      fetchAll<SubRow>(() =>
        db
          .from('subscriptions')
          .select('account_id, plan_code, status, billing_interval, trial_ends_at, current_period_end')
          .order('account_id'),
      ),
      db.from('plans').select('code, name, price_inr_monthly, price_inr_annual'),
      fetchAll<PaymentRow & { id: string; plan_code: string | null; billing_interval: string | null; currency: string; provider_payment_id: string }>(() =>
        db
          .from('billing_payments')
          .select('id, account_id, amount_paise, currency, status, plan_code, billing_interval, provider_payment_id, paid_at, created_at')
          .order('created_at'),
      ),
      db
        .from('billing_events')
        .select('id', { count: 'exact', head: true })
        .is('processed_at', null)
        .not('error', 'is', null),
    ]);

    const customers = accounts.filter((a) => !demo.has(a.id));
    const customerSubs = subs.filter((s) => !demo.has(s.account_id));
    const customerPayments = payments.filter((p) => !demo.has(p.account_id));

    const overview = computeOverview({
      accounts: customers,
      subs: customerSubs,
      plans: (plans.data ?? []) as PlanPriceRow[],
      payments: customerPayments,
    });

    const now = Date.now();
    const subBy = new Map(customerSubs.map((s) => [s.account_id, s]));
    const planName = new Map(((plans.data ?? []) as PlanPriceRow[]).map((p) => [p.code, p.name]));

    const trialsEnding = customerSubs
      .filter((s) => {
        if (s.status !== 'trialing' || !s.trial_ends_at) return false;
        const left = new Date(s.trial_ends_at).getTime() - now;
        return left > 0 && left <= 7 * 86_400_000;
      })
      .sort((a, b) => a.trial_ends_at!.localeCompare(b.trial_ends_at!))
      .slice(0, 10);
    const pastDue = customerSubs.filter((s) => s.status === 'past_due').slice(0, 10);
    const recentSignups = [...customers].reverse().slice(0, 8);
    const recentPayments = [...customerPayments].reverse().slice(0, 8);

    const labels = await accountLabels(db, [
      ...trialsEnding.map((s) => s.account_id),
      ...pastDue.map((s) => s.account_id),
      ...recentSignups.map((a) => a.id),
      ...recentPayments.map((p) => p.account_id),
    ]);
    const label = (id: string) => ({
      account_id: id,
      account_name: labels.get(id)?.name ?? '—',
      owner_email: labels.get(id)?.owner_email ?? null,
    });

    return NextResponse.json({
      metrics: overview.metrics,
      revenue_by_month: overview.revenueByMonth,
      signups_by_month: overview.signupsByMonth,
      plan_mix: overview.planMix,
      failed_events: failedEvents.count ?? 0,
      trials_ending: trialsEnding.map((s) => ({
        ...label(s.account_id),
        plan_name: planName.get(s.plan_code) ?? s.plan_code,
        trial_ends_at: s.trial_ends_at,
      })),
      past_due: pastDue.map((s) => ({
        ...label(s.account_id),
        plan_name: planName.get(s.plan_code) ?? s.plan_code,
        current_period_end: s.current_period_end,
      })),
      recent_signups: recentSignups.map((a) => {
        const sub = subBy.get(a.id);
        return {
          ...label(a.id),
          created_at: a.created_at,
          status: customerStatus(sub, now),
          plan_name: sub ? (planName.get(sub.plan_code) ?? sub.plan_code) : null,
        };
      }),
      recent_payments: recentPayments.map((p) => ({
        ...label(p.account_id),
        id: p.id,
        provider_payment_id: p.provider_payment_id,
        amount_paise: p.amount_paise,
        currency: p.currency,
        status: p.status,
        plan_name: p.plan_code ? (planName.get(p.plan_code) ?? p.plan_code) : null,
        paid_at: p.paid_at ?? p.created_at,
      })),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
