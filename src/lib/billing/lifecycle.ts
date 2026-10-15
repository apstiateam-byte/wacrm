// ============================================================
// Subscription state transitions.
//
// Called from two places that can race — the checkout `verify`
// callback (the browser, right after payment) and the Razorpay
// webhook (server to server, possibly seconds later or retried). Every
// transition is therefore idempotent: applying the same event twice
// leaves the row unchanged.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

import { cancelSubscription, razorpayCredentials } from './razorpay';
import type { BillingInterval } from './types';

const YEAR_MS = 365 * 86_400_000;

interface SubscriptionRow {
  account_id: string;
  plan_code: string;
  status: string;
  billing_interval: BillingInterval | null;
  current_period_end: string | null;
  provider: string | null;
  provider_subscription_id: string | null;
}

async function loadSubscription(db: SupabaseClient, accountId: string): Promise<SubscriptionRow | null> {
  const { data, error } = await db
    .from('subscriptions')
    .select('account_id, plan_code, status, billing_interval, current_period_end, provider, provider_subscription_id')
    .eq('account_id', accountId)
    .maybeSingle();
  if (error) throw error;
  return data as SubscriptionRow | null;
}

async function upsertSubscription(
  db: SupabaseClient,
  accountId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await db
    .from('subscriptions')
    .upsert({ account_id: accountId, ...patch }, { onConflict: 'account_id' });
  if (error) throw error;
}

/**
 * A monthly Razorpay subscription became (or stayed) active — first
 * charge or a renewal. Switching plans creates a new Razorpay
 * subscription; the previous one is cancelled here so the customer is
 * never billed twice.
 */
export async function activateRecurring(
  db: SupabaseClient,
  args: {
    accountId: string;
    planCode: string;
    providerSubscriptionId: string;
    periodStart: string | null;
    periodEnd: string | null;
  },
): Promise<void> {
  const existing = await loadSubscription(db, args.accountId);
  const previous =
    existing?.provider === 'razorpay' &&
    existing.provider_subscription_id &&
    existing.provider_subscription_id !== args.providerSubscriptionId
      ? existing.provider_subscription_id
      : null;

  await upsertSubscription(db, args.accountId, {
    plan_code: args.planCode,
    status: 'active',
    billing_interval: 'monthly',
    current_period_start: args.periodStart,
    current_period_end: args.periodEnd,
    cancel_at_period_end: false,
    provider: 'razorpay',
    provider_subscription_id: args.providerSubscriptionId,
    pending_plan_code: null,
    pending_interval: null,
    pending_provider_ref: null,
  });

  if (previous) {
    const creds = await razorpayCredentials();
    if (creds) {
      try {
        await cancelSubscription(creds, previous, false);
      } catch (err) {
        // Already cancelled / completed is fine; anything else needs a human.
        console.error('[billing] could not cancel superseded subscription', previous, err);
      }
    }
  }
}

/**
 * A one-time annual payment was captured. Paying again while a period
 * is still running extends it from its end rather than from today, so
 * renewing early never loses days.
 */
export async function activateAnnual(
  db: SupabaseClient,
  args: { accountId: string; planCode: string; orderId: string; paidAt?: Date },
): Promise<void> {
  const existing = await loadSubscription(db, args.accountId);
  const now = args.paidAt ?? new Date();

  // Idempotency: this order was already applied.
  const { data: applied } = await db
    .from('subscriptions')
    .select('account_id')
    .eq('account_id', args.accountId)
    .eq('provider_subscription_id', `order:${args.orderId}`)
    .maybeSingle();
  if (applied) return;

  const runningEnd =
    existing?.current_period_end &&
    ['active', 'canceled', 'past_due'].includes(existing.status) &&
    new Date(existing.current_period_end) > now
      ? new Date(existing.current_period_end)
      : null;
  const start = runningEnd && existing?.plan_code === args.planCode ? runningEnd : now;
  const end = new Date(start.getTime() + YEAR_MS);

  const previousRecurring =
    existing?.provider === 'razorpay' &&
    existing.provider_subscription_id &&
    !existing.provider_subscription_id.startsWith('order:')
      ? existing.provider_subscription_id
      : null;

  await upsertSubscription(db, args.accountId, {
    plan_code: args.planCode,
    status: 'active',
    billing_interval: 'annual',
    current_period_start: start.toISOString(),
    current_period_end: end.toISOString(),
    // Annual plans don't auto-renew (RBI e-mandate cap); the UI offers
    // a renewal payment before the period ends.
    cancel_at_period_end: true,
    provider: 'razorpay',
    provider_subscription_id: `order:${args.orderId}`,
    pending_plan_code: null,
    pending_interval: null,
    pending_provider_ref: null,
  });

  if (previousRecurring) {
    const creds = await razorpayCredentials();
    if (creds) {
      try {
        await cancelSubscription(creds, previousRecurring, false);
      } catch (err) {
        console.error('[billing] could not cancel monthly subscription after annual upgrade', err);
      }
    }
  }
}

