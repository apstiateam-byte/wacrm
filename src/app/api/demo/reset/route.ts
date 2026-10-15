// ============================================================
// GET /api/demo/reset — wipe and re-seed the live-demo workspace.
//
// Call nightly from your scheduler with the same secret as the other
// cron routes (`x-cron-secret` or `Authorization: Bearer`).
// ============================================================

import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

import { suppliedCronSecret } from '@/lib/cron-auth';
import { demoEnabled, resetDemoAccount } from '@/lib/demo/server';

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
  if (!demoEnabled()) {
    return NextResponse.json({ status: 'demo disabled' });
  }

  try {
    const reset = await resetDemoAccount();
    return NextResponse.json({ status: reset ? 'reset' : 'no demo workspace yet' });
  } catch (err) {
    console.error('[demo reset] failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 });
  }
}
