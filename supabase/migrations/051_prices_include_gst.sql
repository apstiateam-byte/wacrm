-- ============================================================
-- 051_prices_include_gst.sql
--
-- How plan / add-on prices entered in /admin are treated for GST:
--   false (default) — price is before GST; checkout adds gst_percent
--                     on top (₹4,999 → ₹5,898.82 charged).
--   true            — price already includes GST; checkout charges it
--                     as-is (₹4,999 charged).
--
-- Readable by signed-in users alongside gst_percent so pricing cards
-- can show the final amount.
--
-- Idempotent.
-- ============================================================

ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS prices_include_gst BOOLEAN NOT NULL DEFAULT false;

GRANT SELECT (prices_include_gst) ON platform_settings TO authenticated;
