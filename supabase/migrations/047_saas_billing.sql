-- ============================================================
-- 047_saas_billing.sql
--
-- Plans, subscriptions, trials, add-ons and plan limits — the data
-- model that turns wacrm into a hosted, multi-tenant SaaS.
--
-- Self-hosters are unaffected: billing is OFF until the operator
-- flips `platform_settings.billing_enabled`. While it is off every
-- check below short-circuits to "unlimited / writable", so an
-- existing install that applies this migration behaves exactly as
-- before.
--
-- What this migration adds
--   1. platform_settings   — singleton: billing on/off, trial + grace days
--   2. platform_admins     — users who can open /admin (the SaaS operator)
--   3. plans / addons      — catalogue, seeded with trial/starter/growth/pro/enterprise
--   4. subscriptions       — one per account (tenant), trial on signup
--   5. subscription_addons — purchased / granted add-ons
--   6. usage_counters      — monthly metered usage (broadcast recipients)
--   7. billing_events      — provider webhook log, idempotency key
--   8. billing_payments    — payment / invoice references
--   9. accounts.limit_overrides / suspended_at / billing details
--  10. Functions: account_billing_state, account_limit,
--      account_feature, consume_usage
--  11. is_account_member() — write roles denied when the account is
--      read-only (trial over, unpaid, suspended). Reads keep working
--      and service-role writes (inbound webhook) are never blocked,
--      so no customer message is ever lost.
--  12. Count-limit triggers on contacts, automations, flows,
--      pipelines, api_keys, webhook_endpoints, invitations, members
--  13. handle_new_user() — every signup starts a trial
--  14. Backfill — every existing account gets a trial subscription
--
-- Idempotent — safe to re-run.
-- ============================================================

