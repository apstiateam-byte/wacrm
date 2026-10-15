import { describe, expect, it } from 'vitest';

import { dueReminder, type ReminderSubscription } from './reminders';
import { renderEmail } from '@/lib/email/send';

const NOW = new Date('2026-10-15T12:00:00Z');
const inDays = (d: number) => new Date(NOW.getTime() + d * 86_400_000).toISOString();

const trial = (endsInDays: number): ReminderSubscription => ({
  status: 'trialing',
  billing_interval: null,
  trial_ends_at: inDays(endsInDays),
  current_period_end: null,
  cancel_at_period_end: false,
});

describe('dueReminder', () => {
  it('stays quiet early in a trial', () => {
    expect(dueReminder(trial(10), NOW)).toBeNull();
    expect(dueReminder(trial(3.5), NOW)).toBeNull();
  });

  it('warns 3 days and then 1 day before the trial ends', () => {
    expect(dueReminder(trial(2.5), NOW)).toMatchObject({ kind: 'trial_ending_3d', days: 3 });
    expect(dueReminder(trial(0.5), NOW)).toMatchObject({ kind: 'trial_ending_1d', days: 1 });
  });

  it('sends trial_ended only for recently ended trials', () => {
    expect(dueReminder(trial(-1), NOW)).toMatchObject({ kind: 'trial_ended', days: 0 });
    expect(dueReminder(trial(-10), NOW)).toBeNull();
  });

  it('keys reminders by the trial end so a new trial gets fresh reminders', () => {
    const sub = trial(2);
    expect(dueReminder(sub, NOW)?.periodKey).toBe(sub.trial_ends_at);
  });

  it('flags a failed renewal', () => {
    expect(
      dueReminder(
        { status: 'past_due', billing_interval: 'monthly', trial_ends_at: null, current_period_end: inDays(-1), cancel_at_period_end: false },
        NOW,
      ),
    ).toMatchObject({ kind: 'payment_failed' });
  });

  it('reminds annual plans to renew, but not auto-renewing monthly ones', () => {
    const annual = (d: number): ReminderSubscription => ({
      status: 'active',
      billing_interval: 'annual',
      trial_ends_at: null,
      current_period_end: inDays(d),
      cancel_at_period_end: true,
    });
    expect(dueReminder(annual(30), NOW)).toBeNull();
    expect(dueReminder(annual(10), NOW)).toMatchObject({ kind: 'renewal_14d', days: 10 });
    expect(dueReminder(annual(2), NOW)).toMatchObject({ kind: 'renewal_3d', days: 2 });
    expect(
      dueReminder({ ...annual(2), billing_interval: 'monthly', cancel_at_period_end: false }, NOW),
    ).toBeNull();
  });
});

describe('renderEmail', () => {
  it('escapes HTML and builds a plain-text alternative', () => {
    const { html, text } = renderEmail({
      brand: 'wacrm',
      heading: 'Hi <Acme>',
      paragraphs: ['A & B'],
      cta: { label: 'Go', url: 'https://example.com/?a=1&b=2' },
      footer: 'Footer',
    });
    expect(html).toContain('Hi &lt;Acme&gt;');
    expect(html).toContain('A &amp; B');
    expect(html).toContain('href="https://example.com/?a=1&amp;b=2"');
    expect(text).toContain('Go: https://example.com/?a=1&b=2');
    expect(text.startsWith('Hi <Acme>')).toBe(true);
  });
});
