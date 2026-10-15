# Session handoff — WhatsApp CRM → multi-tenant SaaS

_Last updated: 15 Oct 2026. Paste or point a new session at this file to continue._

## 1. Project at a glance

- **Repo:** `D:\wacrm` — forked from the open-source **wacrm** (Next.js 16.3.8 +
  Supabase + Tailwind v4 + shadcn/base-ui, next-intl in en/pt/es/ko). Read
  `AGENTS.md`: this Next version differs from older docs (e.g. `proxy.ts`
  replaces `middleware.ts`).
- **Goal:** turn the self-hosted WhatsApp CRM into a **multi-tenant SaaS sold in
  India**: plans, 14-day free trial, add-ons, Razorpay billing, a SaaS-owner
  admin portal, a marketing site with live demo, and a warm "editorial" UI
  redesign — keeping all existing CRM features unchanged.
- **Branch:** `feat/saas-billing-core`. **Nothing is committed yet** (~130 changed /
  new files). The user asked not to open a PR. Commit only when asked.
- **Live setup:** Vercel + live Supabase (in `.env.local`). Dev server is run by
  the user on **port 3001** (`npm run dev -- --port 3001`). Only one `next dev`
  per folder is allowed.
- **Brand:** product name comes from **`NEXT_PUBLIC_APP_NAME`** (user set
  `Cluade`, domain `cluade.si`). ⚠️ Advised the user repeatedly that "Cluade" is
  confusingly similar to Anthropic's "Claude" trademark (risk for Razorpay/Meta
  approval). Never hard-code the name; it all flows from `src/lib/brand.ts`.

## 2. Earlier fix in this session (unrelated to SaaS)

WhatsApp inbound messages weren't arriving: the phone number belonged to WABA
`3051122468573522`, but the app had subscribed a different WABA ID. Fixed by
subscribing the owning WABA, plus code changes:
- `src/lib/whatsapp/meta-api.ts` → `getPhoneNumberOwningWabaId()` (reads
  `health_status`).
- `verify-registration` route now checks the owning WABA (`waba_id_matches_number`)
  and app id; config save also subscribes the owning WABA.

## 3. Business decisions made

| Topic | Decision |
| --- | --- |
| Market | India first, INR, **Razorpay** (Paddle for USD later) |
| Plans (₹/month, excl. 18% GST) | Trial (free, 14 days, Growth features with caps) · **Starter ₹1,999** · **Growth ₹4,999** (most popular) · **Pro ₹11,999** · Enterprise (contact sales). Annual ≈ 20% off |
| Billing model | Monthly = Razorpay **Subscription** (auto-renew). Annual = one-time Razorpay **Order** (RBI e-mandate >₹15k rule), renewal reminders |
| Meta message fees | Customers pay Meta directly (Tech Provider model) — no wallet/markup yet |
| AI | Bring-your-own-key (unchanged) |
| Lapsed accounts | Read-only; **inbound WhatsApp messages always saved**; bots pause |

## 4. What is BUILT (all tested)

### Database migrations (new)
- `047_saas_billing.sql` — `platform_settings` (billing on/off, trial/grace days,
  GST), `platform_admins`, `plans` (seeded), `addons` (seeded), `subscriptions`,
  `subscription_addons`, `usage_counters`, `billing_events`, `billing_payments`,
  account billing columns; SQL functions `account_billing_state`,
  `account_limit`, `account_feature`, `account_entitlements`, `consume_usage`,
  `release_usage`; `is_account_member()` denies write roles when read-only;
  count-limit triggers (contacts, automations, flows, pipelines, api_keys,
  webhook_endpoints, invites/seats); signup creates a trial; backfill.
  **Billing is OFF by default** (self-host = unlimited).
- `048_demo_account.sql` — `accounts.is_demo`.
- `049_billing_notifications.sql` — reminder email dedupe table + add-on
  purchase columns.
- `050_platform_payment_settings.sql` — encrypted Razorpay keys in
  `platform_settings`, secret columns hidden from customers.
- `saas-migrations-047-049.sql` (repo root) — combined paste file the user ran
  on live; can be deleted.

### Server / billing
- `src/lib/billing/*`: `types.ts`, `server.ts` (entitlements, `assertFeature`,
  `assertWritable`, `assertCountBelowLimit`, broadcast quota; **all fail open**),
  `razorpay.ts` (REST client, signatures, credentials from **env first, else
  admin-saved encrypted DB values**, 30s cache), `lifecycle.ts`
  (activate/renew/cancel/add-ons), `reminders.ts`, `gst.ts`,
  `plan-limit-events.ts` (browser auto-detects 402 / trigger errors → upgrade
  dialog), `admin-guard.ts`.
- API routes: `/api/billing` (GET summary, PATCH GST details), `/checkout`,
  `/verify`, `/cancel`, `/webhook` (Razorpay, idempotent), `/addons`,
  `/reminders` (cron); `/api/admin/accounts`, `/api/admin/accounts/[id]`,
  `/api/admin/settings` (GET/PATCH incl. payments, POST = test Razorpay keys);
  `/api/demo/start`, `/api/demo/reset`.
- Plan gates added to existing routes: flows, automations, AI (draft,
  playground, auto-reply, config), API keys, public `/api/v1/*` (402
  `payment_required`), WhatsApp send, broadcasts (monthly recipient quota),
  inbound webhook pauses bots when lapsed.
- Demo guard (`assertNotDemo`) on members, API keys, WhatsApp config, billing,
  AI config, account rename/transfer.
