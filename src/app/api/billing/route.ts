// ============================================================
// /api/billing
//
//   GET   — everything the Billing & plan screen needs (any member).
//   PATCH — update GST / invoice details (admin+).
// ============================================================

import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { hasMinRole } from '@/lib/auth/roles';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { assertNotDemo, isDemoAccount } from '@/lib/demo/server';
import { getEntitlements, isPlatformAdmin } from '@/lib/billing/server';
import { razorpayCredentials } from '@/lib/billing/razorpay';
import { isValidGstin } from '@/lib/billing/gst';
import { FEATURE_KEYS, LIMIT_KEYS, type BillingSummary, type Entitlements } from '@/lib/billing/types';
import { getT } from '@/lib/i18n/translate';

const t = getT('Api.billing');

const UNLIMITED: Entitlements = {
  state: 'unlimited',
  writable: true,
  plan_code: null,
  limits: Object.fromEntries(LIMIT_KEYS.map((k) => [k, null])) as Entitlements['limits'],
  features: Object.fromEntries(FEATURE_KEYS.map((k) => [k, true])) as Entitlements['features'],
  usage: Object.fromEntries(LIMIT_KEYS.map((k) => [k, 0])) as Entitlements['usage'],
};

export async function GET() {
  try {
    const ctx = await requireRole('viewer');
    const db = supabaseAdmin();
    const isAdmin = hasMinRole(ctx.role, 'admin');

    const [settings, entitlements, subscription, plans, addons, accountAddons, payments, account, platformAdmin] =
      await Promise.all([
        db.from('platform_settings').select('billing_enabled, gst_percent').eq('id', true).maybeSingle(),
        // A database without migration 047 has no billing functions —
        // report "billing off" (unlimited) instead of failing the app.
        getEntitlements(ctx.accountId, db).catch((err: { message?: string }) => {
          console.warn('[billing GET] entitlements unavailable, treating billing as off:', err?.message ?? err);
          return UNLIMITED;
        }),
        db
          .from('subscriptions')
          .select(
            'account_id, plan_code, status, billing_interval, trial_ends_at, current_period_start, current_period_end, cancel_at_period_end, provider',
          )
          .eq('account_id', ctx.accountId)
          .maybeSingle(),
        db
          .from('plans')
          .select(
            'code, name, description, sort_order, is_public, is_active, highlighted, contact_sales, price_inr_monthly, price_inr_annual, limits, features',
          )
          .eq('is_active', true)
          .order('sort_order'),
        db.from('addons').select('*').eq('is_active', true).order('price_inr_monthly'),
        db
          .from('subscription_addons')
          .select('addon_code, quantity, cancel_at_period_end, provider_subscription_id')
          .eq('account_id', ctx.accountId),
        isAdmin
          ? db
              .from('billing_payments')
              .select(
                'id, provider_payment_id, plan_code, billing_interval, amount_paise, currency, status, invoice_url, paid_at, created_at',
              )
              .eq('account_id', ctx.accountId)
              .order('created_at', { ascending: false })
              .limit(50)
          : Promise.resolve({ data: null }),
        isAdmin
          ? db
              .from('accounts')
              .select('billing_name, billing_email, billing_gstin, billing_address, billing_state')
              .eq('id', ctx.accountId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        isPlatformAdmin(ctx.userId, db),
      ]);
    const isDemo = await isDemoAccount(ctx.accountId, db);

    const summary: BillingSummary = {
      billing_enabled: settings.data?.billing_enabled === true && entitlements.state !== 'unlimited',
      checkout_available: (await razorpayCredentials()) !== null,
      gst_percent: Number(settings.data?.gst_percent ?? 18),
      entitlements,
      subscription: subscription.data ?? null,
      plans: plans.data ?? [],
      addons: addons.data ?? [],
      account_addons: (accountAddons.data ?? []).map((a) => ({
        addon_code: a.addon_code as string,
        quantity: Number(a.quantity),
        cancel_at_period_end: a.cancel_at_period_end === true,
        // Granted by the operator in /admin rather than bought online.
        managed: !a.provider_subscription_id,
      })),
      payments: payments.data ?? null,
      details: account.data ?? null,
      is_platform_admin: platformAdmin,
      is_demo: isDemo,
    };
    return NextResponse.json(summary);
  } catch (err) {
    return toErrorResponse(err);
  }
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireRole('admin');
    await assertNotDemo(ctx.accountId);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const gstin = cleanText(body.billing_gstin, 15)?.toUpperCase() ?? null;
    if (gstin && !isValidGstin(gstin)) {
      return NextResponse.json({ error: t('invalidGstin'), field: 'billing_gstin' }, { status: 400 });
    }
    const email = cleanText(body.billing_email, 254);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: t('invalidEmail'), field: 'billing_email' }, { status: 400 });
    }

    const patch = {
      billing_name: cleanText(body.billing_name, 200),
      billing_email: email,
      billing_gstin: gstin,
      billing_address: cleanText(body.billing_address, 1000),
      billing_state: cleanText(body.billing_state, 100),
    };

    // Billing details are owned by the billing API, not client RLS —
    // write with the service role, scoped to the caller's account.
    const { error } = await supabaseAdmin().from('accounts').update(patch).eq('id', ctx.accountId);
    if (error) {
      console.error('[billing PATCH] update failed:', error.message);
      return NextResponse.json({ error: t('saveFailed') }, { status: 500 });
    }
    return NextResponse.json({ details: patch });
  } catch (err) {
    return toErrorResponse(err);
  }
}
