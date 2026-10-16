// ============================================================
// POST /api/billing/checkout  { plan_code, interval }
//
// Starts a Razorpay payment for a plan (owner / admin only) and
// returns what the browser needs to open Razorpay Checkout.
//
//   monthly → Razorpay Subscription (auto-renews via UPI Autopay /
//             card mandate). The Razorpay plan is created on first use
//             and its id cached on `plans.razorpay_plan_id_monthly`.
//   annual  → one-time Razorpay Order for 12 months.
//
// Prices are stored exclusive of GST (the charged amount adds
// `platform_settings.gst_percent`) unless `prices_include_gst` is on,
// in which case they're charged as-is. `select('*')` keeps checkout
// working on a database without migration 051. Nothing is activated here — the
// verify callback / webhook does that once Razorpay confirms payment.
// ============================================================

import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { APP_NAME } from '@/lib/brand';
import { assertNotDemo } from '@/lib/demo/server';
import {
  createOrder,
  createPlan,
  createSubscription,
  razorpayCredentials,
  RazorpayError,
} from '@/lib/billing/razorpay';
import { chargePaise, taxSettingsOf, type BillingInterval } from '@/lib/billing/types';
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';
import { getT } from '@/lib/i18n/translate';

const t = getT('Api.billing');

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('admin');
    await assertNotDemo(ctx.accountId);

    const limit = checkRateLimit(`billing-checkout:${ctx.userId}`, RATE_LIMITS.adminAction);
    if (!limit.success) return rateLimitResponse(limit);

    const creds = await razorpayCredentials();
    if (!creds) {
      return NextResponse.json({ error: t('checkoutUnavailable') }, { status: 503 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      plan_code?: unknown;
      interval?: unknown;
    };
    const interval: BillingInterval | null =
      body.interval === 'monthly' || body.interval === 'annual' ? body.interval : null;
    if (typeof body.plan_code !== 'string' || !interval) {
      return NextResponse.json({ error: t('invalidPlan') }, { status: 400 });
    }

    const db = supabaseAdmin();
    const [{ data: plan }, { data: settings }, { data: account }] = await Promise.all([
      db
        .from('plans')
        .select('code, name, is_public, is_active, contact_sales, price_inr_monthly, price_inr_annual, razorpay_plan_id_monthly')
        .eq('code', body.plan_code)
        .maybeSingle(),
      db.from('platform_settings').select('*').eq('id', true).maybeSingle(),
      db
        .from('accounts')
        .select('name, billing_email, billing_name')
        .eq('id', ctx.accountId)
        .maybeSingle(),
    ]);

    if (!settings?.billing_enabled) {
      return NextResponse.json({ error: t('billingDisabled') }, { status: 400 });
    }
    const price = interval === 'monthly' ? plan?.price_inr_monthly : plan?.price_inr_annual;
    if (!plan || !plan.is_active || !plan.is_public || plan.contact_sales || price == null || price <= 0) {
      return NextResponse.json({ error: t('invalidPlan') }, { status: 400 });
    }

    const tax = taxSettingsOf(settings);
    const gst = tax.gstPercent;
    const amountPaise = chargePaise(price, tax);
    const notes = {
      account_id: ctx.accountId,
      plan_code: plan.code,
      interval,
      user_id: ctx.userId,
    };

    const { data: profile } = await ctx.supabase
      .from('profiles')
      .select('email, full_name')
      .eq('user_id', ctx.userId)
      .maybeSingle();
    const prefill = {
      name: account?.billing_name ?? profile?.full_name ?? account?.name ?? '',
      email: account?.billing_email ?? profile?.email ?? '',
    };

    if (interval === 'monthly') {
      let razorpayPlanId = plan.razorpay_plan_id_monthly as string | null;
      if (!razorpayPlanId) {
        const created = await createPlan(creds, {
          name: `${APP_NAME} ${plan.name} (monthly)`,
          amountPaise,
          description: gst > 0 ? `Includes ${gst}% GST` : undefined,
          notes: { plan_code: plan.code },
        });
        razorpayPlanId = created.id;
        await db.from('plans').update({ razorpay_plan_id_monthly: razorpayPlanId }).eq('code', plan.code);
      }

      const subscription = await createSubscription(creds, { planId: razorpayPlanId, notes });
      await db
        .from('subscriptions')
        .update({
          pending_plan_code: plan.code,
          pending_interval: 'monthly',
          pending_provider_ref: subscription.id,
        })
        .eq('account_id', ctx.accountId);

      return NextResponse.json({
        kind: 'subscription',
        key_id: creds.keyId,
        subscription_id: subscription.id,
        plan_name: plan.name,
        amount_paise: amountPaise,
        prefill,
      });
    }

    const order = await createOrder(creds, {
      amountPaise,
      receipt: `${ctx.accountId.slice(0, 8)}-${Date.now()}`,
      notes,
    });
    await db
      .from('subscriptions')
      .update({
        pending_plan_code: plan.code,
        pending_interval: 'annual',
        pending_provider_ref: order.id,
      })
      .eq('account_id', ctx.accountId);

    return NextResponse.json({
      kind: 'order',
      key_id: creds.keyId,
      order_id: order.id,
      plan_name: plan.name,
      amount_paise: amountPaise,
      prefill,
    });
  } catch (err) {
    if (err instanceof RazorpayError) {
      console.error('[billing checkout] Razorpay error:', err.status, err.code, err.message);
      return NextResponse.json({ error: t('providerError', { message: err.message }) }, { status: 502 });
    }
    return toErrorResponse(err);
  }
}
