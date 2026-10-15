// ============================================================
// POST /api/billing/cancel — owner only.
//
// Cancels auto-renewal at the end of the current period. The account
// keeps full access until then (state `canceled`), after which it
// becomes read-only. Data is never deleted.
// ============================================================

import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { assertNotDemo } from '@/lib/demo/server';
import { cancelSubscription, razorpayCredentials, RazorpayError } from '@/lib/billing/razorpay';
import { getT } from '@/lib/i18n/translate';

const t = getT('Api.billing');

export async function POST() {
  try {
    const ctx = await requireRole('owner');
    await assertNotDemo(ctx.accountId);
    const db = supabaseAdmin();

    const { data: sub } = await db
      .from('subscriptions')
      .select('status, provider, provider_subscription_id, current_period_end')
      .eq('account_id', ctx.accountId)
      .maybeSingle();
    if (!sub || !['active', 'past_due'].includes(sub.status)) {
      return NextResponse.json({ error: t('nothingToCancel') }, { status: 400 });
    }

    const providerId = sub.provider_subscription_id as string | null;
    if (sub.provider === 'razorpay' && providerId && !providerId.startsWith('order:')) {
      const creds = await razorpayCredentials();
      if (!creds) {
        return NextResponse.json({ error: t('checkoutUnavailable') }, { status: 503 });
      }
      await cancelSubscription(creds, providerId, true);
    }

    // Razorpay's subscription.cancelled webhook lands at cycle end and
    // flips status then; until that point the account is active but
    // won't renew.
    const { error } = await db
      .from('subscriptions')
      .update({ cancel_at_period_end: true })
      .eq('account_id', ctx.accountId);
    if (error) throw error;

    return NextResponse.json({ ok: true, access_until: sub.current_period_end });
  } catch (err) {
    if (err instanceof RazorpayError) {
      return NextResponse.json({ error: t('providerError', { message: err.message }) }, { status: 502 });
    }
    return toErrorResponse(err);
  }
}
