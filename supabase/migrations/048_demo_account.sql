-- ============================================================
-- 048_demo_account.sql
--
-- Flags the shared "Try live demo" workspace. Visitors sign straight
-- into it from the marketing site (POST /api/demo/start) without an
-- account of their own. Its data is wiped and re-seeded by the demo
-- reset job, and API routes refuse the actions that would let one
-- visitor spoil it for the next (members, API keys, WhatsApp
-- connection, billing, AI provider keys).
--
-- Idempotent.
-- ============================================================

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

-- At most one demo workspace per installation.
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_single_demo
  ON accounts (is_demo) WHERE is_demo;
