// ============================================================
// GET /api/admin/payments — every customer payment on the platform.
// Platform admins only.
//
//   ?q=        payment id (pay_…) or workspace name / owner email
//   ?status=   captured | failed | refunded | …
//   ?from= &to=  YYYY-MM-DD (inclusive, UTC)
//   ?page=     0-based, 50 per page
//   ?format=csv  the whole filtered set as a CSV download
// ============================================================

import { NextResponse } from 'next/server';

import { toErrorResponse } from '@/lib/auth/account';
import { requirePlatformAdmin } from '@/lib/billing/admin-guard';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { accountLabels, fetchAll, safeSearch } from '@/lib/admin/data';
import { isCollected } from '@/lib/admin/metrics';

const PAGE_SIZE = 50;
const COLUMNS =
  'id, account_id, provider, provider_payment_id, provider_invoice_id, plan_code, billing_interval, amount_paise, currency, status, invoice_url, paid_at, created_at';

interface PaymentRecord {
  id: string;
  account_id: string;
  provider: string;
  provider_payment_id: string;
  provider_invoice_id: string | null;
  plan_code: string | null;
  billing_interval: string | null;
  amount_paise: number;
  currency: string;
  status: string;
  invoice_url: string | null;
  paid_at: string | null;
  created_at: string;
}

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  // Quote everything; neutralise spreadsheet formulas.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin();
    const db = supabaseAdmin();
    const url = new URL(request.url);
    const q = safeSearch(url.searchParams.get('q'));
    const status = url.searchParams.get('status') ?? '';
    const from = url.searchParams.get('from') ?? '';
    const to = url.searchParams.get('to') ?? '';
    const page = Math.max(0, Number.parseInt(url.searchParams.get('page') ?? '0', 10) || 0);
    const asCsv = url.searchParams.get('format') === 'csv';

    // Resolve a name / email search to account ids first.
    let accountFilter: string[] | null = null;
    if (q && !q.startsWith('pay_')) {
      const [{ data: byName }, { data: owners }] = await Promise.all([
        db.from('accounts').select('id').ilike('name', `%${q}%`).limit(200),
        db.from('profiles').select('account_id').ilike('email', `%${q}%`).limit(200),
      ]);
      accountFilter = [
        ...new Set([...(byName ?? []).map((a) => a.id as string), ...(owners ?? []).map((o) => o.account_id as string)]),
      ].filter(Boolean);
      if (!accountFilter.length) {
        return NextResponse.json({ payments: [], total: 0, page, page_size: PAGE_SIZE, summary: { collected_inr: 0, count: 0, failed: 0, refunded: 0 } });
      }
    }

    const build = () => {
      let query = db.from('billing_payments').select(COLUMNS).order('created_at', { ascending: false });
      if (q.startsWith('pay_')) query = query.ilike('provider_payment_id', `%${q}%`);
      if (accountFilter) query = query.in('account_id', accountFilter);
      if (status) query = query.eq('status', status);
      if (/^\d{4}-\d{2}-\d{2}$/.test(from)) query = query.gte('created_at', `${from}T00:00:00Z`);
      if (/^\d{4}-\d{2}-\d{2}$/.test(to)) query = query.lte('created_at', `${to}T23:59:59.999Z`);
      return query;
    };

    const all = await fetchAll<PaymentRecord>(build);
    const labels = await accountLabels(db, (asCsv ? all : all.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)).map((p) => p.account_id));
    const withLabels = (p: PaymentRecord) => ({
      ...p,
      account_name: labels.get(p.account_id)?.name ?? '—',
      owner_email: labels.get(p.account_id)?.owner_email ?? null,
    });

    if (asCsv) {
      const header = ['Date', 'Workspace', 'Owner email', 'Payment ID', 'Invoice ID', 'Plan', 'Interval', 'Amount', 'Currency', 'Status'];
      const lines = all.map((p) => {
        const r = withLabels(p);
        return [
          r.paid_at ?? r.created_at,
          r.account_name,
          r.owner_email,
          r.provider_payment_id,
          r.provider_invoice_id,
          r.plan_code,
          r.billing_interval,
          (r.amount_paise / 100).toFixed(2),
          r.currency,
          r.status,
        ]
          .map(csvCell)
          .join(',');
      });
      return new NextResponse([header.map(csvCell).join(','), ...lines].join('\r\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="payments-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    const summary = {
      count: all.length,
      collected_inr: Math.round(all.filter(isCollected).reduce((s, p) => s + Number(p.amount_paise), 0)) / 100,
      failed: all.filter((p) => p.status === 'failed').length,
      refunded: all.filter((p) => p.status === 'refunded').length,
    };

    return NextResponse.json({
      payments: all.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE).map(withLabels),
      total: all.length,
      page,
      page_size: PAGE_SIZE,
      summary,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
