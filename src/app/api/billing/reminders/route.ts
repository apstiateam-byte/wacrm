// ============================================================
// GET /api/billing/reminders — send due billing emails (trial ending,
// trial ended, payment failed, annual renewal). Schedule hourly or
// daily with the cron secret (`x-cron-secret` or `Authorization:
// Bearer`). Safe to over-run: each reminder is sent once.
// ============================================================

import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

import { suppliedCronSecret } from '@/lib/cron-auth';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { runBillingReminders } from '@/lib/billing/reminders';

export async function GET(request: Request) {
  const expected = process.env.AUTOMATION_CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: 'cron not configured' }, { status: 503 });
  }
  const supplied = Buffer.from(suppliedCronSecret(request));
  const wanted = Buffer.from(expected);
  if (supplied.length !== wanted.length || !timingSafeEqual(supplied, wanted)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runBillingReminders(supabaseAdmin());
    return NextResponse.json(result);
  } catch (err) {
    console.error('[billing reminders] failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Reminder run failed' }, { status: 500 });
  }
}
