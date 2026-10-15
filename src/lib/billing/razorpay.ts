// ============================================================
// Razorpay REST client (Subscriptions + Orders) and signature checks.
//
// Plain fetch against https://api.razorpay.com/v1 with HTTP basic auth
// (key id : key secret) — no SDK dependency. Server-only: it reads
// RAZORPAY_KEY_SECRET.
//
// Why both Subscriptions and Orders: RBI's e-mandate rules require the
// customer to re-authenticate every recurring debit above ₹15,000, so
// monthly plans renew automatically via a Subscription (UPI Autopay /
// card mandate) while annual plans are charged once as an Order and
// renewed by the customer.
// ============================================================

import { createHmac, timingSafeEqual } from 'node:crypto';

import { supabaseAdmin } from '@/lib/flows/admin-client';
import { decrypt } from '@/lib/whatsapp/encryption';

const API_BASE = 'https://api.razorpay.com/v1';

export class RazorpayError extends Error {
  readonly status: number;
  readonly code: string | null;
  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = 'RazorpayError';
    this.status = status;
    this.code = code;
  }
}

export interface RazorpayCredentials {
  keyId: string;
  keySecret: string;
}

// ------------------------------------------------------------
// Credentials: environment variables first (RAZORPAY_KEY_ID /
// RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET), otherwise the values a
// platform admin saved in /admin → Payments (migration 050, secrets
// encrypted with ENCRYPTION_KEY). Cached briefly so a checkout doesn't
// hit the database for every Razorpay call; saving in /admin clears it.
// ------------------------------------------------------------

interface StoredPaymentSettings {
  keyId: string | null;
  keySecret: string | null;
  webhookSecret: string | null;
}

const CACHE_MS = 30_000;
let cache: { at: number; value: StoredPaymentSettings } | null = null;

export function clearRazorpaySettingsCache(): void {
  cache = null;
}

async function storedSettings(): Promise<StoredPaymentSettings> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const empty: StoredPaymentSettings = { keyId: null, keySecret: null, webhookSecret: null };
  let value = empty;
  try {
    const { data } = await supabaseAdmin()
      .from('platform_settings')
      .select('razorpay_key_id, razorpay_key_secret_enc, razorpay_webhook_secret_enc')
      .eq('id', true)
      .maybeSingle();
    const dec = (v: string | null | undefined) => {
      if (!v) return null;
      try {
        return decrypt(v);
      } catch {
        console.error('[razorpay] stored secret could not be decrypted — was ENCRYPTION_KEY changed?');
        return null;
      }
    };
    value = {
      keyId: (data?.razorpay_key_id as string | null)?.trim() || null,
      keySecret: dec(data?.razorpay_key_secret_enc as string | null),
      webhookSecret: dec(data?.razorpay_webhook_secret_enc as string | null),
    };
  } catch {
    // Table/columns missing (migration 050 not applied) — env only.
    value = empty;
  }
  cache = { at: Date.now(), value };
  return value;
}

/** Null when Razorpay isn't configured — checkout is then unavailable. */
export async function razorpayCredentials(): Promise<RazorpayCredentials | null> {
  const envId = process.env.RAZORPAY_KEY_ID?.trim();
  const envSecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (envId && envSecret) return { keyId: envId, keySecret: envSecret };
  const stored = await storedSettings();
  return stored.keyId && stored.keySecret ? { keyId: stored.keyId, keySecret: stored.keySecret } : null;
}

export async function razorpayWebhookSecret(): Promise<string | null> {
  const env = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (env) return env;
  return (await storedSettings()).webhookSecret;
}

/** Where each credential comes from, for the admin console. */
export async function razorpayConfigSources(): Promise<{
  keys: 'env' | 'admin' | null;
  webhook: 'env' | 'admin' | null;
  keyId: string | null;
}> {
  const stored = await storedSettings();
  const envKeys = Boolean(process.env.RAZORPAY_KEY_ID?.trim() && process.env.RAZORPAY_KEY_SECRET?.trim());
  const envHook = Boolean(process.env.RAZORPAY_WEBHOOK_SECRET?.trim());
  return {
    keys: envKeys ? 'env' : stored.keyId && stored.keySecret ? 'admin' : null,
    webhook: envHook ? 'env' : stored.webhookSecret ? 'admin' : null,
    keyId: envKeys ? process.env.RAZORPAY_KEY_ID!.trim() : stored.keyId,
  };
}

