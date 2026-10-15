// ============================================================
// POST /api/demo/start — "Try live demo" from the marketing site.
//
// Signs the visitor into the shared demo workspace (session cookies
// set on this response) and answers { redirect: '/dashboard' }. 404
// unless DEMO_ENABLED=true.
// ============================================================

import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { demoEnabled, ensureDemoAccount, rotateDemoPassword } from '@/lib/demo/server';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { getT } from '@/lib/i18n/translate';

const t = getT('Api.demo');

function clientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function POST(request: Request) {
  if (!demoEnabled()) {
    return NextResponse.json({ error: t('disabled') }, { status: 404 });
  }

  // Each start rotates the demo password and creates a session; bound
  // it per IP so a script can't churn sessions.
  const limit = checkRateLimit(`demo-start:${clientIp(request)}`, { limit: 10, windowMs: 60_000 });
  if (!limit.success) return rateLimitResponse(limit);

  try {
    const demo = await ensureDemoAccount();
    const password = await rotateDemoPassword(demo.userId);
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: demo.email, password });
    if (error) throw error;
    return NextResponse.json({ redirect: '/dashboard' });
  } catch (err) {
    console.error('[demo start] failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: t('startFailed') }, { status: 500 });
  }
}
