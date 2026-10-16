import { describe, expect, it } from 'vitest';

import { computeOverview, customerStatus, lastMonths, subscriptionMrr, type SubRow } from './metrics';

const NOW = new Date('2026-10-16T12:00:00Z');
const plans = [
  { code: 'starter', name: 'Starter', price_inr_monthly: 1999, price_inr_annual: 19190 },
  { code: 'growth', name: 'Growth', price_inr_monthly: 4999, price_inr_annual: 47990 },
];
const priceBy = new Map(plans.map((p) => [p.code, p]));
const sub = (over: Partial<SubRow>): SubRow => ({
  account_id: 'a',
  plan_code: 'growth',
  status: 'active',
  billing_interval: 'monthly',
  trial_ends_at: null,
  current_period_end: null,
  ...over,
});

describe('customerStatus', () => {
  it('splits running and expired trials', () => {
    expect(customerStatus(sub({ status: 'trialing', trial_ends_at: '2026-10-20T00:00:00Z' }), NOW.getTime())).toBe('trialing');
    expect(customerStatus(sub({ status: 'trialing', trial_ends_at: '2026-10-01T00:00:00Z' }), NOW.getTime())).toBe('trial_expired');
    expect(customerStatus(null)).toBe('none');
    expect(customerStatus(sub({ status: 'past_due' }))).toBe('past_due');
  });
});

describe('subscriptionMrr', () => {
  it('uses the monthly price, or annual ÷ 12', () => {
    expect(subscriptionMrr(sub({}), priceBy)).toBe(4999);
    expect(subscriptionMrr(sub({ billing_interval: 'annual' }), priceBy)).toBe(3999);
    expect(subscriptionMrr(sub({ status: 'trialing' }), priceBy)).toBe(0);
    expect(subscriptionMrr(sub({ status: 'past_due' }), priceBy)).toBe(4999);
  });
});

describe('lastMonths', () => {
  it('returns the trailing months oldest first', () => {
    expect(lastMonths(3, NOW)).toEqual(['2026-08', '2026-09', '2026-10']);
  });
});

describe('computeOverview', () => {
  it('computes MRR, conversion and revenue windows', () => {
    const { metrics, revenueByMonth, planMix, signupsByMonth } = computeOverview({
      now: NOW,
      plans,
      accounts: [
        { id: 'a', created_at: '2026-10-10T00:00:00Z' },
        { id: 'b', created_at: '2026-09-01T00:00:00Z' },
        { id: 'c', created_at: '2026-08-01T00:00:00Z' },
        { id: 'd', created_at: '2026-07-01T00:00:00Z' },
      ],
      subs: [
        sub({ account_id: 'a', status: 'trialing', trial_ends_at: '2026-10-24T00:00:00Z' }),
        sub({ account_id: 'b', plan_code: 'starter' }),
        sub({ account_id: 'c', billing_interval: 'annual' }),
        sub({ account_id: 'd', status: 'expired' }),
      ],
      payments: [
        { account_id: 'b', amount_paise: 235882, status: 'captured', paid_at: '2026-10-02T00:00:00Z', created_at: '2026-10-02T00:00:00Z' },
        { account_id: 'c', amount_paise: 5662820, status: 'captured', paid_at: '2026-08-01T00:00:00Z', created_at: '2026-08-01T00:00:00Z' },
        { account_id: 'd', amount_paise: 100000, status: 'failed', paid_at: null, created_at: '2026-10-05T00:00:00Z' },
      ],
    });

    expect(metrics.customers).toBe(4);
    expect(metrics.paying).toBe(2);
    expect(metrics.trialing).toBe(1);
    expect(metrics.churned).toBe(1);
    expect(metrics.mrr_inr).toBe(1999 + 3999);
    expect(metrics.arr_inr).toBe((1999 + 3999) * 12);
    expect(metrics.arpa_inr).toBe(2999);
    expect(metrics.trial_conversion).toBeCloseTo(2 / 3);
    expect(metrics.signups_30d).toBe(1);
    expect(metrics.revenue_mtd_inr).toBe(2358.82);
    expect(metrics.revenue_30d_inr).toBe(2358.82);
    expect(metrics.revenue_total_inr).toBe(2358.82 + 56628.2);
    expect(revenueByMonth.at(-1)).toEqual({ month: '2026-10', revenue: 2358.82 });
    expect(revenueByMonth.find((r) => r.month === '2026-08')?.revenue).toBe(56628.2);
    expect(signupsByMonth.at(-1)).toEqual({ month: '2026-10', signups: 1 });
    expect(planMix.map((p) => p.plan)).toEqual(['Growth', 'Starter']);
  });
});
