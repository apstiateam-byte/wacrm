// ============================================================
// End-to-end billing checks against a REAL Supabase stack (migration
// 047 + 048 applied). Skipped unless these are set:
//
//   BILLING_IT_URL          e.g. http://127.0.0.1:54321
//   BILLING_IT_SERVICE_KEY  service-role key of that stack
//   BILLING_IT_ANON_KEY     anon key of that stack
//
// Run:  supabase start   (in a scratch copy is fine), then
//       BILLING_IT_URL=... BILLING_IT_SERVICE_KEY=... BILLING_IT_ANON_KEY=... \
//         npx vitest run src/lib/billing/billing.integration.test.ts
//
// NEVER point this at production: it flips platform billing on and off
// and creates throwaway users.
// ============================================================

import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.BILLING_IT_URL;
const SERVICE = process.env.BILLING_IT_SERVICE_KEY;
const ANON = process.env.BILLING_IT_ANON_KEY;
const enabled = Boolean(URL && SERVICE && ANON);

describe.skipIf(!enabled)('billing against a real database', () => {
  let admin: SupabaseClient;
  let user: SupabaseClient;
  let userId: string;
  let accountId: string;
  const email = `billing-it-${randomUUID()}@example.com`;
  const password = `pw-${randomUUID()}`;

  const setBilling = (on: boolean) =>
    admin.from('platform_settings').update({ billing_enabled: on }).eq('id', true);
  const setSub = (patch: Record<string, unknown>) =>
    admin.from('subscriptions').update(patch).eq('account_id', accountId);
  const setOverrides = (limits: Record<string, number | null>) =>
    admin.from('accounts').update({ limit_overrides: { limits, features: {} } }).eq('id', accountId);
  const entitlements = async () => {
    const { data, error } = await admin.rpc('account_entitlements', { p_account_id: accountId });
    if (error) throw error;
    return data as { state: string; writable: boolean; limits: Record<string, number | null>; features: Record<string, boolean> };
  };
  const addContact = (client: SupabaseClient, phone: string) =>
    client.from('contacts').insert({ account_id: accountId, user_id: userId, phone, name: phone });

  beforeAll(async () => {
    admin = createClient(URL!, SERVICE!, { auth: { persistSession: false } });
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    userId = data.user!.id;
    const { data: profile } = await admin.from('profiles').select('account_id').eq('user_id', userId).single();
    accountId = profile!.account_id as string;

    user = createClient(URL!, ANON!, { auth: { persistSession: false } });
    const signIn = await user.auth.signInWithPassword({ email, password });
    if (signIn.error) throw signIn.error;
  });

  afterAll(async () => {
    if (!admin) return;
    await setBilling(false);
    if (accountId) await admin.from('accounts').delete().eq('id', accountId);
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  it('signup creates a trial subscription', async () => {
    const { data } = await admin.from('subscriptions').select('plan_code, status, trial_ends_at').eq('account_id', accountId).single();
    expect(data).toMatchObject({ plan_code: 'trial', status: 'trialing' });
    expect(new Date(data!.trial_ends_at as string).getTime()).toBeGreaterThan(Date.now() + 13 * 86_400_000);
  });

  it('billing disabled = unlimited and writable', async () => {
    await setBilling(false);
    const ent = await entitlements();
    expect(ent.state).toBe('unlimited');
    expect(ent.writable).toBe(true);
    expect(ent.limits.contacts).toBeNull();
    expect(ent.features.flows).toBe(true);
  });

  it('billing enabled = trial limits', async () => {
    await setBilling(true);
    const ent = await entitlements();
    expect(ent.state).toBe('trialing');
    expect(ent.limits.contacts).toBe(1000);
    expect(ent.limits.seats).toBe(3);
  });

  it('count limit trigger blocks a dashboard insert past the cap, service role is exempt', async () => {
    await setOverrides({ contacts: 2 });
    expect((await addContact(user, '911111111101')).error).toBeNull();
    expect((await addContact(user, '911111111102')).error).toBeNull();

    const blocked = await addContact(user, '911111111103');
    expect(blocked.error?.message).toBe('plan_limit_reached');
    expect(JSON.parse(blocked.error!.details!)).toEqual({ key: 'contacts', limit: 2 });

    // Inbound WhatsApp (service role) must never be blocked.
    expect((await addContact(admin, '911111111104')).error).toBeNull();
    await setOverrides({});
  });

  it('add-ons raise a plan limit', async () => {
    await setSub({ plan_code: 'starter', status: 'active', current_period_end: new Date(Date.now() + 86_400_000).toISOString() });
    expect((await entitlements()).limits.seats).toBe(2);
    await admin.from('subscription_addons').insert({ account_id: accountId, addon_code: 'extra_seat', quantity: 3 });
    expect((await entitlements()).limits.seats).toBe(5);
    await admin.from('subscription_addons').delete().eq('account_id', accountId);
  });

  it('feature flags follow the plan', async () => {
    const ent = await entitlements();
    expect(ent.features).toEqual({ flows: false, ai: false, api: false });
    await setSub({ plan_code: 'growth' });
    expect((await entitlements()).features).toEqual({ flows: true, ai: true, api: true });
  });

  it('monthly broadcast quota is atomic and refuses overflow', async () => {
    // growth: 100,000 / month
    const first = await admin.rpc('consume_usage', {
      p_account_id: accountId, p_metric: 'broadcast_recipients', p_amount: 99_000, p_limit_key: 'broadcast_recipients_monthly',
    });
    expect(first.data[0]).toMatchObject({ allowed: true, used: 99_000 });
    const over = await admin.rpc('consume_usage', {
      p_account_id: accountId, p_metric: 'broadcast_recipients', p_amount: 2_000, p_limit_key: 'broadcast_recipients_monthly',
    });
    expect(over.data[0]).toMatchObject({ allowed: false, used: 99_000 });
    await admin.rpc('release_usage', { p_account_id: accountId, p_metric: 'broadcast_recipients', p_amount: 99_000 });
  });

  it('past_due keeps access inside grace, then goes read-only', async () => {
    await setSub({ status: 'past_due', current_period_end: new Date(Date.now() - 2 * 86_400_000).toISOString() });
    expect((await entitlements()).state).toBe('past_due');
    await setSub({ current_period_end: new Date(Date.now() - 30 * 86_400_000).toISOString() });
    expect((await entitlements()).state).toBe('expired');
  });

  it('an expired trial makes the workspace read-only but keeps reads and inbound', async () => {
    await setSub({ plan_code: 'trial', status: 'trialing', trial_ends_at: new Date(Date.now() - 1000).toISOString() });
    const ent = await entitlements();
    expect(ent.state).toBe('trial_expired');
    expect(ent.writable).toBe(false);

    const write = await addContact(user, '911111111105');
    expect(write.error).not.toBeNull(); // RLS refuses write roles

    const read = await user.from('contacts').select('id').eq('account_id', accountId);
    expect(read.error).toBeNull();
    expect(read.data!.length).toBeGreaterThanOrEqual(3);

    expect((await addContact(admin, '911111111106')).error).toBeNull(); // inbound still lands
  });

  it('suspension is read-only regardless of plan', async () => {
    await setSub({ plan_code: 'pro', status: 'active', current_period_end: new Date(Date.now() + 86_400_000).toISOString() });
    expect((await entitlements()).writable).toBe(true);
    await admin.from('accounts').update({ suspended_at: new Date().toISOString() }).eq('id', accountId);
    expect((await entitlements()).state).toBe('suspended');
    await admin.from('accounts').update({ suspended_at: null }).eq('id', accountId);
  });

  it('seats: invites beyond the seat limit are refused', async () => {
    await setOverrides({ seats: 2 });
    const invite = (n: number) =>
      user.from('account_invitations').insert({
        account_id: accountId,
        token_hash: `it-${randomUUID()}-${n}`,
        role: 'agent',
        created_by_user_id: userId,
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      });
    expect((await invite(1)).error).toBeNull(); // owner + 1 pending = 2
    const blocked = await invite(2);
    expect(blocked.error?.message).toBe('plan_limit_reached');
    await setOverrides({});
  });

  it('a purchased add-on raises the limit and goes away when its subscription ends', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE;
    const { activateAddon, removeAddon } = await import('@/lib/billing/lifecycle');
    await setSub({ plan_code: 'growth', status: 'active', current_period_end: new Date(Date.now() + 86_400_000).toISOString() });
    expect((await entitlements()).limits.seats).toBe(5);

    await activateAddon(admin, { accountId, addonCode: 'extra_seat', quantity: 2, providerSubscriptionId: 'sub_it_1' });
    expect((await entitlements()).limits.seats).toBe(7);

    // A stale "cancelled" for some other subscription must not remove it…
    await removeAddon(admin, 'sub_other');
    expect((await entitlements()).limits.seats).toBe(7);
    // …but the add-on's own does.
    await removeAddon(admin, 'sub_it_1');
    expect((await entitlements()).limits.seats).toBe(5);
  });

  it('reminders: a trial ending soon is picked up, and released when email is not configured', async () => {
    const { runBillingReminders } = await import('@/lib/billing/reminders');
    delete process.env.RESEND_API_KEY;
    await setSub({ plan_code: 'trial', status: 'trialing', trial_ends_at: new Date(Date.now() + 2 * 86_400_000).toISOString() });
    const result = await runBillingReminders(admin);
    expect(result.checked).toBeGreaterThanOrEqual(1);
    expect(result.skipped).toBeGreaterThanOrEqual(1);
    const { count } = await admin
      .from('billing_notifications')
      .select('account_id', { count: 'exact', head: true })
      .eq('account_id', accountId);
    expect(count).toBe(0); // claim released so it is sent once email is configured
  });

  it('demo seed builds a coherent workspace and re-seeding replaces it', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE;
    const { seedDemoAccount } = await import('@/lib/demo/seed');
    await seedDemoAccount(admin, accountId, userId);
    await seedDemoAccount(admin, accountId, userId); // idempotent reset

    const count = async (table: string) =>
      (await admin.from(table).select('id', { count: 'exact', head: true }).eq('account_id', accountId)).count;
    expect(await count('contacts')).toBe(12);
    expect(await count('conversations')).toBe(7);
    expect(await count('deals')).toBe(5);
    expect(await count('pipelines')).toBe(1);
  });
});
