// ============================================================
// POST /api/billing/verify
//
// Razorpay Checkout's success handler posts the payment ids + signature
// here. We verify the signature with the key secret, then activate the
// plan immediately so the user doesn't wait for the webhook. The
// webhook applies the same transition again later — both paths are
// idempotent.
//
//   subscription: { razorpay_payment_id, razorpay_subscription_id, razorpay_signature }
//   order:        { razorpay_payment_id, razorpay_order_id,        razorpay_signature }
// ============================================================

import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import {
  fetchSubscription,
  razorpayCredentials,
  unixToIso,
  verifyOrderPaymentSignature,
  verifySubscriptionPaymentSignature,
} from '@/lib/billing/razorpay';
import { activateAddon, activateAnnual, activateRecurring } from '@/lib/billing/lifecycle';
import { getT } from '@/lib/i18n/translate';

const t = getT('Api.billing');

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length < 200 ? value : null;
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('admin');
    const creds = await razorpayCredentials();
    if (!creds) {
      return NextResponse.json({ error: t('checkoutUnavailable') }, { status: 503 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const paymentId = str(body.razorpay_payment_id);
    const signature = str(body.razorpay_signature);
    const subscriptionId = str(body.razorpay_subscription_id);
    const orderId = str(body.razorpay_order_id);
    if (!paymentId || !signature || (!subscriptionId && !orderId)) {
      return NextResponse.json({ error: t('invalidPayment') }, { status: 400 });
    }

    const db = supabaseAdmin();

    // Add-on purchase: the add-on and quantity come from the notes we
    // set when creating the Razorpay subscription, never from the body.
    if (subscriptionId) {
      if (!verifySubscriptionPaymentSignature(creds.keySecret, { subscriptionId, paymentId, signature })) {
        return NextResponse.json({ error: t('invalidSignature') }, { status: 400 });
      }
      const remote = await fetchSubscription(creds, subscriptionId);
      const notes = remote.notes && !Array.isArray(remote.notes) ? remote.notes : {};
      if (notes.kind === 'addon') {
        if (notes.account_id !== ctx.accountId || !notes.addon_code) {
          return NextResponse.json({ error: t('paymentNotPending') }, { status: 409 });
        }
        await activateAddon(db, {
          accountId: ctx.accountId,
          addonCode: notes.addon_code,
          quantity: Number(notes.quantity ?? 1),
          providerSubscriptionId: subscriptionId,
        });
        return NextResponse.json({ ok: true });
      }
    }

    // The plan comes from what THIS account started at checkout, never
    // from the request body.
    const valid = subscriptionId
      ? verifySubscriptionPaymentSignature(creds.keySecret, { subscriptionId, paymentId, signature })
      : verifyOrderPaymentSignature(creds.keySecret, { orderId: orderId!, paymentId, signature });
    if (!valid) {
      return NextResponse.json({ error: t('invalidSignature') }, { status: 400 });
    }

    const { data: sub } = await db
      .from('subscriptions')
      .select('pending_plan_code, pending_interval, pending_provider_ref, provider_subscription_id')
      .eq('account_id', ctx.accountId)
      .maybeSingle();
    const ref = subscriptionId ?? orderId;
    if (!sub?.pending_plan_code || sub.pending_provider_ref !== ref) {
      // The webhook often lands before the browser callback and has
      // already activated this exact payment (clearing the pending
      // fields) — that's success, not a conflict.
      const appliedRef = subscriptionId ?? `order:${orderId}`;
      if (sub?.provider_subscription_id === appliedRef) {
        return NextResponse.json({ ok: true, already_applied: true });
      }
      return NextResponse.json({ error: t('paymentNotPending') }, { status: 409 });
    }

    if (subscriptionId) {
      const remote = await fetchSubscription(creds, subscriptionId);
      await activateRecurring(db, {
        accountId: ctx.accountId,
        planCode: sub.pending_plan_code,
        providerSubscriptionId: subscriptionId,
        periodStart: unixToIso(remote.current_start) ?? new Date().toISOString(),
        periodEnd:
          unixToIso(remote.current_end) ??
          new Date(Date.now() + 31 * 86_400_000).toISOString(),
      });
    } else if (orderId) {
      await activateAnnual(db, {
        accountId: ctx.accountId,
        planCode: sub.pending_plan_code,
        orderId,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
