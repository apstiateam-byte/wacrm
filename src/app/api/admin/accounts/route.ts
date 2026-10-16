// ============================================================
// GET /api/admin/accounts — every workspace on the platform with its
// plan, lifecycle status, MRR and headline usage. Platform admins only.
//
//   ?q=       workspace name or owner email
//   ?status=  trialing | trial_expired | active | past_due | canceled |
//             expired | suspended | demo
//   ?plan=    plan code
//   ?sort=    newest (default) | oldest | mrr | name
//   ?page=    0-based, 25 per page
// ============================================================

import { NextResponse } from 'next/server';

import { toErrorResponse } from '@/lib/auth/account';
import { requirePlatformAdmin } from '@/lib/billing/admin-guard';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { fetchAll, safeSearch } from '@/lib/admin/data';
import { customerStatus, subscriptionMrr, type CustomerStatus, type PlanPriceRow, type SubRow } from '@/lib/admin/metrics';
import type { Entitlements } from '@/lib/billing/types';

const PAGE_SIZE = 25;

export interface AdminAccountRow {
  id: string;
  name: string;
  owner_email: string | null;
  owner_name: string | null;
  created_at: string;
  suspended_at: string | null;
  is_demo: boolean;
  limit_overrides: Record<string, unknown>;
  status: CustomerStatus;
  plan_name: string | null;
  mrr_inr: number;
  members: number;
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

interface AccountBase {
  id: string;
  name: string;
  owner_user_id: string;
  created_at: string;
  suspended_at: string | null;
  limit_overrides: Record<string, unknown> | null;
  is_demo: boolean | null;
}

type FullSub = SubRow & { cancel_at_period_end: boolean | null; provider: string | null };

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin();
    const db = supabaseAdmin();
    const url = new URL(request.url);
    const q = safeSearch(url.searchParams.get('q'));
    const statusFilter = url.searchParams.get('status') ?? '';
    const planFilter = url.searchParams.get('plan') ?? '';
    const sort = url.searchParams.get('sort') ?? 'newest';
    const page = Math.max(0, Number.parseInt(url.searchParams.get('page') ?? '0', 10) || 0);

    const [accounts, subs, plans] = await Promise.all([
      fetchAll<AccountBase>(() =>
        db
          .from('accounts')
          .select('id, name, owner_user_id, created_at, suspended_at, limit_overrides, is_demo')
          .order('created_at', { ascending: false }),
      ),
      fetchAll<FullSub>(() =>
        db
          .from('subscriptions')
          .select('account_id, plan_code, status, billing_interval, trial_ends_at, current_period_end, cancel_at_period_end, provider')
          .order('account_id'),
      ),
      db.from('plans').select('code, name, price_inr_monthly, price_inr_annual'),
    ]);
    const priceBy = new Map(((plans.data ?? []) as PlanPriceRow[]).map((p) => [p.code, p]));
    const subBy = new Map(subs.map((s) => [s.account_id, s]));

    // Owner-email search needs the profiles table.
    let ownerMatches: Set<string> | null = null;
    if (q) {
      const { data: owners } = await db.from('profiles').select('user_id').ilike('email', `%${q}%`).limit(200);
      ownerMatches = new Set((owners ?? []).map((o) => o.user_id as string));
    }

    const now = Date.now();
    let rows = accounts
      .map((a) => {
        const sub = subBy.get(a.id) ?? null;
        return {
          a,
          sub,
          status: customerStatus(sub, now),
          mrr: sub ? subscriptionMrr(sub, priceBy) : 0,
        };
      })
      .filter(({ a, sub, status }) => {
        if (q && !a.name.toLowerCase().includes(q.toLowerCase()) && !ownerMatches?.has(a.owner_user_id)) return false;
        if (planFilter && sub?.plan_code !== planFilter) return false;
        if (statusFilter === 'suspended') return !!a.suspended_at;
        if (statusFilter === 'demo') return a.is_demo === true;
        if (statusFilter) return status === statusFilter && !a.is_demo;
        return true;
      });

    if (sort === 'oldest') rows = rows.reverse();
    else if (sort === 'mrr') rows.sort((x, y) => y.mrr - x.mrr);
    else if (sort === 'name') rows.sort((x, y) => x.a.name.localeCompare(y.a.name));

    const total = rows.length;
    const pageRows = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
    const ids = pageRows.map((r) => r.a.id);
    const ownerIds = pageRows.map((r) => r.a.owner_user_id);

    const [addons, owners, members, ents] = await Promise.all([
      ids.length
        ? db.from('subscription_addons').select('account_id, addon_code, quantity').in('account_id', ids)
        : Promise.resolve({ data: [] }),
      ownerIds.length
        ? db.from('profiles').select('user_id, email, full_name').in('user_id', ownerIds)
        : Promise.resolve({ data: [] }),
      ids.length ? db.from('profiles').select('account_id').in('account_id', ids) : Promise.resolve({ data: [] }),
      Promise.all(
        ids.map((id) =>
          db
            .rpc('account_entitlements', { p_account_id: id })
            .then(({ data }) => [id, (data as Entitlements | null) ?? null] as const),
        ),
      ),
    ]);

    const ownerBy = new Map((owners.data ?? []).map((o) => [o.user_id as string, o]));
    const memberCount = new Map<string, number>();
    for (const m of members.data ?? []) {
      memberCount.set(m.account_id as string, (memberCount.get(m.account_id as string) ?? 0) + 1);
    }
    const entBy = new Map(ents);

    const result: AdminAccountRow[] = pageRows.map(({ a, sub, status, mrr }) => {
      const owner = ownerBy.get(a.owner_user_id);
      return {
        id: a.id,
        name: a.name,
        owner_email: (owner?.email as string | undefined) ?? null,
        owner_name: (owner?.full_name as string | undefined) ?? null,
        created_at: a.created_at,
        suspended_at: a.suspended_at ?? null,
        is_demo: a.is_demo === true,
        limit_overrides: a.limit_overrides ?? {},
        status,
        plan_name: sub ? (priceBy.get(sub.plan_code)?.name ?? sub.plan_code) : null,
        mrr_inr: mrr,
        members: memberCount.get(a.id) ?? 0,
        subscription: sub
          ? {
              plan_code: sub.plan_code,
              status: sub.status,
              billing_interval: sub.billing_interval ?? null,
              trial_ends_at: sub.trial_ends_at ?? null,
              current_period_end: sub.current_period_end ?? null,
              cancel_at_period_end: sub.cancel_at_period_end === true,
              provider: sub.provider ?? null,
            }
          : null,
        addons: (addons.data ?? [])
          .filter((x) => x.account_id === a.id)
          .map((x) => ({ addon_code: x.addon_code as string, quantity: Number(x.quantity) })),
        entitlements: entBy.get(a.id) ?? null,
      };
    });

    return NextResponse.json({ accounts: result, total, page, page_size: PAGE_SIZE });
  } catch (err) {
    return toErrorResponse(err);
  }
}
