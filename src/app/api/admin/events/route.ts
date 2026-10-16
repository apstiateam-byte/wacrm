// ============================================================
// GET /api/admin/events — Razorpay webhook log (billing_events), for
// debugging payments that didn't activate. Platform admins only.
//
//   ?status=  failed (error, not processed) | pending | processed
//   ?type=    event type, e.g. subscription.charged
//   ?page=    0-based, 30 per page
// ============================================================

import { NextResponse } from 'next/server';

import { toErrorResponse } from '@/lib/auth/account';
import { requirePlatformAdmin } from '@/lib/billing/admin-guard';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { accountLabels } from '@/lib/admin/data';

const PAGE_SIZE = 30;

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin();
    const db = supabaseAdmin();
    const url = new URL(request.url);
    const status = url.searchParams.get('status') ?? '';
    const type = (url.searchParams.get('type') ?? '').replace(/[^a-z._]/gi, '');
    const page = Math.max(0, Number.parseInt(url.searchParams.get('page') ?? '0', 10) || 0);

    let query = db
      .from('billing_events')
      .select('id, provider, event_id, event_type, account_id, processed_at, error, created_at, payload', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (status === 'failed') query = query.is('processed_at', null).not('error', 'is', null);
    else if (status === 'pending') query = query.is('processed_at', null).is('error', null);
    else if (status === 'processed') query = query.not('processed_at', 'is', null);
    if (type) query = query.eq('event_type', type);

    const { data, count, error } = await query;
    if (error) throw error;

    const labels = await accountLabels(db, (data ?? []).map((e) => e.account_id as string).filter(Boolean));
    return NextResponse.json({
      events: (data ?? []).map((e) => ({
        ...e,
        account_name: e.account_id ? (labels.get(e.account_id as string)?.name ?? null) : null,
      })),
      total: count ?? 0,
      page,
      page_size: PAGE_SIZE,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