- Cron auth accepts `x-cron-secret` or `Authorization: Bearer` (`src/lib/cron-auth.ts`).
- Email: `src/lib/email/send.ts` (Resend REST) for billing reminders.

### UI
- **Customer:** Settings → **Billing & plan** (plan/status, usage meters, plan
  picker with monthly/annual, Razorpay Checkout, add-ons, GST details, payment
  history, cancel); trial/past-due/read-only **banner**; **upgrade dialog**;
  sidebar plan card; dashboard **onboarding checklist**; demo banner.
- **SaaS owner portal `/admin`** (only `platform_admins`): metrics (MRR etc.,
  demo excluded), billing settings, **Payments (Razorpay)** card (keys, test
  connection, webhook URL + events), plans editor, workspace list with manage
  dialog (plan, status, trial extend, paid-until, add-ons, limit overrides,
  suspend).
- **Redesign:** warm paper/charcoal neutrals, **Clay** terracotta accent
  (default, light mode default), Newsreader serif headings, softer radius;
  grouped + collapsible sidebar; `dark:` variant bound to `data-mode`; 130 pale
  status colours fixed for light mode; charts follow accent.
- **Logo:** concept B "Growth" (chat bubble + rising bars) —
  `src/components/brand/logo.tsx`, favicon `src/app/icon.tsx`,
  `src/app/apple-icon.tsx`, files in `public/brand/`.
- **Marketing site** `src/app/(marketing)/`: landing (announcement bar,
  centred hero, framed product preview, "works with" strip, pill-tab product
  tour, bento grid with filled visuals, stats, About, How it works, **full
  pricing section** (`/#pricing`, live plans), 2-column FAQ, **Web3Forms
  contact form**, closing CTA), `/pricing`, `/demo`, `/contact`, `/terms`,
  `/privacy`, `/refund` (legal = templates, need lawyer review). Copy in
  `src/content/marketing.ts` + `src/content/legal.ts`. No fake logos/testimonials
  by design. `NEXT_PUBLIC_MARKETING_SITE=false` → `/` goes to the app.
- **Supabase Auth email templates:** `npm run emails:build` →
  `supabase/templates/*.html` + `SUBJECTS.md` (6 branded templates).
- Translations for all new strings in en/pt/es/ko (parity test enforced).

### Tests / verification
- `npx vitest run` → 1,169 passed (+14 integration tests skipped unless
  `BILLING_IT_*` env set; they pass against a local Supabase).
- `scripts/e2e/plan-access.cjs` → **43/43** (every plan's access, read-only,
  suspended, admin vs customer) against local stack + app on :3100.
- `scripts/e2e/payments.cjs` → **18/18** (encrypted Razorpay settings, no leaks,
  checkout enabled after save, webhook signing, 403 for customers).
- Local test stack recipe: copy `supabase/` to a scratch dir, set
  `project_id = "wacrm-billing-test"`, api port 55421 / db 55422 (the user has
  another local Supabase on default ports — don't stop it), `supabase start`,
  build with local `NEXT_PUBLIC_SUPABASE_*`, `next start -p 3100`, run the
  scripts. Rebuild with `.env.local` afterwards.

## 5. Current status / where we stopped

- User applied migrations **047–049** on live Supabase and made
  `shivang.gaur@apstia.com` a platform admin (`/admin` works).
- **Open issue:** on live, "Choose plan"/"Buy" buttons are disabled because
  Razorpay isn't connected. Next steps for the user:
  1. Run **`050_platform_payment_settings.sql`** on live Supabase.
  2. `/admin#payments` → paste Razorpay **test** Key ID + Secret → Save → Test
     connection.
  3. Razorpay → Webhooks: add `https://<public-domain>/api/billing/webhook`
     (not localhost), secret, events listed on the page; paste secret in admin.
  4. Billing enabled ON in /admin. Add-on Buy stays disabled during trial by design.
  - Diagnose via `GET /api/billing` → `checkout_available`.
- Email: user is setting up **Resend** with domain `cluade.si` (send-only; for
  inbound mailboxes suggested Zoho Mail free / Cloudflare Email Routing /
  ImprovMX). Supabase custom SMTP: `smtp.resend.com`, port 465, user `resend`,
  password = API key, sender `no-reply@cluade.si`.

## 6. REMAINING work

**User actions (outside code)**
- Apply migration 050 on live; connect Razorpay (above); Razorpay KYC for live keys.
- Meta **Tech Provider** + App Review (needed for Embedded Signup).
- Set env: `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_LEGAL_ENTITY`,
  `NEXT_PUBLIC_BUSINESS_ADDRESS`, `NEXT_PUBLIC_SUPPORT_PHONE`,
  `NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`,
  `DEMO_ENABLED=true` (optional), `NEXT_PUBLIC_SITE_URL`; then
  `npm run emails:build` and paste templates into Supabase.
- Schedule crons: `/api/automations/cron` + `/api/flows/cron` (every minute),
  `/api/billing/reminders` (hourly), `/api/demo/reset` (nightly).
- Lawyer review of legal pages; rewrite About copy; reconsider the name.
- Check Meta INR billing migration deadline (31 Dec 2026) for WABA 3051122468573522.

**Code still to build**
- Embedded Signup "Connect WhatsApp" button (after Meta approval).
- Paddle (USD / global customers).
- Multiple WhatsApp numbers per account (add-on groundwork).
- Platform AI credits (non-BYOK) add-on.
- Redis/Upstash rate limiting (current limiter is in-memory).
- Per-user locale; optional separate owner-console layout for `/admin`.
- Real testimonials / customer logos once available.
- Commit the work (ask the user first) and eventually a PR.