-- ============================================================
-- 1. PLATFORM SETTINGS (singleton row, id = true)
-- ============================================================
CREATE TABLE IF NOT EXISTS platform_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  billing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  trial_days INTEGER NOT NULL DEFAULT 14 CHECK (trial_days BETWEEN 0 AND 365),
  grace_days INTEGER NOT NULL DEFAULT 7 CHECK (grace_days BETWEEN 0 AND 90),
  trial_plan_code TEXT NOT NULL DEFAULT 'trial',
  -- Plan prices are shown and stored exclusive of tax; checkout adds
  -- this percentage (18% GST for Indian SaaS).
  gst_percent NUMERIC(5,2) NOT NULL DEFAULT 18 CHECK (gst_percent BETWEEN 0 AND 100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO platform_settings (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
-- Readable by anyone signed in (the UI needs billing_enabled); written
-- only by the service role (admin API).
DROP POLICY IF EXISTS platform_settings_select ON platform_settings;
CREATE POLICY platform_settings_select ON platform_settings FOR SELECT TO authenticated USING (TRUE);

-- ============================================================
-- 2. PLATFORM ADMINS
-- ============================================================
CREATE TABLE IF NOT EXISTS platform_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_admins_self ON platform_admins;
CREATE POLICY platform_admins_self ON platform_admins FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- 3. PLANS + ADDONS
--
-- `limits` keys (NULL value or missing key = unlimited):
--   seats, contacts, broadcast_recipients_monthly, pipelines,
--   automations, flows, api_keys, webhook_endpoints
-- `features` keys (missing = false):
--   flows, ai, api
-- Prices are in whole rupees; annual price is the full-year amount.
-- ============================================================
CREATE TABLE IF NOT EXISTS plans (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  highlighted BOOLEAN NOT NULL DEFAULT FALSE,
  contact_sales BOOLEAN NOT NULL DEFAULT FALSE,
  price_inr_monthly INTEGER,
  price_inr_annual INTEGER,
  limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  razorpay_plan_id_monthly TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
-- The pricing page is public — anon can read the catalogue.
DROP POLICY IF EXISTS plans_select ON plans;
CREATE POLICY plans_select ON plans FOR SELECT TO anon, authenticated USING (TRUE);

DROP TRIGGER IF EXISTS set_updated_at ON plans;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed. ON CONFLICT DO NOTHING so an operator's later edits to prices
-- / limits (via /admin or SQL) survive a re-run of this migration.
INSERT INTO plans (code, name, description, sort_order, is_public, highlighted, contact_sales,
                   price_inr_monthly, price_inr_annual, limits, features)
VALUES
  ('trial', 'Free trial', 'Growth features with trial caps', 0, FALSE, FALSE, FALSE,
    0, 0,
    '{"seats":3,"contacts":1000,"broadcast_recipients_monthly":500,"pipelines":5,"automations":25,"flows":10,"api_keys":2,"webhook_endpoints":2}',
    '{"flows":true,"ai":true,"api":true}'),
  ('starter', 'Starter', 'For small teams getting started on WhatsApp', 10, TRUE, FALSE, FALSE,
    1999, 19190,
    '{"seats":2,"contacts":5000,"broadcast_recipients_monthly":10000,"pipelines":1,"automations":5,"flows":0,"api_keys":0,"webhook_endpoints":0}',
    '{"flows":false,"ai":false,"api":false}'),
  ('growth', 'Growth', 'Chatbots, AI and API for growing businesses', 20, TRUE, TRUE, FALSE,
    4999, 47990,
    '{"seats":5,"contacts":50000,"broadcast_recipients_monthly":100000,"pipelines":5,"automations":25,"flows":10,"api_keys":5,"webhook_endpoints":5}',
    '{"flows":true,"ai":true,"api":true}'),
  ('pro', 'Pro', 'Unlimited automation for high-volume teams', 30, TRUE, FALSE, FALSE,
    11999, 115190,
    '{"seats":10}',
    '{"flows":true,"ai":true,"api":true}'),
  ('enterprise', 'Enterprise', 'Custom limits, SLA and white-label', 40, TRUE, FALSE, TRUE,
    NULL, NULL,
    '{}',
    '{"flows":true,"ai":true,"api":true}')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS addons (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  limit_key TEXT NOT NULL,
  increment INTEGER NOT NULL CHECK (increment > 0),
  price_inr_monthly INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE addons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS addons_select ON addons;
CREATE POLICY addons_select ON addons FOR SELECT TO anon, authenticated USING (TRUE);

INSERT INTO addons (code, name, description, limit_key, increment, price_inr_monthly) VALUES
  ('extra_seat', 'Extra team seat', 'One more team member', 'seats', 1, 499),
  ('extra_contacts_10k', 'Extra 10,000 contacts', 'Raises the contact limit by 10,000', 'contacts', 10000, 499),
  ('extra_flows_10', 'Extra 10 chatbot flows', 'Raises the chatbot flow limit by 10', 'flows', 10, 999)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 4. SUBSCRIPTIONS — exactly one row per account
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status_enum') THEN
    CREATE TYPE subscription_status_enum AS ENUM
      ('trialing', 'active', 'past_due', 'canceled', 'expired');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS subscriptions (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL REFERENCES plans(code),
  status subscription_status_enum NOT NULL DEFAULT 'trialing',
  billing_interval TEXT CHECK (billing_interval IN ('monthly', 'annual')),
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  provider TEXT CHECK (provider IN ('razorpay', 'manual')),
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  -- A checkout that was started but not yet confirmed. Lets the
  -- webhook map a provider subscription back to the plan the user
  -- picked without trusting client input.
  pending_plan_code TEXT REFERENCES plans(code),
  pending_interval TEXT CHECK (pending_interval IN ('monthly', 'annual')),
  pending_provider_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_provider_sub
  ON subscriptions(provider_subscription_id) WHERE provider_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_pending_ref
  ON subscriptions(pending_provider_ref) WHERE pending_provider_ref IS NOT NULL;

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subscriptions_select ON subscriptions;
CREATE POLICY subscriptions_select ON subscriptions FOR SELECT
  USING (is_account_member(account_id));
-- No client write policies: only the billing API (service role) writes.

DROP TRIGGER IF EXISTS set_updated_at ON subscriptions;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 5. SUBSCRIPTION ADDONS
-- ============================================================
CREATE TABLE IF NOT EXISTS subscription_addons (
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  addon_code TEXT NOT NULL REFERENCES addons(code),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  provider_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, addon_code)
);
ALTER TABLE subscription_addons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subscription_addons_select ON subscription_addons;
CREATE POLICY subscription_addons_select ON subscription_addons FOR SELECT
  USING (is_account_member(account_id));

-- ============================================================
-- 6. USAGE COUNTERS (monthly)
-- ============================================================
CREATE TABLE IF NOT EXISTS usage_counters (
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  metric TEXT NOT NULL,
  period_start DATE NOT NULL,
  used BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, metric, period_start)
);
ALTER TABLE usage_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS usage_counters_select ON usage_counters;
CREATE POLICY usage_counters_select ON usage_counters FOR SELECT
  USING (is_account_member(account_id));

-- ============================================================
-- 7. BILLING EVENTS (provider webhooks — idempotency + audit)
-- ============================================================
CREATE TABLE IF NOT EXISTS billing_events (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, event_id)
);
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
-- Service role only.

-- ============================================================
-- 8. BILLING PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS billing_payments (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_payment_id TEXT NOT NULL,
  provider_invoice_id TEXT,
  plan_code TEXT REFERENCES plans(code),
  billing_interval TEXT,
  amount_paise BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL,
  invoice_url TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_payment_id)
);
CREATE INDEX IF NOT EXISTS idx_billing_payments_account ON billing_payments(account_id, created_at DESC);
ALTER TABLE billing_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS billing_payments_select ON billing_payments;
CREATE POLICY billing_payments_select ON billing_payments FOR SELECT
  USING (is_account_member(account_id, 'admin'));

-- ============================================================
-- 9. ACCOUNT COLUMNS
-- ============================================================
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS limit_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS billing_name TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS billing_email TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS billing_gstin TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS billing_address TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS billing_state TEXT;

-- ============================================================
-- 10. FUNCTIONS
-- ============================================================

-- Effective billing state of an account. `state` is one of:
--   unlimited      billing disabled platform-wide
--   trialing       in trial
--   active         paid and current
--   past_due       payment failed, inside grace — still writable
--   canceled       canceled but paid period not over — still writable
--   trial_expired  trial over, not paid            — read-only
--   expired        paid period / grace over        — read-only
--   suspended      operator suspended the account  — read-only
CREATE OR REPLACE FUNCTION account_billing_state(p_account_id UUID)
RETURNS TABLE (state TEXT, writable BOOLEAN, plan_code TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings platform_settings%ROWTYPE;
  v_sub subscriptions%ROWTYPE;
  v_suspended TIMESTAMPTZ;
  v_grace INTERVAL;
BEGIN
  SELECT * INTO v_settings FROM platform_settings WHERE id;
  IF NOT FOUND OR NOT v_settings.billing_enabled THEN
    RETURN QUERY SELECT 'unlimited'::TEXT, TRUE, NULL::TEXT;
    RETURN;
  END IF;

  SELECT a.suspended_at INTO v_suspended FROM accounts a WHERE a.id = p_account_id;
  SELECT * INTO v_sub FROM subscriptions s WHERE s.account_id = p_account_id;

  IF v_suspended IS NOT NULL THEN
    RETURN QUERY SELECT 'suspended'::TEXT, FALSE, v_sub.plan_code;
    RETURN;
  END IF;

  IF NOT FOUND THEN
    -- Shouldn't happen (signup + backfill create one). Fail open on
    -- access, trial-sized on limits.
    RETURN QUERY SELECT 'trialing'::TEXT, TRUE, v_settings.trial_plan_code;
    RETURN;
  END IF;

  v_grace := make_interval(days => v_settings.grace_days);

  IF v_sub.status = 'trialing' THEN
    IF v_sub.trial_ends_at IS NULL OR v_sub.trial_ends_at > NOW() THEN
      RETURN QUERY SELECT 'trialing'::TEXT, TRUE, v_sub.plan_code;
    ELSE
      RETURN QUERY SELECT 'trial_expired'::TEXT, FALSE, v_sub.plan_code;
    END IF;
  ELSIF v_sub.status = 'active' THEN
    IF v_sub.current_period_end IS NOT NULL AND NOW() > v_sub.current_period_end + v_grace THEN
      RETURN QUERY SELECT 'expired'::TEXT, FALSE, v_sub.plan_code;
    ELSE
      RETURN QUERY SELECT 'active'::TEXT, TRUE, v_sub.plan_code;
    END IF;
  ELSIF v_sub.status = 'past_due' THEN
    IF v_sub.current_period_end IS NULL OR NOW() <= v_sub.current_period_end + v_grace THEN
      RETURN QUERY SELECT 'past_due'::TEXT, TRUE, v_sub.plan_code;
    ELSE
      RETURN QUERY SELECT 'expired'::TEXT, FALSE, v_sub.plan_code;
    END IF;
  ELSIF v_sub.status = 'canceled' THEN
    IF v_sub.current_period_end IS NOT NULL AND NOW() <= v_sub.current_period_end THEN
      RETURN QUERY SELECT 'canceled'::TEXT, TRUE, v_sub.plan_code;
    ELSE
      RETURN QUERY SELECT 'expired'::TEXT, FALSE, v_sub.plan_code;
    END IF;
  ELSE
    RETURN QUERY SELECT 'expired'::TEXT, FALSE, v_sub.plan_code;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION account_is_writable(p_account_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT writable FROM account_billing_state(p_account_id)), TRUE);
$$;

-- Effective limit for a key: plan limit + add-ons, then per-account
-- override. NULL = unlimited. Billing disabled → NULL.
CREATE OR REPLACE FUNCTION account_limit(p_account_id UUID, p_key TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_code TEXT;
  v_state TEXT;
  v_limits JSONB;
  v_overrides JSONB;
  v_base BIGINT;
  v_extra BIGINT;
BEGIN
  SELECT b.state, b.plan_code INTO v_state, v_plan_code FROM account_billing_state(p_account_id) b;
  IF v_state = 'unlimited' THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(a.limit_overrides -> 'limits', '{}'::jsonb) INTO v_overrides
  FROM accounts a WHERE a.id = p_account_id;
  IF v_overrides ? p_key THEN
    IF jsonb_typeof(v_overrides -> p_key) = 'null' THEN
      RETURN NULL;
    END IF;
    RETURN (v_overrides ->> p_key)::BIGINT;
  END IF;

  SELECT p.limits INTO v_limits FROM plans p WHERE p.code = v_plan_code;
  IF v_limits IS NULL OR NOT (v_limits ? p_key) OR jsonb_typeof(v_limits -> p_key) = 'null' THEN
    RETURN NULL;
  END IF;
  v_base := (v_limits ->> p_key)::BIGINT;

  SELECT COALESCE(SUM(sa.quantity * ad.increment), 0) INTO v_extra
  FROM subscription_addons sa
  JOIN addons ad ON ad.code = sa.addon_code
  WHERE sa.account_id = p_account_id AND ad.limit_key = p_key;

  RETURN v_base + v_extra;
END;
$$;

-- Feature flag for a key. Billing disabled → TRUE.
CREATE OR REPLACE FUNCTION account_feature(p_account_id UUID, p_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_code TEXT;
  v_state TEXT;
  v_overrides JSONB;
  v_features JSONB;
BEGIN
  SELECT b.state, b.plan_code INTO v_state, v_plan_code FROM account_billing_state(p_account_id) b;
  IF v_state = 'unlimited' THEN
    RETURN TRUE;
  END IF;
  SELECT COALESCE(a.limit_overrides -> 'features', '{}'::jsonb) INTO v_overrides
  FROM accounts a WHERE a.id = p_account_id;
  IF v_overrides ? p_key THEN
    RETURN COALESCE((v_overrides ->> p_key)::BOOLEAN, FALSE);
  END IF;
  SELECT p.features INTO v_features FROM plans p WHERE p.code = v_plan_code;
  RETURN COALESCE((v_features ->> p_key)::BOOLEAN, FALSE);
END;
$$;

-- Atomically consume metered usage for the current calendar month.
-- Returns allowed=false (and consumes nothing) when the request would
-- exceed the limit.
CREATE OR REPLACE FUNCTION consume_usage(
  p_account_id UUID,
  p_metric TEXT,
  p_amount BIGINT,
  p_limit_key TEXT
) RETURNS TABLE (allowed BOOLEAN, used BIGINT, limit_value BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period DATE := date_trunc('month', NOW())::DATE;
  v_limit BIGINT := account_limit(p_account_id, p_limit_key);
  v_used BIGINT;
BEGIN
  INSERT INTO usage_counters (account_id, metric, period_start, used)
  VALUES (p_account_id, p_metric, v_period, 0)
  ON CONFLICT (account_id, metric, period_start) DO NOTHING;

  SELECT uc.used INTO v_used FROM usage_counters uc
  WHERE uc.account_id = p_account_id AND uc.metric = p_metric AND uc.period_start = v_period
  FOR UPDATE;

  IF v_limit IS NOT NULL AND v_used + p_amount > v_limit THEN
    RETURN QUERY SELECT FALSE, v_used, v_limit;
    RETURN;
  END IF;

  UPDATE usage_counters uc SET used = uc.used + p_amount, updated_at = NOW()
  WHERE uc.account_id = p_account_id AND uc.metric = p_metric AND uc.period_start = v_period
  RETURNING uc.used INTO v_used;

  RETURN QUERY SELECT TRUE, v_used, v_limit;
END;
$$;

-- Give back usage that was reserved but not spent (e.g. a broadcast
-- that failed before sending everything).
CREATE OR REPLACE FUNCTION release_usage(p_account_id UUID, p_metric TEXT, p_amount BIGINT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE usage_counters
  SET used = GREATEST(used - p_amount, 0), updated_at = NOW()
  WHERE account_id = p_account_id AND metric = p_metric
    AND period_start = date_trunc('month', NOW())::DATE;
$$;

-- Everything the app needs to render plan state in one round trip:
-- state, plan, effective limits, features and current usage.
CREATE OR REPLACE FUNCTION account_entitlements(p_account_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state RECORD;
  v_limits JSONB := '{}'::jsonb;
  v_features JSONB := '{}'::jsonb;
  v_key TEXT;
  v_limit BIGINT;
BEGIN
  SELECT * INTO v_state FROM account_billing_state(p_account_id);

  FOREACH v_key IN ARRAY ARRAY['seats', 'contacts', 'broadcast_recipients_monthly', 'pipelines',
                               'automations', 'flows', 'api_keys', 'webhook_endpoints'] LOOP
    v_limit := account_limit(p_account_id, v_key);
    v_limits := v_limits || jsonb_build_object(v_key, v_limit);
  END LOOP;
  FOREACH v_key IN ARRAY ARRAY['flows', 'ai', 'api'] LOOP
    v_features := v_features || jsonb_build_object(v_key, account_feature(p_account_id, v_key));
  END LOOP;

  RETURN jsonb_build_object(
    'state', v_state.state,
    'writable', v_state.writable,
    'plan_code', v_state.plan_code,
    'limits', v_limits,
    'features', v_features,
    'usage', jsonb_build_object(
      'seats', (SELECT COUNT(*) FROM profiles WHERE account_id = p_account_id),
      'contacts', (SELECT COUNT(*) FROM contacts WHERE account_id = p_account_id),
      'pipelines', (SELECT COUNT(*) FROM pipelines WHERE account_id = p_account_id),
      'automations', (SELECT COUNT(*) FROM automations WHERE account_id = p_account_id),
      'flows', (SELECT COUNT(*) FROM flows WHERE account_id = p_account_id),
      'api_keys', (SELECT COUNT(*) FROM api_keys WHERE account_id = p_account_id AND revoked_at IS NULL),
      'webhook_endpoints', (SELECT COUNT(*) FROM webhook_endpoints WHERE account_id = p_account_id),
      'broadcast_recipients_monthly', COALESCE((
        SELECT used FROM usage_counters
        WHERE account_id = p_account_id AND metric = 'broadcast_recipients'
          AND period_start = date_trunc('month', NOW())::DATE
      ), 0)
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION account_entitlements(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION account_entitlements(UUID) TO service_role;

-- Internal helpers: service role only. account_billing_state /
-- account_limit / account_feature are also called from RLS and
-- triggers (SECURITY DEFINER, so no grant needed there).
REVOKE ALL ON FUNCTION consume_usage(UUID, TEXT, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION consume_usage(UUID, TEXT, BIGINT, TEXT) TO service_role;
REVOKE ALL ON FUNCTION release_usage(UUID, TEXT, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION release_usage(UUID, TEXT, BIGINT) TO service_role;
REVOKE ALL ON FUNCTION account_billing_state(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION account_billing_state(UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION account_is_writable(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION account_is_writable(UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION account_limit(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION account_limit(UUID, TEXT) TO authenticated, service_role;
REVOKE ALL ON FUNCTION account_feature(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION account_feature(UUID, TEXT) TO authenticated, service_role;

-- ============================================================
-- 11. is_account_member — read-only accounts lose write roles
--
-- Every write policy calls is_account_member(account_id, 'agent' |
-- 'admin'); reads call it with the default 'viewer'. Adding the
-- writable check here makes a lapsed account read-only everywhere at
-- once without touching any policy. Reads never pay for the extra
-- lookup (short-circuited on min_role = 'viewer').
-- ============================================================
CREATE OR REPLACE FUNCTION is_account_member(
  target_account_id UUID,
  min_role account_role_enum DEFAULT 'viewer'
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.user_id = auth.uid()
      AND p.account_id = target_account_id
      AND CASE p.account_role
            WHEN 'owner'  THEN 4
            WHEN 'admin'  THEN 3
            WHEN 'agent'  THEN 2
            WHEN 'viewer' THEN 1
          END
        >=
          CASE min_role
            WHEN 'owner'  THEN 4
            WHEN 'admin'  THEN 3
            WHEN 'agent'  THEN 2
            WHEN 'viewer' THEN 1
          END
  )
  AND (min_role = 'viewer' OR account_is_writable(target_account_id));
$$;

-- ============================================================
-- 12. COUNT-LIMIT TRIGGERS
--
-- Enforced for dashboard users (requests carrying a user JWT).
-- Service-role writes are exempt: inbound WhatsApp messages must always be able to
-- create contacts, and the public API / admin paths check limits in
-- the app layer.
-- ============================================================
CREATE OR REPLACE FUNCTION enforce_plan_count_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key TEXT := TG_ARGV[0];
  v_limit BIGINT;
  v_count BIGINT;
BEGIN
  -- No end-user JWT = service role / SQL console: exempt.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  v_limit := account_limit(NEW.account_id, v_key);
  IF v_limit IS NULL THEN
    RETURN NEW;
  END IF;
  -- Optional second argument: a fixed, trigger-defined filter (never
  -- user input) for rows that should not count, e.g. revoked keys.
  EXECUTE format('SELECT COUNT(*) FROM %I.%I WHERE account_id = $1 AND (%s)',
                 TG_TABLE_SCHEMA, TG_TABLE_NAME, COALESCE(TG_ARGV[1], 'TRUE'))
    INTO v_count USING NEW.account_id;
  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'plan_limit_reached'
      USING ERRCODE = 'P0001',
            DETAIL = json_build_object('key', v_key, 'limit', v_limit)::TEXT,
            HINT = 'Upgrade your plan to add more.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS plan_limit_contacts ON contacts;
CREATE TRIGGER plan_limit_contacts BEFORE INSERT ON contacts
  FOR EACH ROW EXECUTE FUNCTION enforce_plan_count_limit('contacts');

DROP TRIGGER IF EXISTS plan_limit_automations ON automations;
CREATE TRIGGER plan_limit_automations BEFORE INSERT ON automations
  FOR EACH ROW EXECUTE FUNCTION enforce_plan_count_limit('automations');

DROP TRIGGER IF EXISTS plan_limit_flows ON flows;
CREATE TRIGGER plan_limit_flows BEFORE INSERT ON flows
  FOR EACH ROW EXECUTE FUNCTION enforce_plan_count_limit('flows');

DROP TRIGGER IF EXISTS plan_limit_pipelines ON pipelines;
CREATE TRIGGER plan_limit_pipelines BEFORE INSERT ON pipelines
  FOR EACH ROW EXECUTE FUNCTION enforce_plan_count_limit('pipelines');

DROP TRIGGER IF EXISTS plan_limit_api_keys ON api_keys;
CREATE TRIGGER plan_limit_api_keys BEFORE INSERT ON api_keys
  FOR EACH ROW EXECUTE FUNCTION enforce_plan_count_limit('api_keys', 'revoked_at IS NULL');

DROP TRIGGER IF EXISTS plan_limit_webhook_endpoints ON webhook_endpoints;
CREATE TRIGGER plan_limit_webhook_endpoints BEFORE INSERT ON webhook_endpoints
  FOR EACH ROW EXECUTE FUNCTION enforce_plan_count_limit('webhook_endpoints');

-- Seats: members + still-open invitations may not exceed the seat
-- limit when a new invite is issued.
CREATE OR REPLACE FUNCTION enforce_plan_seat_limit_on_invite()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit BIGINT := account_limit(NEW.account_id, 'seats');
  v_members BIGINT;
  v_pending BIGINT;
BEGIN
  IF auth.uid() IS NULL OR v_limit IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT COUNT(*) INTO v_members FROM profiles WHERE account_id = NEW.account_id;
  SELECT COUNT(*) INTO v_pending FROM account_invitations
  WHERE account_id = NEW.account_id AND accepted_at IS NULL AND expires_at > NOW();
  IF v_members + v_pending >= v_limit THEN
    RAISE EXCEPTION 'plan_limit_reached'
      USING ERRCODE = 'P0001',
            DETAIL = json_build_object('key', 'seats', 'limit', v_limit)::TEXT,
            HINT = 'Upgrade your plan or buy extra seats to invite more members.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS plan_limit_invitations ON account_invitations;
CREATE TRIGGER plan_limit_invitations BEFORE INSERT ON account_invitations
  FOR EACH ROW EXECUTE FUNCTION enforce_plan_seat_limit_on_invite();

-- Seats: a profile moving into an account (invite redemption).
CREATE OR REPLACE FUNCTION enforce_plan_seat_limit_on_join()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit BIGINT;
  v_members BIGINT;
BEGIN
  IF auth.uid() IS NULL OR NEW.account_id IS NULL
     OR NEW.account_id IS NOT DISTINCT FROM OLD.account_id THEN
    RETURN NEW;
  END IF;
  v_limit := account_limit(NEW.account_id, 'seats');
  IF v_limit IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT COUNT(*) INTO v_members FROM profiles
  WHERE account_id = NEW.account_id AND user_id <> NEW.user_id;
  IF v_members >= v_limit THEN
    RAISE EXCEPTION 'plan_limit_reached'
      USING ERRCODE = 'P0001',
            DETAIL = json_build_object('key', 'seats', 'limit', v_limit)::TEXT,
            HINT = 'This workspace has no free seats. Ask its owner to upgrade.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS plan_limit_seats_join ON profiles;
CREATE TRIGGER plan_limit_seats_join BEFORE UPDATE OF account_id ON profiles
  FOR EACH ROW EXECUTE FUNCTION enforce_plan_seat_limit_on_join();

REVOKE ALL ON FUNCTION enforce_plan_count_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION enforce_plan_seat_limit_on_invite() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION enforce_plan_seat_limit_on_join() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 13. handle_new_user — every new account starts a trial
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  v_account_id UUID;
  v_trial_days INTEGER;
  v_trial_plan TEXT;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');

  INSERT INTO public.accounts (name, owner_user_id)
  VALUES (COALESCE(NULLIF(v_full_name, ''), NEW.email, 'My account'), NEW.id)
  RETURNING id INTO v_account_id;

  SELECT trial_days, trial_plan_code INTO v_trial_days, v_trial_plan
  FROM public.platform_settings WHERE id;

  INSERT INTO public.subscriptions (account_id, plan_code, status, trial_ends_at)
  VALUES (
    v_account_id,
    COALESCE(v_trial_plan, 'trial'),
    'trialing',
    NOW() + make_interval(days => COALESCE(v_trial_days, 14))
  )
  ON CONFLICT (account_id) DO NOTHING;

  INSERT INTO public.profiles (user_id, full_name, email, account_id, account_role)
  VALUES (NEW.id, v_full_name, NEW.email, v_account_id, 'owner');

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to bootstrap account/profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 14. BACKFILL — existing accounts get a fresh trial
-- ============================================================
INSERT INTO subscriptions (account_id, plan_code, status, trial_ends_at)
SELECT a.id, s.trial_plan_code, 'trialing', NOW() + make_interval(days => s.trial_days)
FROM accounts a
CROSS JOIN platform_settings s
WHERE NOT EXISTS (SELECT 1 FROM subscriptions x WHERE x.account_id = a.id);
