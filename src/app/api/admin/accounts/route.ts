// ============================================================
// GET /api/admin/accounts?q=&page= — every workspace on the platform
// with its plan, billing state and headline usage. Platform admins only.
// ============================================================

import { NextResponse } from 'next/server';

import { toErrorResponse } from '@/lib/auth/account';
import { requirePlatformAdmin } from '@/lib/billing/admin-guard';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import type { Entitlements } from '@/lib/billing/types';

const PAGE_SIZE = 25;

export interface AdminAccountRow {
  id: string;
  name: string;
  owner_email: string | null;
  created_at: string;
  suspended_at: string | null;
  is_demo: boolean;
  limit_overrides: Record<string, unknown>;
  subscription: {
    plan_code: string;
    status: string;
    billing_interval: string | null;
    trial_ends_at: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    provider: string | null;
  } | null;
  addons: { addon_code: string; quantity: number }[];
  entitlements: Entitlements | null;
}

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin();
    const db = supabaseAdmin();
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100);
    const page = Math.max(0, Number.parseInt(url.searchParams.get('page') ?? '0', 10) || 0);

    let query = db
      .from('accounts')
      .select('id, name, owner_user_id, created_at, suspended_at, limit_overrides, is_demo', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (q) {
      // Match workspace name or the owner's email.
      const { data: owners } = await db
        .from('profiles')
        .select('user_id')
        .ilike('email', `%${q.replace(/[%_,()]/g, '')}%`)
        .limit(50);
      const ownerIds = (owners ?? []).map((o) => o.user_id as string);
      const safe = q.replace(/[%_,()]/g, '');
      query = ownerIds.length
        ? query.or(`name.ilike.%${safe}%,owner_user_id.in.(${ownerIds.join(',')})`)
        : query.ilike('name', `%${safe}%`);
    }
    const { data: accounts, count, error } = await query;
    if (error) throw error;

    const ids = (accounts ?? []).map((a) => a.id as string);
    const ownerIds = (accounts ?? []).map((a) => a.owner_user_id as string);
    const [subs, addons, owners, ents] = await Promise.all([
      ids.length
        ? db
            .from('subscriptions')
            .select('account_id, plan_code, status, billing_interval, trial_ends_at, current_period_end, cancel_at_period_end, provider')
            .in('account_id', ids)
        : Promise.resolve({ data: [] }),
      ids.length
        ? db.from('subscription_addons').select('account_id, addon_code, quantity').in('account_id', ids)
        : Promise.resolve({ data: [] }),
      ownerIds.length
        ? db.from('profiles').select('user_id, email').in('user_id', ownerIds)
        : Promise.resolve({ data: [] }),
      Promise.all(
        ids.map((id) =>
          db
            .rpc('account_entitlements', { p_account_id: id })
            .then(({ data }) => [id, (data as Entitlements | null) ?? null] as const),
        ),
      ),
    ]);

    const subBy = new Map((subs.data ?? []).map((s) => [s.account_id as string, s]));
    const emailBy = new Map((owners.data ?? []).map((o) => [o.user_id as string, o.email as string | null]));
    const entBy = new Map(ents);

    const rows: AdminAccountRow[] = (accounts ?? []).map((a) => {
      const sub = subBy.get(a.id as string);
      return {
        id: a.id as string,
        name: a.name as string,
        owner_email: emailBy.get(a.owner_user_id as string) ?? null,
        created_at: a.created_at as string,
        suspended_at: (a.suspended_at as string | null) ?? null,
        is_demo: a.is_demo === true,
        limit_overrides: (a.limit_overrides as Record<string, unknown>) ?? {},
        subscription: sub
          ? {
              plan_code: sub.plan_code as string,
              status: sub.status as string,
              billing_interval: (sub.billing_interval as string | null) ?? null,
              trial_ends_at: (sub.trial_ends_at as string | null) ?? null,
              current_period_end: (sub.current_period_end as string | null) ?? null,
              cancel_at_period_end: sub.cancel_at_period_end === true,
              provider: (sub.provider as string | null) ?? null,
            }
          : null,
        addons: (addons.data ?? [])
          .filter((x) => x.account_id === a.id)
          .map((x) => ({ addon_code: x.addon_code as string, quantity: Number(x.quantity) })),
        entitlements: entBy.get(a.id as string) ?? null,
      };
    });

    return NextResponse.json({ accounts: rows, total: count ?? rows.length, page, page_size: PAGE_SIZE });
  } catch (err) {
    return toErrorResponse(err);
  }
}