/** A renewal charge failed; Razorpay keeps retrying. Grace applies. */
export async function markPastDue(db: SupabaseClient, providerSubscriptionId: string): Promise<void> {
  const { error } = await db
    .from('subscriptions')
    .update({ status: 'past_due' })
    .eq('provider_subscription_id', providerSubscriptionId)
    .in('status', ['active', 'past_due']);
  if (error) throw error;
}

/**
 * The subscription was cancelled. If the paid period is still running
 * the account keeps access until it ends (`canceled`), else `expired`.
 */
export async function markCanceled(
  db: SupabaseClient,
  providerSubscriptionId: string,
  periodEnd: string | null,
): Promise<void> {
  const stillPaid = periodEnd != null && new Date(periodEnd) > new Date();
  const { error } = await db
    .from('subscriptions')
    .update({
      status: stillPaid ? 'canceled' : 'expired',
      cancel_at_period_end: true,
      ...(periodEnd ? { current_period_end: periodEnd } : {}),
    })
    .eq('provider_subscription_id', providerSubscriptionId);
  if (error) throw error;
}

/**
 * An add-on subscription became (or stayed) active. Buying a new
 * quantity replaces the previous add-on subscription, which is
 * cancelled so the customer isn't billed twice.
 */
export async function activateAddon(
  db: SupabaseClient,
  args: { accountId: string; addonCode: string; quantity: number; providerSubscriptionId: string },
): Promise<void> {
  const { data: existing } = await db
    .from('subscription_addons')
    .select('provider_subscription_id')
    .eq('account_id', args.accountId)
    .eq('addon_code', args.addonCode)
    .maybeSingle();
  const previous =
    existing?.provider_subscription_id && existing.provider_subscription_id !== args.providerSubscriptionId
      ? (existing.provider_subscription_id as string)
      : null;

  const { error } = await db.from('subscription_addons').upsert(
    {
      account_id: args.accountId,
      addon_code: args.addonCode,
      quantity: Math.max(1, Math.floor(args.quantity)),
      provider_subscription_id: args.providerSubscriptionId,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'account_id,addon_code' },
  );
  if (error) throw error;

  if (previous) {
    const creds = await razorpayCredentials();
    if (creds) {
      try {
        await cancelSubscription(creds, previous, false);
      } catch (err) {
        console.error('[billing] could not cancel superseded add-on subscription', previous, err);
      }
    }
  }
}

/** The add-on subscription ended — remove the add-on (only if it's still this subscription). */
export async function removeAddon(db: SupabaseClient, providerSubscriptionId: string): Promise<void> {
  const { error } = await db
    .from('subscription_addons')
    .delete()
    .eq('provider_subscription_id', providerSubscriptionId);
  if (error) throw error;
}

export async function recordPayment(
  db: SupabaseClient,
  args: {
    accountId: string;
    paymentId: string;
    invoiceId?: string | null;
    planCode: string | null;
    interval: BillingInterval | null;
    amountPaise: number;
    currency?: string;
    status: string;
    paidAt?: string | null;
    invoiceUrl?: string | null;
  },
): Promise<void> {
  const { error } = await db.from('billing_payments').upsert(
    {
      account_id: args.accountId,
      provider: 'razorpay',
      provider_payment_id: args.paymentId,
      provider_invoice_id: args.invoiceId ?? null,
      plan_code: args.planCode,
      billing_interval: args.interval,
      amount_paise: args.amountPaise,
      currency: args.currency ?? 'INR',
      status: args.status,
      invoice_url: args.invoiceUrl ?? null,
      paid_at: args.paidAt ?? null,
    },
    { onConflict: 'provider,provider_payment_id' },
  );
  if (error) throw error;
}
