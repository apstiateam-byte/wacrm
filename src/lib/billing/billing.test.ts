import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { isValidGstin } from './gst';
import {
  verifyOrderPaymentSignature,
  verifySubscriptionPaymentSignature,
  verifyWebhookSignature,
} from './razorpay';
import {
  annualMonthlyEquivalent,
  annualSavingPercent,
  chargePaise,
  daysUntil,
  finalPriceInr,
  isReadOnlyState,
  parsePlanLimitError,
  taxSettingsOf,
  usageRatio,
  withTaxPaise,
} from './types';

const hmac = (secret: string, payload: string) =>
  createHmac('sha256', secret).update(payload).digest('hex');

describe('isValidGstin', () => {
  it('accepts a GSTIN with a correct checksum', () => {
    expect(isValidGstin('27AAPFU0939F1ZV')).toBe(true);
    expect(isValidGstin(' 27aapfu0939f1zv ')).toBe(true);
  });

  it('rejects a wrong checksum or a bad shape', () => {
    expect(isValidGstin('27AAPFU0939F1ZA')).toBe(false);
    expect(isValidGstin('27AAPFU0939F1Z')).toBe(false);
    expect(isValidGstin('hello')).toBe(false);
  });
});

describe('Razorpay signatures', () => {
  const secret = 'test_secret';

  it('verifies an order payment as HMAC(order_id|payment_id)', () => {
    const signature = hmac(secret, 'order_1|pay_1');
    expect(verifyOrderPaymentSignature(secret, { orderId: 'order_1', paymentId: 'pay_1', signature })).toBe(true);
    expect(verifyOrderPaymentSignature(secret, { orderId: 'order_2', paymentId: 'pay_1', signature })).toBe(false);
  });

  it('verifies a subscription payment as HMAC(payment_id|subscription_id)', () => {
    const signature = hmac(secret, 'pay_1|sub_1');
    expect(
      verifySubscriptionPaymentSignature(secret, { subscriptionId: 'sub_1', paymentId: 'pay_1', signature }),
    ).toBe(true);
    // Order of the two ids matters.
    expect(
      verifySubscriptionPaymentSignature(secret, {
        subscriptionId: 'sub_1',
        paymentId: 'pay_1',
        signature: hmac(secret, 'sub_1|pay_1'),
      }),
    ).toBe(false);
  });

  it('verifies a webhook over the raw body and rejects a missing header', () => {
    const body = '{"event":"subscription.charged"}';
    expect(verifyWebhookSignature(secret, body, hmac(secret, body))).toBe(true);
    expect(verifyWebhookSignature(secret, `${body} `, hmac(secret, body))).toBe(false);
    expect(verifyWebhookSignature(secret, body, null)).toBe(false);
  });
});

describe('pricing helpers', () => {
  it('adds GST and converts to paise', () => {
    expect(withTaxPaise(1999, 18)).toBe(235882);
    expect(withTaxPaise(4999, 0)).toBe(499900);
  });

  it('charges GST on top or treats the price as GST-inclusive', () => {
    expect(chargePaise(4999, { gstPercent: 18, pricesIncludeGst: false })).toBe(589882);
    expect(chargePaise(4999, { gstPercent: 18, pricesIncludeGst: true })).toBe(499900);
    expect(finalPriceInr(4999, { gstPercent: 18, pricesIncludeGst: false })).toBe(5898.82);
    expect(finalPriceInr(4999, { gstPercent: 18, pricesIncludeGst: true })).toBe(4999);
  });

  it('reads tax settings with safe defaults', () => {
    expect(taxSettingsOf(null)).toEqual({ gstPercent: 18, pricesIncludeGst: false });
    expect(taxSettingsOf({ gst_percent: '12.00', prices_include_gst: true })).toEqual({
      gstPercent: 12,
      pricesIncludeGst: true,
    });
  });

  it('derives the annual monthly equivalent and saving', () => {
    const plan = { price_inr_monthly: 4999, price_inr_annual: 47990 };
    expect(annualMonthlyEquivalent(plan)).toBe(3999);
    expect(annualSavingPercent(plan)).toBe(20);
    expect(annualSavingPercent({ price_inr_monthly: null, price_inr_annual: 100 })).toBeNull();
  });
});

describe('state + usage helpers', () => {
  it('treats only lapsed states as read-only', () => {
    expect(isReadOnlyState('trial_expired')).toBe(true);
    expect(isReadOnlyState('expired')).toBe(true);
    expect(isReadOnlyState('suspended')).toBe(true);
    expect(isReadOnlyState('past_due')).toBe(false);
    expect(isReadOnlyState('canceled')).toBe(false);
    expect(isReadOnlyState('unlimited')).toBe(false);
  });

  it('counts whole days left, never negative', () => {
    const now = new Date('2026-10-14T12:00:00Z');
    expect(daysUntil('2026-10-16T12:00:00Z', now)).toBe(2);
    expect(daysUntil('2026-10-14T13:00:00Z', now)).toBe(1);
    expect(daysUntil('2026-10-01T00:00:00Z', now)).toBe(0);
    expect(daysUntil(null, now)).toBeNull();
  });

  it('computes a usage ratio, null when unlimited', () => {
    expect(usageRatio(50, 100)).toBe(0.5);
    expect(usageRatio(150, 100)).toBe(1);
    expect(usageRatio(5, null)).toBeNull();
    expect(usageRatio(0, 0)).toBe(0);
  });
});

describe('parsePlanLimitError', () => {
  it('reads the Postgres trigger error PostgREST returns', () => {
    expect(
      parsePlanLimitError({
        code: 'P0001',
        message: 'plan_limit_reached',
        details: '{"key": "contacts", "limit": 1000}',
      }),
    ).toEqual({ code: 'plan_limit_reached', key: 'contacts', limit: 1000 });
  });

  it('reads a billing 402 body', () => {
    expect(parsePlanLimitError({ code: 'feature_not_in_plan', key: 'ai' })).toEqual({
      code: 'feature_not_in_plan',
      key: 'ai',
    });
    expect(parsePlanLimitError({ code: 'account_read_only' })).toEqual({
      code: 'account_read_only',
      key: undefined,
    });
  });

  it('ignores unrelated errors', () => {
    expect(parsePlanLimitError({ code: '42501', message: 'new row violates row-level security policy' })).toBeNull();
    expect(parsePlanLimitError(null)).toBeNull();
  });
});
