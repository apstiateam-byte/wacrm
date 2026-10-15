// ============================================================
// Server-side billing helpers: read entitlements, enforce plan
// features / limits / read-only state in API routes.
//
// Server-only (service-role client). Every check defers to the SQL
// functions from migration 047, so a self-hosted install with billing
// disabled gets "unlimited / writable" from all of them.
// ============================================================

import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { supabaseAdmin } from '@/lib/flows/admin-client';
import type { Entitlements, FeatureKey, LimitKey, PlanLimitPayload } from './types';
import { getT } from '@/lib/i18n/translate';

const t = getT('Api.billing');

/**
 * A plan forbids the request: limit reached, feature not included, or
 * the account is read-only. Answers HTTP 402 with a machine-readable
 * body the UI turns into an upgrade prompt.
 */
export class PlanLimitError extends Error {
  readonly status = 402 as const;
  readonly payload: PlanLimitPayload;

  constructor(payload: PlanLimitPayload, message: string) {
    super(message);
    this.name = 'PlanLimitError';
    this.payload = payload;
  }

  toResponse(): NextResponse {
    return NextResponse.json({ error: this.message, ...this.payload }, { status: this.status });
  }
}

function admin(client?: SupabaseClient): SupabaseClient {
  return client ?? supabaseAdmin();
}

/**
 * Call a billing SQL function, never throwing: a client that can't be
 * built, a network blip, or a database without migration 047 all come
 * back as `{ error }`, and every check below then fails OPEN. Billing
 * must never be the reason the product stops working.
 */
async function billingRpc<T>(
  client: SupabaseClient | undefined,
  fn: string,
  args: Record<string, unknown>,
): Promise<{ data: T | null; error: { message: string } | null }> {
  try {
    const { data, error } = await admin(client).rpc(fn, args);
    return { data: (data as T) ?? null, error: error ? { message: error.message } : null };
  } catch (err) {
    return { data: null, error: { message: err instanceof Error ? err.message : String(err) } };
  }
}

export async function getEntitlements(
  accountId: string,
  client?: SupabaseClient,
): Promise<Entitlements> {
  const { data, error } = await admin(client).rpc('account_entitlements', {
    p_account_id: accountId,
  });
  if (error) throw error;
  return data as Entitlements;
}

/** True unless the account's trial / subscription has lapsed. */
export async function isAccountWritable(accountId: string, client?: SupabaseClient): Promise<boolean> {
  const { data, error } = await billingRpc<boolean>(client, 'account_is_writable', {
    p_account_id: accountId,
  });
  if (error) {
    // Fail open: a billing lookup error must never take the product down.
    console.error('[billing] account_is_writable failed:', error.message);
    return true;
  }
  return data !== false;
}

export async function hasFeature(
  accountId: string,
  feature: FeatureKey,
  client?: SupabaseClient,
): Promise<boolean> {
  const { data, error } = await billingRpc<boolean>(client, 'account_feature', {
    p_account_id: accountId,
    p_key: feature,
  });
  if (error) {
    console.error('[billing] account_feature failed:', error.message);
    return true;
  }
  return data !== false;
}

export async function assertWritable(accountId: string, client?: SupabaseClient): Promise<void> {
  if (!(await isAccountWritable(accountId, client))) {
    throw new PlanLimitError({ code: 'account_read_only' }, t('readOnly'));
  }
}

export async function assertFeature(
  accountId: string,
  feature: FeatureKey,
  client?: SupabaseClient,
): Promise<void> {
  await assertWritable(accountId, client);
  if (!(await hasFeature(accountId, feature, client))) {
    throw new PlanLimitError(
      { code: 'feature_not_in_plan', key: feature },
      t('featureNotInPlan', { feature: t(`features.${feature}`) }),
    );
  }
}

/**
 * App-layer count check for service-role paths that the database
 * triggers deliberately skip (the public API). `table` must be a
 * fixed table name, never user input.
 */
export async function assertCountBelowLimit(
  accountId: string,
  key: LimitKey,
  table: string,
  client?: SupabaseClient,
): Promise<void> {
  const { data: limit, error } = await billingRpc<number>(client, 'account_limit', {
    p_account_id: accountId,
    p_key: key,
  });
  if (error) {
    console.error('[billing] account_limit failed:', error.message);
    return;
  }
  if (limit == null) return;
  const { count } = await admin(client)
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('account_id', accountId);
  if ((count ?? 0) >= Number(limit)) {
    throw new PlanLimitError(
      { code: 'plan_limit_reached', key, limit: Number(limit) },
      t('limitReached', { limit: Number(limit), what: t(`limits.${key}`) }),
    );
  }
}

/**
 * Reserve `amount` of the monthly broadcast-recipient allowance.
 * Throws PlanLimitError (nothing reserved) when it would exceed the
 * limit. Pair with `releaseBroadcastRecipients` for sends that end up
 * not going out.
 */
export async function reserveBroadcastRecipients(
  accountId: string,
  amount: number,
  client?: SupabaseClient,
): Promise<void> {
  if (amount <= 0) return;
  const { data, error } = await billingRpc<unknown>(client, 'consume_usage', {
    p_account_id: accountId,
    p_metric: 'broadcast_recipients',
    p_amount: amount,
    p_limit_key: 'broadcast_recipients_monthly',
  });
  if (error) {
    console.error('[billing] consume_usage failed:', error.message);
    return;
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | { allowed: boolean; used: number; limit_value: number | null }
    | undefined;
  if (row && row.allowed === false) {
    const remaining = Math.max(0, Number(row.limit_value ?? 0) - Number(row.used));
    throw new PlanLimitError(
      { code: 'plan_limit_reached', key: 'broadcast_recipients_monthly', limit: row.limit_value },
      t('broadcastQuota', { remaining, limit: Number(row.limit_value ?? 0) }),
    );
  }
}

export async function releaseBroadcastRecipients(
  accountId: string,
  amount: number,
  client?: SupabaseClient,
): Promise<void> {
  if (amount <= 0) return;
  const { error } = await billingRpc<null>(client, 'release_usage', {
    p_account_id: accountId,
    p_metric: 'broadcast_recipients',
    p_amount: amount,
  });
  if (error) console.error('[billing] release_usage failed:', error.message);
}

export async function isPlatformAdmin(userId: string, client?: SupabaseClient): Promise<boolean> {
  try {
    const { data } = await admin(client)
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();
    return !!data;
  } catch {
    // Fail CLOSED here: this gates the operator console.
    return false;
  }
}
