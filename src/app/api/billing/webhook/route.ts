// ============================================================
// POST /api/billing/webhook — Razorpay → wacrm.
//
// Configure in Razorpay Dashboard → Webhooks with this URL, the secret
// in RAZORPAY_WEBHOOK_SECRET, and these events:
//   subscription.activated, subscription.charged, subscription.pending,
//   subscription.halted, subscription.cancelled, subscription.completed,
//   order.paid
//
// Signed with HMAC-SHA256 over the raw body (X-Razorpay-Signature).
// Every event is logged in billing_events, keyed on X-Razorpay-Event-Id,
// so Razorpay's retries are processed once.
// ============================================================

import { NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/flows/admin-client';
import { razorpayWebhookSecret, unixToIso, verifyWebhookSignature } from '@/lib/billing/razorpay';
import {
  activateAddon,
  removeAddon,
  activateAnnual,
  activateRecurring,
  markCanceled,
  markPastDue,
  recordPayment,
} from '@/lib/billing/lifecycle';
import type { BillingInterval } from '@/lib/billing/types';

interface Entity {
  id: string;
  notes?: Record<string, string> | unknown[];
  [key: string]: unknown;
}

interface RazorpayEvent {
  event: string;
  payload: {
    subscription?: { entity: Entity };
    payment?: { entity: Entity };
    order?: { entity: Entity };
  };
}

function notesOf(entity: Entity | undefined): Record<string, string> {
  // Razorpay sends `notes: []` when empty.
  const n = entity?.notes;
  return n && !Array.isArray(n) ? (n as Record<string, string>) : {};
}

async function resolveAccountId(
  db: ReturnType<typeof supabaseAdmin>,
  notes: Record<string, string>,
  providerRef: string | undefined,
): Promise<string | null> {
  if (notes.account_id) return notes.account_id;
  // Razorpay ids are `sub_…` / `order_…`; anything else never reaches
  // the PostgREST filter string below.
  if (!providerRef || !/^[A-Za-z0-9_]+$/.test(providerRef)) return null;
  const { data } = await db
    .from('subscriptions')
    .select('account_id')
    .or(`provider_subscription_id.eq.${providerRef},pending_provider_ref.eq.${providerRef}`)
    .limit(1)
    .maybeSingle();
  return (data?.account_id as string | undefined) ?? null;
}

export async function POST(request: Request) {
  const secret = await razorpayWebhookSecret();
  if (!secret) {
    console.error('[billing webhook] no Razorpay webhook secret (env or /admin → Payments)');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  const rawBody = await request.text();
  if (!verifyWebhookSignature(secret, rawBody, request.headers.get('x-razorpay-signature'))) {
    console.warn('[billing webhook] rejected request with invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: RazorpayEvent;
  try {
    event = JSON.parse(rawBody) as RazorpayEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const eventId =
    request.headers.get('x-razorpay-event-id') ??
    `${event.event}:${event.payload.payment?.entity.id ?? event.payload.subscription?.entity.id ?? event.payload.order?.entity.id ?? Date.now()}`;

  // Idempotency: insert first; a duplicate means we've seen it.
  const { data: logged, error: logError } = await db
    .from('billing_events')
    .insert({
      provider: 'razorpay',
      event_id: eventId,
      event_type: event.event,
      payload: event as unknown as Record<string, unknown>,
    })
    .select('id')
    .maybeSingle();
  if (logError) {
    if (logError.code === '23505') {
      const { data: prior } = await db
        .from('billing_events')
        .select('id, processed_at')
        .eq('provider', 'razorpay')
        .eq('event_id', eventId)
        .maybeSingle();
      if (prior?.processed_at) return NextResponse.json({ status: 'duplicate' });
      // Seen but not processed (earlier attempt failed) — process again.
    } else {
      console.error('[billing webhook] could not log event:', logError.message);
      return NextResponse.json({ error: 'Storage error' }, { status: 500 });
    }
  }

  try {
    const accountId = await handleEvent(db, event);
    await db
      .from('billing_events')
      .update({ processed_at: new Date().toISOString(), error: null, account_id: accountId })
      .eq('provider', 'razorpay')
      .eq('event_id', eventId);
    return NextResponse.json({ status: 'ok', id: logged?.id ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[billing webhook] processing failed:', event.event, message);
    await db
      .from('billing_events')
      .update({ error: message.slice(0, 1000) })
      .eq('provider', 'razorpay')
      .eq('event_id', eventId);
    // 500 → Razorpay retries with backoff.
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

async function handleEvent(
  db: ReturnType<typeof supabaseAdmin>,
  event: RazorpayEvent,
): Promise<string | null> {
  const subscription = event.payload.subscription?.entity;
  const payment = event.payload.payment?.entity;
  const order = event.payload.order?.entity;

  // Add-on subscriptions carry notes.kind = 'addon'.
  if (subscription && notesOf(subscription).kind === 'addon') {
    const notes = notesOf(subscription);
    if (event.event === 'subscription.activated' || event.event === 'subscription.charged') {
      if (!notes.account_id || !notes.addon_code) throw new Error(`add-on ${subscription.id} has no account/add-on notes`);
      await activateAddon(db, {
        accountId: notes.account_id,
        addonCode: notes.addon_code,
        quantity: Number(notes.quantity ?? 1),
        providerSubscriptionId: subscription.id,
      });
      if (payment) {
        await recordPayment(db, {
          accountId: notes.account_id,
          paymentId: payment.id,
          invoiceId: (payment.invoice_id as string | null) ?? null,
          planCode: null,
          interval: 'monthly',
          amountPaise: Number(payment.amount ?? 0),
          currency: (payment.currency as string | undefined) ?? 'INR',
          status: (payment.status as string | undefined) ?? 'captured',
          paidAt: unixToIso(payment.created_at as number | null),
        });
      }
    } else if (['subscription.halted', 'subscription.cancelled', 'subscription.completed'].includes(event.event)) {
      await removeAddon(db, subscription.id);
    }
    return notes.account_id ?? null;
  }

  switch (event.event) {
    case 'subscription.activated':
    case 'subscription.charged': {
      if (!subscription) return null;
      const notes = notesOf(subscription);
      const accountId = await resolveAccountId(db, notes, subscription.id);
      if (!accountId || !notes.plan_code) {
        throw new Error(`cannot map subscription ${subscription.id} to an account/plan`);
      }
      await activateRecurring(db, {
        accountId,
        planCode: notes.plan_code,
        providerSubscriptionId: subscription.id,
        periodStart: unixToIso(subscription.current_start as number | null),
        periodEnd: unixToIso(subscription.current_end as number | null),
      });
      if (payment) {
        await recordPayment(db, {
          accountId,
          paymentId: payment.id,
          invoiceId: (payment.invoice_id as string | null) ?? null,
          planCode: notes.plan_code,
          interval: 'monthly',
          amountPaise: Number(payment.amount ?? 0),
          currency: (payment.currency as string | undefined) ?? 'INR',
          status: (payment.status as string | undefined) ?? 'captured',
          paidAt: unixToIso(payment.created_at as number | null),
        });
      }
      return accountId;
    }

    case 'subscription.pending':
    case 'subscription.halted': {
      if (!subscription) return null;
      await markPastDue(db, subscription.id);
      return resolveAccountId(db, notesOf(subscription), subscription.id);
    }

    case 'subscription.cancelled':
    case 'subscription.completed': {
      if (!subscription) return null;
      await markCanceled(db, subscription.id, unixToIso(subscription.current_end as number | null));
      return resolveAccountId(db, notesOf(subscription), subscription.id);
    }

    case 'order.paid': {
      if (!order) return null;
      const notes = notesOf(order);
      if (notes.interval !== 'annual' || !notes.plan_code) return null;
      const accountId = await resolveAccountId(db, notes, order.id);
      if (!accountId) throw new Error(`cannot map order ${order.id} to an account`);
      await activateAnnual(db, { accountId, planCode: notes.plan_code, orderId: order.id });
      if (payment) {
        await recordPayment(db, {
          accountId,
          paymentId: payment.id,
          planCode: notes.plan_code,
          interval: 'annual' as BillingInterval,
          amountPaise: Number(payment.amount ?? order.amount ?? 0),
          currency: (payment.currency as string | undefined) ?? 'INR',
          status: (payment.status as string | undefined) ?? 'captured',
          paidAt: unixToIso(payment.created_at as number | null),
        });
      }
      return accountId;
    }

    default:
      return null;
  }
}
