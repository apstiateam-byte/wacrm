// ============================================================
// Billing reminder emails — trial ending / ended, payment failed,
// annual renewal due.
//
// `dueReminder` is pure (what should this subscription get right now?);
// `runBillingReminders` loads subscriptions, claims each reminder in
// `billing_notifications` (migration 049) BEFORE sending so overlapping
// or retried runs never double-send, and emails the account owner (or
// the billing email when set).
//
// Run it from a scheduler — hourly or daily both work: every reminder
// is a window ("within 3 days of the trial ending"), not an exact
// moment, and the claim row makes it once-only.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

import { getT } from '@/lib/i18n/translate';
import { renderEmail, sendEmail } from '@/lib/email/send';
import { APP_NAME } from '@/lib/brand';

const DAY = 86_400_000;
const t = getT('Emails.billing');

export type ReminderKind =
  | 'trial_ending_3d'
  | 'trial_ending_1d'
  | 'trial_ended'
  | 'payment_failed'
  | 'renewal_14d'
  | 'renewal_3d';

export interface ReminderSubscription {
  status: string;
  billing_interval: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export interface DueReminder {
  kind: ReminderKind;
  /** The trial end / period end this reminder is about. */
  periodKey: string;
  /** Whole days until that moment (0 when already past). */
  days: number;
}

/** The single most relevant reminder for a subscription right now, if any. */
export function dueReminder(sub: ReminderSubscription, now: Date = new Date()): DueReminder | null {
  const until = (iso: string) => new Date(iso).getTime() - now.getTime();
  const days = (ms: number) => Math.max(0, Math.ceil(ms / DAY));

  if (sub.status === 'trialing' && sub.trial_ends_at) {
    const left = until(sub.trial_ends_at);
    if (left <= 0) {
      // Only nudge recently-ended trials; don't email ancient sign-ups.
      return left > -7 * DAY ? { kind: 'trial_ended', periodKey: sub.trial_ends_at, days: 0 } : null;
    }
    if (left <= DAY) return { kind: 'trial_ending_1d', periodKey: sub.trial_ends_at, days: days(left) };
    if (left <= 3 * DAY) return { kind: 'trial_ending_3d', periodKey: sub.trial_ends_at, days: days(left) };
    return null;
  }

  if (sub.status === 'past_due' && sub.current_period_end) {
    return { kind: 'payment_failed', periodKey: sub.current_period_end, days: 0 };
  }

  // Annual plans don't auto-renew (RBI e-mandate cap) — remind to pay.
  if (
    sub.status === 'active' &&
    sub.billing_interval === 'annual' &&
    sub.cancel_at_period_end &&
    sub.current_period_end
  ) {
    const left = until(sub.current_period_end);
    if (left <= 0) return null;
    if (left <= 3 * DAY) return { kind: 'renewal_3d', periodKey: sub.current_period_end, days: days(left) };
    if (left <= 14 * DAY) return { kind: 'renewal_14d', periodKey: sub.current_period_end, days: days(left) };
  }
  return null;
}

function appUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}${path}`;
}

function buildEmail(kind: ReminderKind, vars: { brand: string; workspace: string; days: number; date: string }) {
  const key = kind.startsWith('trial_ending') ? 'trialEnding' : kind.startsWith('renewal') ? 'renewal' : kind === 'trial_ended' ? 'trialEnded' : 'paymentFailed';
  const params = { brand: vars.brand, workspace: vars.workspace, days: vars.days, date: vars.date };
  const { html, text } = renderEmail({
    brand: vars.brand,
    heading: t(`${key}.heading`, params),
    paragraphs: [t(`${key}.body`, params), t(`${key}.body2`, params)],
    cta: { label: t(`${key}.cta`), url: appUrl('/settings?tab=billing') },
    footer: t('footer', { brand: vars.brand }),
  });
  return { subject: t(`${key}.subject`, params), html, text };
}

export interface ReminderRunResult {
  checked: number;
  sent: number;
  skipped: number;
  failed: number;
}

export async function runBillingReminders(db: SupabaseClient, now: Date = new Date()): Promise<ReminderRunResult> {
  const result: ReminderRunResult = { checked: 0, sent: 0, skipped: 0, failed: 0 };

  const { data: settings } = await db.from('platform_settings').select('billing_enabled').eq('id', true).maybeSingle();
  if (!settings?.billing_enabled) return result;

  const { data: subs, error } = await db
    .from('subscriptions')
    .select('account_id, status, billing_interval, trial_ends_at, current_period_end, cancel_at_period_end')
    .in('status', ['trialing', 'past_due', 'active']);
  if (error) throw error;

  const brand = APP_NAME;

  for (const sub of subs ?? []) {
    result.checked++;
    const due = dueReminder(sub as ReminderSubscription, now);
    if (!due) continue;

    const { data: account } = await db
      .from('accounts')
      .select('name, owner_user_id, billing_email, is_demo, suspended_at')
      .eq('id', sub.account_id)
      .maybeSingle();
    if (!account || account.is_demo || account.suspended_at) {
      result.skipped++;
      continue;
    }
    let recipient = account.billing_email as string | null;
    if (!recipient) {
      const { data: owner } = await db.from('profiles').select('email').eq('user_id', account.owner_user_id).maybeSingle();
      recipient = (owner?.email as string | null) ?? null;
    }
    if (!recipient) {
      result.skipped++;
      continue;
    }

    // Claim first: the primary key makes a second run's insert a no-op.
    const { data: claimed, error: claimError } = await db
      .from('billing_notifications')
      .upsert(
        { account_id: sub.account_id, kind: due.kind, period_key: due.periodKey, recipient },
        { onConflict: 'account_id,kind,period_key', ignoreDuplicates: true },
      )
      .select('account_id');
    if (claimError) throw claimError;
    if (!claimed || claimed.length === 0) {
      result.skipped++;
      continue;
    }

    const email = buildEmail(due.kind, {
      brand,
      workspace: account.name as string,
      days: due.days,
      date: new Date(due.periodKey).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    });
    const sent = await sendEmail({ to: recipient, ...email });
    if (sent.sent) {
      result.sent++;
    } else if (sent.skipped) {
      // Email not configured: release the claim so it goes out once it is.
      await db
        .from('billing_notifications')
        .delete()
        .eq('account_id', sub.account_id)
        .eq('kind', due.kind)
        .eq('period_key', due.periodKey);
      result.skipped++;
    } else {
      result.failed++;
      await db
        .from('billing_notifications')
        .update({ error: sent.error?.slice(0, 500) ?? 'unknown' })
        .eq('account_id', sub.account_id)
        .eq('kind', due.kind)
        .eq('period_key', due.periodKey);
    }
  }
  return result;
}
