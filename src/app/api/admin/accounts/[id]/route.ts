// ============================================================
// PATCH /api/admin/accounts/:id — operator changes to one workspace.
//
// Body (every field optional):
//   plan_code          switch plan (manual / sales-led deals)
//   status             trialing | active | past_due | canceled | expired
//   billing_interval   monthly | annual | null
//   trial_ends_at      ISO timestamp — extend or end a trial
//   current_period_end ISO timestamp — grant paid time manually
//   suspended          true | false
//   limit_overrides    { limits: { key: number|null }, features: { key: bool } }
//   addons             { addon_code: quantity } — 0 removes
//
// Manual changes set provider = 'manual' only when no provider is
// attached yet, so a Razorpay-managed subscription keeps receiving its
// webhooks.
// ============================================================

import { NextResponse } from 'next/server';

import { toErrorResponse } from '@/lib/auth/account';
import { requirePlatformAdmin } from '@/lib/billing/admin-guard';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { FEATURE_KEYS, LIMIT_KEYS } from '@/lib/billing/types';
import { customerStatus, subscriptionMrr, type PlanPriceRow, type SubRow } from '@/lib/admin/metrics';

const STATUSES = ['trialing', 'active', 'past_due', 'canceled', 'expired'] as const;

function isoOrNull(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function cleanOverrides(raw: unknown): Record<string, Record<string, unknown>> | null {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw as { limits?: Record<string, unknown>; features?: Record<string, unknown> };
  const limits: Record<string, number | null> = {};
  for (const key of LIMIT_KEYS) {
    const v = src.limits?.[key];
    if (v === null) limits[key] = null;
    else if (typeof v === 'number' && Number.isFinite(v) && v >= 0) limits[key] = Math.floor(v);
  }
  const features: Record<string, boolean> = {};
  for (const key of FEATURE_KEYS) {
    const v = src.features?.[key];
    if (typeof v === 'boolean') features[key] = v;
  }
  return { limits, features };
}

const COUNTED_TABLES = ['contacts', 'conversations', 'deals', 'broadcasts', 'automations', 'flows', 'message_templates'] as const;

/**
 * GET /api/admin/accounts/:id — everything the operator needs about one
 * customer: workspace + billing details, team, subscription, usage,
 * WhatsApp connection (never the token), payments and webhook history.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requirePlatformAdmin();
    const { id } = await context.params;
    const db = supabaseAdmin();

    const { data: account } = await db
      .from('accounts')
      .select(
        'id, name, owner_user_id, created_at, updated_at, suspended_at, is_demo, limit_overrides, billing_name, billing_email, billing_gstin, billing_address, billing_state',
      )
      .eq('id', id)
      .maybeSingle();
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    const [sub, addons, ents, members, whatsapp, payments, events, lastConversation, plans, ...counts] =
      await Promise.all([
        db
          .from('subscriptions')
          .select(
            'plan_code, status, billing_interval, trial_ends_at, current_period_start, current_period_end, cancel_at_period_end, provider, provider_subscription_id, pending_plan_code, pending_interval, created_at, updated_at',
          )
          .eq('account_id', id)
          .maybeSingle(),
        db.from('subscription_addons').select('addon_code, quantity, cancel_at_period_end, provider_subscription_id').eq('account_id', id),
        db.rpc('account_entitlements', { p_account_id: id }),
        db
          .from('profiles')
          .select('user_id, full_name, email, account_role, created_at')
          .eq('account_id', id)
          .order('created_at'),
        db
          .from('whatsapp_config')
          .select('phone_number_id, waba_id, status, connected_at, updated_at')
          .eq('account_id', id)
          .maybeSingle(),
        db
          .from('billing_payments')
          .select('id, provider, provider_payment_id, provider_invoice_id, plan_code, billing_interval, amount_paise, currency, status, invoice_url, paid_at, created_at')
          .eq('account_id', id)
          .order('created_at', { ascending: false })
          .limit(100),
        db
          .from('billing_events')
          .select('id, event_type, event_id, processed_at, error, created_at, payload')
          .eq('account_id', id)
          .order('created_at', { ascending: false })
          .limit(50),
        db
          .from('conversations')
          .select('last_message_at')
          .eq('account_id', id)
          .not('last_message_at', 'is', null)
          .order('last_message_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        db.from('plans').select('code, name, price_inr_monthly, price_inr_annual'),
        ...COUNTED_TABLES.map((table) =>
          db.from(table).select('id', { count: 'exact', head: true }).eq('account_id', id),
        ),
      ]);

    // Last sign-in lives in auth.users — a handful of members at most.
    const team = await Promise.all(
      (members.data ?? []).map(async (m) => {
        const { data } = await db.auth.admin.getUserById(m.user_id as string);
        return {
          user_id: m.user_id as string,
          full_name: m.full_name as string,
          email: m.email as string,
          role: m.account_role as string,
          is_owner: m.user_id === account.owner_user_id,
          joined_at: m.created_at as string,
          last_sign_in_at: data.user?.last_sign_in_at ?? null,
        };
      }),
    );

    const planRows = plans.data ?? [];
    const subRow = sub.data;
    const plan = subRow ? planRows.find((p) => p.code === subRow.plan_code) : null;
    const collected = (payments.data ?? [])
      .filter((p) => p.status === 'captured' || p.status === 'paid')
      .reduce((sum, p) => sum + Number(p.amount_paise), 0);

    return NextResponse.json({
      account,
      subscription: subRow
        ? {
            ...subRow,
            plan_name: plan?.name ?? subRow.plan_code,
            status_bucket: customerStatus(subRow),
            mrr_inr: subscriptionMrr({ ...subRow, account_id: id } as SubRow, new Map(planRows.map((p) => [p.code as string, p as PlanPriceRow]))),
          }
        : null,
      addons: addons.data ?? [],
      entitlements: ents.data ?? null,
      team,
      whatsapp: whatsapp.data ?? null,
      counts: Object.fromEntries(COUNTED_TABLES.map((table, i) => [table, counts[i]?.count ?? 0])),
      last_activity_at: (lastConversation.data?.last_message_at as string | undefined) ?? null,
      payments: payments.data ?? [],
      lifetime_value_paise: collected,
      events: events.data ?? [],
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requirePlatformAdmin();
    const { id } = await context.params;
    const db = supabaseAdmin();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const { data: account } = await db.from('accounts').select('id').eq('id', id).maybeSingle();
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    // ---- subscription -------------------------------------------
    const subPatch: Record<string, unknown> = {};
    if (typeof body.plan_code === 'string') {
      const { data: plan } = await db.from('plans').select('code').eq('code', body.plan_code).maybeSingle();
      if (!plan) return NextResponse.json({ error: 'Unknown plan' }, { status: 400 });
      subPatch.plan_code = body.plan_code;
    }
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status as (typeof STATUSES)[number])) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      subPatch.status = body.status;
    }
    if (body.billing_interval !== undefined) {
      if (![null, 'monthly', 'annual'].includes(body.billing_interval as string | null)) {
        return NextResponse.json({ error: 'Invalid billing_interval' }, { status: 400 });
      }
      subPatch.billing_interval = body.billing_interval;
    }
    for (const field of ['trial_ends_at', 'current_period_end'] as const) {
      if (body[field] !== undefined) {
        const value = isoOrNull(body[field]);
        if (value === undefined) {
          return NextResponse.json({ error: `Invalid ${field}` }, { status: 400 });
        }
        subPatch[field] = value;
      }
    }

    if (Object.keys(subPatch).length > 0) {
      const { data: existing } = await db
        .from('subscriptions')
        .select('plan_code, provider')
        .eq('account_id', id)
        .maybeSingle();
      const row: Record<string, unknown> = {
        account_id: id,
        plan_code: existing?.plan_code ?? 'trial',
        ...subPatch,
      };
      if (!existing?.provider) row.provider = 'manual';
      const { error } = await db.from('subscriptions').upsert(row, { onConflict: 'account_id' });
      if (error) throw error;
    }

    // ---- account ------------------------------------------------
    const accountPatch: Record<string, unknown> = {};
    if (typeof body.suspended === 'boolean') {
      accountPatch.suspended_at = body.suspended ? new Date().toISOString() : null;
    }
    if (body.limit_overrides !== undefined) {
      const overrides = cleanOverrides(body.limit_overrides);
      if (!overrides) return NextResponse.json({ error: 'Invalid limit_overrides' }, { status: 400 });
      accountPatch.limit_overrides = overrides;
    }
    if (Object.keys(accountPatch).length > 0) {
      const { error } = await db.from('accounts').update(accountPatch).eq('id', id);
      if (error) throw error;
    }

    // ---- add-ons ------------------------------------------------
    if (body.addons && typeof body.addons === 'object') {
      for (const [code, qty] of Object.entries(body.addons as Record<string, unknown>)) {
        const quantity = typeof qty === 'number' && Number.isFinite(qty) ? Math.max(0, Math.floor(qty)) : null;
        if (quantity === null) {
          return NextResponse.json({ error: `Invalid quantity for ${code}` }, { status: 400 });
        }
        if (quantity === 0) {
          await db.from('subscription_addons').delete().eq('account_id', id).eq('addon_code', code);
        } else {
          const { error } = await db
            .from('subscription_addons')
            .upsert({ account_id: id, addon_code: code, quantity }, { onConflict: 'account_id,addon_code' });
          if (error) {
            return NextResponse.json({ error: `Unknown add-on ${code}` }, { status: 400 });
          }
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
