// ============================================================
// The shared "Try live demo" workspace.
//
// Off unless DEMO_ENABLED=true. The demo user and workspace are created
// on first use, put on the top plan for 10 years (manual provider, so
// billing never touches it) and seeded with sample data. Server-only.
// ============================================================

import { randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import { supabaseAdmin } from '@/lib/flows/admin-client';
import { ForbiddenError } from '@/lib/auth/account';
import { getT } from '@/lib/i18n/translate';
import { seedDemoAccount } from './seed';

const t = getT('Api.demo');

const DEMO_PLAN = 'pro';
const DEMO_WORKSPACE_NAME = 'Acme Retail (demo)';

export function demoEnabled(): boolean {
  return process.env.DEMO_ENABLED === 'true';
}

export function demoEmail(): string {
  return process.env.DEMO_USER_EMAIL?.trim() || 'demo@demo.invalid';
}

export interface DemoAccount {
  accountId: string;
  userId: string;
  email: string;
}

async function findDemo(db: SupabaseClient): Promise<DemoAccount | null> {
  const { data } = await db
    .from('accounts')
    .select('id, owner_user_id')
    .eq('is_demo', true)
    .maybeSingle();
  return data ? { accountId: data.id as string, userId: data.owner_user_id as string, email: demoEmail() } : null;
}

/** Find the demo workspace, creating and seeding it the first time. */
export async function ensureDemoAccount(db: SupabaseClient = supabaseAdmin()): Promise<DemoAccount> {
  const existing = await findDemo(db);
  if (existing) return existing;

  const email = demoEmail();
  const { data: created, error } = await db.auth.admin.createUser({
    email,
    password: randomBytes(24).toString('base64url'),
    email_confirm: true,
    user_metadata: { full_name: 'Demo Team' },
  });
  let userId = created?.user?.id;
  if (error || !userId) {
    // The user may exist from an earlier, half-finished bootstrap.
    const { data: profile } = await db.from('profiles').select('user_id').eq('email', email).maybeSingle();
    if (!profile) throw new Error(`[demo] could not create demo user: ${error?.message ?? 'unknown'}`);
    userId = profile.user_id as string;
  }

  // The signup trigger created the user's personal account; turn it
  // into the demo workspace.
  const { data: profile } = await db.from('profiles').select('account_id').eq('user_id', userId).maybeSingle();
  const accountId = profile?.account_id as string | undefined;
  if (!accountId) throw new Error('[demo] demo user has no account');

  await db.from('accounts').update({ is_demo: true, name: DEMO_WORKSPACE_NAME, default_currency: 'INR' }).eq('id', accountId);
  await db.from('subscriptions').upsert(
    {
      account_id: accountId,
      plan_code: DEMO_PLAN,
      status: 'active',
      provider: 'manual',
      billing_interval: 'annual',
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 10 * 365 * 86_400_000).toISOString(),
    },
    { onConflict: 'account_id' },
  );
  await seedDemoAccount(db, accountId, userId);
  return { accountId, userId, email };
}

/** Wipe and re-seed the demo workspace (nightly job). */
export async function resetDemoAccount(db: SupabaseClient = supabaseAdmin()): Promise<boolean> {
  const demo = await findDemo(db);
  if (!demo) return false;
  await seedDemoAccount(db, demo.accountId, demo.userId);
  return true;
}

/**
 * Give the demo user a fresh random password and return it. Every
 * "Try live demo" click does this right before signing in, so a visitor
 * who changes the password can't lock the next one out.
 */
export async function rotateDemoPassword(userId: string, db: SupabaseClient = supabaseAdmin()): Promise<string> {
  const password = randomBytes(24).toString('base64url');
  const { error } = await db.auth.admin.updateUserById(userId, { password });
  if (error) throw new Error(`[demo] could not set demo password: ${error.message}`);
  return password;
}

export async function isDemoAccount(accountId: string, db: SupabaseClient = supabaseAdmin()): Promise<boolean> {
  try {
    const { data } = await db.from('accounts').select('is_demo').eq('id', accountId).maybeSingle();
    return data?.is_demo === true;
  } catch {
    return false;
  }
}

/**
 * Refuse actions that would spoil the shared demo for the next visitor:
 * team members, API keys, the WhatsApp connection, billing, AI keys.
 */
export async function assertNotDemo(accountId: string): Promise<void> {
  if (await isDemoAccount(accountId)) {
    throw new ForbiddenError(t('blocked'));
  }
}
