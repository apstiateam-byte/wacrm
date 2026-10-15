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
