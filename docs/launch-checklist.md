# Launch checklist: Razorpay and Meta Tech Provider

These two approvals decide your launch date more than any code does. Each
takes days to weeks, so start them **now** and in parallel. Both have to
be done by you, the business owner: they need your KYC documents, your
logins and legal declarations.

Everything the reviewers look at on your website is already built:
- **Legal pages:** `/terms`, `/privacy` and `/refund`, plus `/contact`
  with your address, phone and email.
- **Pricing page:** `/pricing`, with prices in INR.
- **Footer:** every page links to all of the above.

## 0. Before applying: fill in your business details

Set these in your Vercel environment variables and redeploy, so the
legal and contact pages show real details. Reviewers reject placeholder
text.

| Variable | Example |
| --- | --- |
| `NEXT_PUBLIC_APP_NAME` | Your product name |
| `NEXT_PUBLIC_LEGAL_ENTITY` | Registered business name (as on GST / PAN) |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | support@yourdomain.com (on your own domain) |
| `NEXT_PUBLIC_SUPPORT_PHONE` | +91 … |
| `NEXT_PUBLIC_BUSINESS_ADDRESS` | Full registered address |
| `NEXT_PUBLIC_BOOKING_URL` | Your Cal.com / Calendly link (optional) |
| `NEXT_PUBLIC_SALES_URL` | mailto: or booking link for Enterprise |

Then:
- [ ] **Have a lawyer review** the text in `src/content/legal.ts`. It is a
      starting template, not legal advice. Pay particular attention to
      the refund terms, the grievance officer, and governing law.
- [ ] **Use a custom domain**, not `*.vercel.app`. Both Razorpay and Meta
      prefer it, and some reviewers reject shared subdomains.
- [ ] **Check every footer link works** on the live domain.

## 1. Razorpay (Indian payments)

1. **Sign up** at https://dashboard.razorpay.com/signup with your business
   email.
2. **Complete activation (KYC)** under *Account & Settings → Business
   details*:
   - Business type, PAN, GSTIN, and bank account for settlements.
   - Business website: your custom domain.
   - Category: *Software / SaaS*.
   - The website checker looks for the policy pages above. Point it at
     `/terms`, `/privacy`, `/refund` and `/contact`.
3. **Ask Razorpay to enable Subscriptions**: *Account & Settings →
   Configurations*, or contact Razorpay support. Recurring payments
   (UPI Autopay and card mandates) must be switched on for your account.
4. **Test mode first:**
   - Copy the test keys into `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
   - Add the webhook `https://<your-domain>/api/billing/webhook`, set a
     secret, and copy it to `RAZORPAY_WEBHOOK_SECRET`.
   - Tick these events: `subscription.activated`, `subscription.charged`,
     `subscription.pending`, `subscription.halted`,
     `subscription.cancelled`, `subscription.completed`, `order.paid`.
   - Buy a monthly plan and an annual plan with Razorpay's test cards or
     UPI, as described in `docs/saas-billing.md`.
5. **After activation:** generate live keys and add a live webhook (same
   URL, new secret), then swap the three environment variables to the
   live values.

## 2. Meta Tech Provider (self-serve WhatsApp onboarding)

This lets customers click **Connect WhatsApp** instead of pasting tokens
and IDs (the same steps you went through to fix your own number). The
Embedded Signup button is the next build step once this is approved.

1. **Verify your business:** Meta Business Suite → *Business settings →
   Security Center → Start verification*. You'll need business documents
   (GST certificate, incorporation certificate or utility bill) and the
   domain or phone you used.
2. **Turn on two-factor authentication** for everyone with admin access to
   the Business Manager.
3. **Prepare your Meta app** (SoltradeIndia or a dedicated production app):
   - App settings → Basic: add an app icon, the privacy policy URL
     (`/privacy`), the terms URL (`/terms`), the category, and a contact
     email.
   - App mode: **Live**.
4. **Become a Tech Provider:** in the app, go to *WhatsApp → Getting
   started* (or *Partner solutions*) and follow the steps. This asks for
   business verification and the app review below.
5. **Pass App Review** for **Advanced Access** to
   `whatsapp_business_management` and `whatsapp_business_messaging`.
   Record two screencasts on your live domain:
   - **Messaging:** send a message from the inbox and show it arriving on a
     phone in WhatsApp.
   - **Template management:** create a template in Settings → Templates and
     show it submitted to Meta.

   Explain in the notes that businesses use your app to message
   customers who opted in, and to manage their templates.
6. **Create an Embedded Signup configuration:** *Facebook Login for
   Business → Configurations*, using the WhatsApp Embedded Signup
   variation. Keep the **configuration ID**; the Connect WhatsApp button
   will need it.

**Billing note:** as a Tech Provider, each customer adds their own payment
method to their WhatsApp Business Account and pays Meta directly. Your
pricing already says "no markup on Meta fees". Reselling message credit
from a wallet needs Meta *Solution Partner* status, or working through
one. Revisit that later if you want message margin.

**Your own number:** Meta requires Indian WABAs to move to INR billing by
**31 Dec 2026**, or messages stop on 1 Jan 2027. Check WhatsApp Manager →
*Billing & payments* for your WABA `3051122468573522`.

## 3. Go-live switches in the app

- [ ] Apply migrations 047 and 048 to production (`supabase db push`).
- [ ] Make yourself a platform admin (SQL in `docs/saas-billing.md`).
- [ ] In /admin, review plans and prices, then turn **Billing enabled** on.
- [ ] Live demo:
  - set `DEMO_ENABLED=true`;
  - optionally set `DEMO_USER_EMAIL` to an address on your domain;
  - schedule `GET /api/demo/reset` nightly with the cron secret.
- [ ] Schedule `/api/automations/cron` and `/api/flows/cron` every minute,
      and `/api/billing/reminders` hourly (see `docs/saas-billing.md` →
      Scheduled jobs).
- [ ] Set `RESEND_API_KEY` and `EMAIL_FROM` with a verified sending
      domain, so trial and payment emails go out.
- [ ] Apply migration 049 as well (`supabase db push` applies 047–049).
- [ ] Set `NEXT_PUBLIC_SITE_URL` to your custom domain.
