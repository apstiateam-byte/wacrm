// ============================================================
// /api/billing/addons — self-serve add-ons (admin+).
//
//   POST   { addon_code, quantity }  start a monthly Razorpay
//          subscription for that many units; answers a checkout session
//          like /api/billing/checkout. Activated by the verify callback
//          or the webhook; an existing subscription for the same add-on
//          is replaced (cancelled) once the new one is active.
//   DELETE { addon_code }            stop renewing it; the add-on stays
//          until the paid month ends (the webhook removes it then).
//
// Add-ons need a paid plan — trial and lapsed workspaces are refused.
// ============================================================

import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { assertNotDemo } from '@/lib/demo/server';
import { getEntitlements } from '@/lib/billing/server';
import {
  cancelSubscription,
  createPlan,
  createSubscription,
  razorpayCredentials,
  RazorpayError,
} from '@/lib/billing/razorpay';
import { withTaxPaise } from '@/lib/billing/types';
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';
import { getT } from '@/lib/i18n/translate';

const t = getT('Api.billing');
const MAX_QUANTITY = 100;

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('admin');
    await assertNotDemo(ctx.accountId);
    const limit = checkRateLimit(`billing-addon:${ctx.userId}`, RATE_LIMITS.adminAction);
    if (!limit.success) return rateLimitResponse(limit);

    const creds = await razorpayCredentials();
    if (!creds) return NextResponse.json({ error: t('checkoutUnavailable') }, { status: 503 });

    const body = (await request.json().catch(() => ({}))) as { addon_code?: unknown; quantity?: unknown };
    const quantity = typeof body.quantity === 'number' ? Math.floor(body.quantity) : NaN;
    if (typeof body.addon_code !== 'string' || !(quantity >= 1 && quantity <= MAX_QUANTITY)) {
      return NextResponse.json({ error: t('invalidAddon') }, { status: 400 });
    }

    const db = supabaseAdmin();
    const ent = await getEntitlements(ctx.accountId, db);
    if (ent.state !== 'active' && ent.state !== 'past_due') {
      return NextResponse.json({ error: t('addonNeedsPlan') }, { status: 400 });
    }

    const [{ data: addon }, { data: settings }, { data: account }] = await Promise.all([
      db.from('addons').select('*').eq('code', body.addon_code).eq('is_active', true).maybeSingle(),
      db.from('platform_settings').select('gst_percent').eq('id', true).maybeSingle(),
      db.from('accounts').select('name, billing_email, billing_name').eq('id', ctx.accountId).maybeSingle(),
    ]);
    if (!addon) return NextResponse.json({ error: t('invalidAddon') }, { status: 400 });

    const gst = Number(settings?.gst_percent ?? 18);
    const unitPaise = withTaxPaise(addon.price_inr_monthly as number, gst);

    let planId = addon.razorpay_plan_id as string | null;
    if (!planId) {
      const created = await createPlan(creds, {
        name: `${addon.name} (monthly add-on)`,
        amountPaise: unitPaise,
        description: gst > 0 ? `Per unit, includes ${gst}% GST` : 'Per unit',
        notes: { addon_code: addon.code as string },
      });
      planId = created.id;
      await db.from('addons').update({ razorpay_plan_id: planId }).eq('code', addon.code);
    }

    const subscription = await createSubscription(creds, {
      planId,
      quantity,
      notes: {
        kind: 'addon',
        account_id: ctx.accountId,
        addon_code: addon.code as string,
        quantity: String(quantity),
        user_id: ctx.userId,
      },
    });

    const { data: profile } = await ctx.supabase
      .from('profiles')
      .select('email, full_name')
      .eq('user_id', ctx.userId)
      .maybeSingle();

    return NextResponse.json({
      kind: 'subscription',
      key_id: creds.keyId,
      subscription_id: subscription.id,
      plan_name: addon.name,
      amount_paise: unitPaise * quantity,
      prefill: {
        name: account?.billing_name ?? profile?.full_name ?? account?.name ?? '',
        email: account?.billing_email ?? profile?.email ?? '',
      },
    });
  } catch (err) {
    if (err instanceof RazorpayError) {
      return NextResponse.json({ error: t('providerError', { message: err.message }) }, { status: 502 });
    }
    return toErrorResponse(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await requireRole('admin');
    await assertNotDemo(ctx.accountId);
    const body = (await request.json().catch(() => ({}))) as { addon_code?: unknown };
    if (typeof body.addon_code !== 'string') {
      return NextResponse.json({ error: t('invalidAddon') }, { status: 400 });
    }

    const db = supabaseAdmin();
    const { data: row } = await db
      .from('subscription_addons')
      .select('provider_subscription_id')
      .eq('account_id', ctx.accountId)
      .eq('addon_code', body.addon_code)
      .maybeSingle();
    if (!row) return NextResponse.json({ error: t('invalidAddon') }, { status: 404 });

    const providerId = row.provider_subscription_id as string | null;
    if (providerId) {
      const creds = await razorpayCredentials();
      if (!creds) return NextResponse.json({ error: t('checkoutUnavailable') }, { status: 503 });
      await cancelSubscription(creds, providerId, true);
      await db
        .from('subscription_addons')
        .update({ cancel_at_period_end: true })
        .eq('account_id', ctx.accountId)
        .eq('addon_code', body.addon_code);
    } else {
      // Granted by the operator, not paid — nothing to cancel upstream.
      return NextResponse.json({ error: t('addonManaged') }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof RazorpayError) {
      return NextResponse.json({ error: t('providerError', { message: err.message }) }, { status: 502 });
    }
    return toErrorResponse(err);
  }
}