/** Cheap authenticated call to confirm a key pair works. */
export async function testRazorpayCredentials(creds: RazorpayCredentials): Promise<{ ok: boolean; error?: string }> {
  try {
    await call<unknown>(creds, 'GET', '/plans?count=1');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function call<T>(
  creds: RazorpayCredentials,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<T> {
  const auth = Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString('base64');
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${auth}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await response.json().catch(() => ({}))) as {
    error?: { description?: string; code?: string };
  } & T;
  if (!response.ok) {
    throw new RazorpayError(
      data.error?.description ?? `Razorpay API error ${response.status}`,
      response.status,
      data.error?.code ?? null,
    );
  }
  return data;
}

export interface RazorpayPlan {
  id: string;
}

export interface RazorpaySubscription {
  id: string;
  plan_id: string;
  status:
    | 'created'
    | 'authenticated'
    | 'active'
    | 'pending'
    | 'halted'
    | 'cancelled'
    | 'completed'
    | 'expired'
    | 'paused';
  current_start: number | null;
  current_end: number | null;
  short_url?: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
  notes?: Record<string, string>;
}

/** Create a monthly Razorpay plan (amount in paise, tax included). */
export function createPlan(
  creds: RazorpayCredentials,
  args: { name: string; amountPaise: number; description?: string; notes?: Record<string, string> },
): Promise<RazorpayPlan> {
  return call<RazorpayPlan>(creds, 'POST', '/plans', {
    period: 'monthly',
    interval: 1,
    item: {
      name: args.name,
      amount: args.amountPaise,
      currency: 'INR',
      description: args.description,
    },
    notes: args.notes,
  });
}

export function createSubscription(
  creds: RazorpayCredentials,
  args: { planId: string; totalCount?: number; quantity?: number; notes: Record<string, string> },
): Promise<RazorpaySubscription> {
  return call<RazorpaySubscription>(creds, 'POST', '/subscriptions', {
    plan_id: args.planId,
    // Razorpay requires a finite cycle count; 10 years of monthly cycles.
    total_count: args.totalCount ?? 120,
    ...(args.quantity && args.quantity > 1 ? { quantity: args.quantity } : {}),
    customer_notify: 1,
    notes: args.notes,
  });
}

export function fetchSubscription(creds: RazorpayCredentials, id: string): Promise<RazorpaySubscription> {
  return call<RazorpaySubscription>(creds, 'GET', `/subscriptions/${encodeURIComponent(id)}`);
}

export function cancelSubscription(
  creds: RazorpayCredentials,
  id: string,
  atCycleEnd: boolean,
): Promise<RazorpaySubscription> {
  return call<RazorpaySubscription>(creds, 'POST', `/subscriptions/${encodeURIComponent(id)}/cancel`, {
    cancel_at_cycle_end: atCycleEnd ? 1 : 0,
  });
}

export function createOrder(
  creds: RazorpayCredentials,
  args: { amountPaise: number; receipt: string; notes: Record<string, string> },
): Promise<RazorpayOrder> {
  return call<RazorpayOrder>(creds, 'POST', '/orders', {
    amount: args.amountPaise,
    currency: 'INR',
    receipt: args.receipt,
    notes: args.notes,
  });
}

function hmacHex(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Checkout handler signature for an Order: HMAC(order_id|payment_id). */
export function verifyOrderPaymentSignature(
  keySecret: string,
  args: { orderId: string; paymentId: string; signature: string },
): boolean {
  return safeEqualHex(hmacHex(keySecret, `${args.orderId}|${args.paymentId}`), args.signature);
}

/** Checkout handler signature for a Subscription: HMAC(payment_id|subscription_id). */
export function verifySubscriptionPaymentSignature(
  keySecret: string,
  args: { subscriptionId: string; paymentId: string; signature: string },
): boolean {
  return safeEqualHex(
    hmacHex(keySecret, `${args.paymentId}|${args.subscriptionId}`),
    args.signature,
  );
}

/** Webhook signature: HMAC(raw body) with the webhook secret. */
export function verifyWebhookSignature(
  webhookSecret: string,
  rawBody: string,
  signature: string | null,
): boolean {
  if (!signature) return false;
  return safeEqualHex(hmacHex(webhookSecret, rawBody), signature);
}

/** Unix seconds → ISO string (Razorpay timestamps). */
export function unixToIso(seconds: number | null | undefined): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}
