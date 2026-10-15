-- ============================================================
-- 050_platform_payment_settings.sql
--
-- Razorpay credentials entered in the platform admin console instead
-- of only through environment variables. Secrets are stored encrypted
-- by the app (AES-256-GCM with ENCRYPTION_KEY, same as WhatsApp
-- tokens) and are never sent back to the browser.
--
-- Environment variables (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET /
-- RAZORPAY_WEBHOOK_SECRET) still work and take precedence when set.
--
-- platform_settings stays readable by signed-in users (the pricing
-- page reads gst_percent), but only its non-secret columns: table-level
-- SELECT is revoked and granted back column by column, because a
-- column-level REVOKE alone has no effect while a table-level grant
-- exists. Only the service role (admin API) reads the payment columns.
--
-- Idempotent.
-- ============================================================

ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS razorpay_key_id TEXT;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS razorpay_key_secret_enc TEXT;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS razorpay_webhook_secret_enc TEXT;

REVOKE SELECT ON platform_settings FROM anon, authenticated;
GRANT SELECT (id, billing_enabled, trial_days, grace_days, trial_plan_code, gst_percent, updated_at)
  ON platform_settings TO authenticated;
