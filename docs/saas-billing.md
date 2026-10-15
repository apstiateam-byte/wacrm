# SaaS billing: plans, trials and Razorpay

wacrm can run as a hosted, multi-tenant SaaS: every signup gets its own
workspace and a free trial, then buys a plan. This is **off by default**.
A self-hosted install that applies migration 047 behaves exactly as before:
unlimited, nothing to pay.

## How it works

| Piece | Where |
| --- | --- |
| Plans, add-ons, subscriptions, usage, payments | `supabase/migrations/047_saas_billing.sql` |
| Limit maths (plan + add-ons + overrides) | SQL: `account_billing_state`, `account_limit`, `account_feature`, `account_entitlements` |
| Count limits (contacts, automations, flows, pipelines, API keys, webhooks, seats) | Postgres triggers, for dashboard users |
| Feature gates (flows, AI, public API) and broadcast quota | API routes, via `src/lib/billing/server.ts` |
| Read-only lapsed workspaces | `is_account_member()` refuses write roles |
| Checkout, verify, cancel, webhook | `src/app/api/billing/*` |
| Operator console | `/admin` (`src/app/api/admin/*`) |
| Customer screen | Settings → Billing & plan |

**Lapsed workspaces lose nothing.** When a trial or subscription ends, the
workspace becomes read-only. Incoming WhatsApp messages are still saved,
because the webhook writes with the service role. Sending, broadcasts,
automations, flows and AI replies pause until a plan is bought.

**Billing checks fail open.** If a billing lookup errors, the request
proceeds. The admin console is the one exception: it fails closed.

### Plan states

| State | Meaning | Can write? |
| --- | --- | --- |
| `trialing` | In the free trial | yes |
| `active` | Paid and current | yes |
| `past_due` | Renewal failed, inside the grace period | yes |
| `canceled` | Won't renew, paid period still running | yes |
| `trial_expired` / `expired` | Trial or paid period (plus grace) over | **no** |
| `suspended` | Suspended by the operator | **no** |

Monthly plans renew automatically through a Razorpay Subscription (UPI
Autopay or card mandate). Annual plans are a single Razorpay Order for 12
months and don't auto-renew, because RBI requires the customer to
re-authenticate recurring debits above ₹15,000. The app reminds the
customer to renew 14 days before the period ends.

Prices are stored **excluding GST**. Checkout adds
`platform_settings.gst_percent` (default 18).

## Going live: checklist

1. **Apply the migration.** Run `supabase db push`, or apply
   `047_saas_billing.sql` in the SQL editor.
2. **Make yourself a platform admin.** Run this in the Supabase SQL editor:
   ```sql
   insert into platform_admins (user_id)
   select id from auth.users where email = 'you@example.com';
   ```
   A **Platform admin** link then appears in the sidebar.
3. **Set up Razorpay** in **/admin → Payments (Razorpay)** (migration 050):
   - Enter the Key ID and Key Secret (start with `rzp_test_` keys) and
     click **Test connection**. Secrets are stored encrypted with
     `ENCRYPTION_KEY` and never shown again.
   - In Razorpay Dashboard → Webhooks, add the webhook URL shown there
     (`https://<your-host>/api/billing/webhook`) with a secret, and paste
     the same secret into **Webhook secret**.
   - Alternatively, set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and
     `RAZORPAY_WEBHOOK_SECRET` as environment variables. They take
     precedence over the admin settings.
   - Enable these events: `subscription.activated`, `subscription.charged`,
     `subscription.pending`, `subscription.halted`, `subscription.cancelled`,
     `subscription.completed`, `order.paid`.
   - Subscriptions must be enabled on your Razorpay account.
   - Razorpay plans are created automatically on the first checkout for
     each plan.
4. **Review plans in /admin.** Set prices, limits and features. Leave a
   limit empty for unlimited.
5. **Turn billing on** in /admin → Billing settings. Existing workspaces
   get a fresh trial (the migration backfills one).
6. **Test end to end** with Razorpay test mode:
   - buy a monthly plan;
   - check that the webhook arrives (`billing_events.processed_at` is set);
   - cancel the plan;
   - buy an annual plan.

### Legal pages

Razorpay requires Terms, Privacy, Refund/Cancellation and Contact pages
on your website before it activates live payments.

