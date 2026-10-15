-- ============================================================
-- 049_billing_notifications.sql  (+ self-serve add-on columns, below)
--
-- One row per billing email sent (trial ending, trial ended, payment
-- failed, annual renewal due). The billing reminder job inserts here
-- BEFORE sending, so a retried or overlapping run never emails the
-- same reminder twice.
--
--   kind        trial_ending_3d | trial_ending_1d | trial_ended |
--               payment_failed | renewal_14d | renewal_3d
--   period_key  what the reminder is about — the trial end or period
--               end timestamp — so the next trial / period gets its
--               own reminders.
--
-- Service role only. Idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS billing_notifications (
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  period_key TEXT NOT NULL,
  recipient TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  error TEXT,
  PRIMARY KEY (account_id, kind, period_key)
);

ALTER TABLE billing_notifications ENABLE ROW LEVEL SECURITY;
-- No client policies: written and read by the reminder job only.

-- ============================================================
-- Self-serve add-ons: each purchase is its own monthly Razorpay
-- subscription (quantity = number of units). The Razorpay plan per
-- add-on is created on first purchase and cached here.
-- ============================================================
ALTER TABLE addons ADD COLUMN IF NOT EXISTS razorpay_plan_id TEXT;
ALTER TABLE subscription_addons ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_subscription_addons_provider_sub
  ON subscription_addons(provider_subscription_id) WHERE provider_subscription_id IS NOT NULL;