## Operating

From **/admin → Workspaces → Manage** you can:
- change the plan;
- extend a trial;
- grant paid time for manual or invoice deals (status *Active* plus a
  "paid until" date);
- add add-ons;
- override a single limit;
- suspend a workspace.

The **Platform admin** page also shows:
- MRR, the monthly recurring revenue at list price, excluding GST;
- trial and paying counts.

## Scheduled jobs

Automations (wait steps) and flows need `GET /api/automations/cron` and
`GET /api/flows/cron` called every minute. Both accept the secret in
either of these headers:
- `x-cron-secret: <AUTOMATION_CRON_SECRET>`
- `Authorization: Bearer <AUTOMATION_CRON_SECRET>`

Pick a scheduler:
- **Vercel Pro:** set `CRON_SECRET` to the same value as
  `AUTOMATION_CRON_SECRET` and add a `vercel.json`:
  ```json
  { "crons": [
    { "path": "/api/automations/cron", "schedule": "* * * * *" },
    { "path": "/api/flows/cron", "schedule": "* * * * *" }
  ] }
  ```
  Vercel's Hobby plan only allows daily crons, and a per-minute schedule
  there fails the deploy.
- **Anywhere else:** use an external scheduler (cron-job.org, a VPS
  crontab, GitHub Actions) that sends the `x-cron-secret` header.

Billing access needs no cron. Trial expiry and grace periods are computed
from timestamps whenever they are read.

**Billing emails:** `GET /api/billing/reminders` (same secret, hourly or
daily) emails the workspace owner, or the billing email if one is set:

| Email | Sent when |
| --- | --- |
| Trial ending | 3 days, then 1 day, before the trial ends |
| Trial ended | Up to 7 days after the trial ended |
| Payment failed | A renewal payment fails |
| Renewal due | 14 days, then 3 days, before an annual plan ends |

Each email is claimed in `billing_notifications` (migration 049) before
it is sent, so it goes out exactly once. Set `RESEND_API_KEY` and
`EMAIL_FROM` to enable sending; until then reminders are skipped, then
sent once configured.

## Add-ons

Workspaces on a paid plan can buy add-ons in Settings → Billing & plan:
extra seats, extra contacts and extra chatbot flows.

- **Billing:** each purchase is its own monthly Razorpay subscription
  (quantity = units). The Razorpay plan is created on first use and cached
  in `addons.razorpay_plan_id`.
- **Changing quantity:** this buys a new subscription, which replaces
  (cancels) the old one once it is active.
- **Stopping:** the add-on renews no more and is removed when the paid
  month ends (`subscription.cancelled` webhook).
- **Granted by you:** add-ons you grant in /admin show as "included" and
  can't be cancelled by the customer.

## Live demo

`DEMO_ENABLED=true` turns on **Try the live demo** on `/` and `/demo`.

- **First click:** creates a demo user and a demo workspace (migration 048
  `accounts.is_demo`, plan Pro, `provider = manual`), seeded from
  `src/lib/demo/seed.ts`. Every click signs the visitor straight in.
- **Password:** the demo password is rotated on each sign-in, so a
  visitor can't lock others out.
- **Blocked for demo visitors:** inviting members, API keys, the WhatsApp
  connection, billing, AI provider keys, and renaming or transferring the
  workspace. These routes answer 403.
- **Reset:** schedule `GET /api/demo/reset` nightly (cron secret) to wipe
  and re-seed the workspace.
- **Excluded** from the /admin metrics.

## Marketing site

The public pages live in `src/app/(marketing)`: `/`, `/pricing`, `/demo`,
`/contact`, `/terms`, `/privacy` and `/refund`.
- **Copy:** `src/content/marketing.ts`.
- **Legal templates:** `src/content/legal.ts`.
- **Live prices:** `/pricing` reads plans from the database, so price
  edits in /admin appear there immediately.
- **Self-hosted installs:** set `NEXT_PUBLIC_MARKETING_SITE=false` to keep
  the old behaviour (`/` goes straight to the dashboard).

See `docs/launch-checklist.md` for the Razorpay and Meta approval steps.

## Not built yet

- Paddle (USD / global customers).
- A prepaid wallet for Meta message fees. That requires Meta Solution
  Partner status; as a Tech Provider, customers pay Meta directly.
