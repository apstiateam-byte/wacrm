// ============================================================
// /api/admin/settings — platform-wide billing switches + plan catalogue.
//
//   GET   — settings, plans, add-ons, and headline platform metrics
//   PATCH — { settings?: {...}, plans?: [{ code, ...editable fields }] }
// ============================================================

import { NextResponse } from 'next/server';

import { toErrorResponse } from '@/lib/auth/account';
import { requirePlatformAdmin } from '@/lib/billing/admin-guard';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import {
  clearRazorpaySettingsCache,
  razorpayConfigSources,
  razorpayCredentials,
  testRazorpayCredentials,
} from '@/lib/billing/razorpay';
import { encrypt } from '@/lib/whatsapp/encryption';
import { FEATURE_KEYS, LIMIT_KEYS } from '@/lib/billing/types';

export async function GET() {
  try {
    await requirePlatformAdmin();
    const db = supabaseAdmin();
    const [settings, plans, addons, subs, demo] = await Promise.all([
      db.from('platform_settings').select('*').eq('id', true).maybeSingle(),
      db.from('plans').select('*').order('sort_order'),
      db.from('addons').select('*').order('price_inr_monthly'),
      db.from('subscriptions').select('account_id, plan_code, status, billing_interval, trial_ends_at, current_period_end'),
      db.from('accounts').select('id').eq('is_demo', true),
    ]);
    // The live-demo workspace is not a customer.
    const demoIds = new Set((demo.data ?? []).map((a) => a.id as string));

    // Headline metrics. MRR counts active paid subscriptions at their
    // list price (annual ÷ 12), excluding tax.
    const priceBy = new Map(
      (plans.data ?? []).map((p) => [p.code as string, { m: p.price_inr_monthly as number | null, a: p.price_inr_annual as number | null }]),
    );
    const now = Date.now();
    let mrr = 0;
    const counts = { total: 0, trialing: 0, active: 0, past_due: 0, lapsed: 0 };
    for (const s of subs.data ?? []) {
      if (demoIds.has(s.account_id as string)) continue;
      counts.total++;
      if (s.status === 'trialing') {
        if (!s.trial_ends_at || new Date(s.trial_ends_at as string).getTime() > now) counts.trialing++;
        else counts.lapsed++;
      } else if (s.status === 'active') {
        counts.active++;
        const price = priceBy.get(s.plan_code as string);
        if (price) mrr += s.billing_interval === 'annual' ? Math.round((price.a ?? 0) / 12) : price.m ?? 0;
      } else if (s.status === 'past_due') counts.past_due++;
      else counts.lapsed++;
    }

    const sources = await razorpayConfigSources();
    const {
      razorpay_key_id: _keyId,
      razorpay_key_secret_enc: _secret,
      razorpay_webhook_secret_enc: _hook,
      ...publicSettings
    } = (settings.data ?? {}) as Record<string, unknown>;
    void _keyId;
    void _secret;
    void _hook;

    return NextResponse.json({
      settings: publicSettings,
      plans: plans.data ?? [],
      addons: addons.data ?? [],
      metrics: { ...counts, mrr_inr: mrr },
      razorpay_configured: sources.keys !== null,
      razorpay_webhook_configured: sources.webhook !== null,
      // Never the secrets — only where they come from and the public key id.
      payments: {
        keys_source: sources.keys,
        webhook_source: sources.webhook,
        key_id: sources.keyId,
        mode: sources.keyId?.startsWith('rzp_live_') ? 'live' : sources.keyId ? 'test' : null,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

function intOrNull(v: unknown): number | null | undefined {
  if (v === null) return null;
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return Math.floor(v);
  return undefined;
}

export async function PATCH(request: Request) {
  try {
    await requirePlatformAdmin();
    const db = supabaseAdmin();
    const body = (await request.json().catch(() => ({}))) as {
      settings?: Record<string, unknown>;
      plans?: Record<string, unknown>[];
      payments?: { key_id?: unknown; key_secret?: unknown; webhook_secret?: unknown; clear?: unknown };
    };

    // Razorpay credentials. Blank secret fields keep the saved value;
    // `clear: true` removes everything stored in the database.
    if (body.payments) {
      const pay = body.payments;
      const patch: Record<string, unknown> = {};
      if (pay.clear === true) {
        patch.razorpay_key_id = null;
        patch.razorpay_key_secret_enc = null;
        patch.razorpay_webhook_secret_enc = null;
      } else {
        const keyId = typeof pay.key_id === 'string' ? pay.key_id.trim() : undefined;
        if (keyId !== undefined) {
          if (keyId && !/^rzp_(test|live)_[A-Za-z0-9]+$/.test(keyId)) {
            return NextResponse.json({ error: 'Key ID should look like rzp_test_… or rzp_live_…' }, { status: 400 });
          }
          patch.razorpay_key_id = keyId || null;
        }
        const keySecret = typeof pay.key_secret === 'string' ? pay.key_secret.trim() : '';
        if (keySecret) patch.razorpay_key_secret_enc = encrypt(keySecret);
        const hook = typeof pay.webhook_secret === 'string' ? pay.webhook_secret.trim() : '';
        if (hook) patch.razorpay_webhook_secret_enc = encrypt(hook);
      }
      if (Object.keys(patch).length) {
        patch.updated_at = new Date().toISOString();
        const { error } = await db.from('platform_settings').update(patch).eq('id', true);
        if (error) throw error;
        clearRazorpaySettingsCache();
      }
    }

    if (body.settings) {
      const s = body.settings;
      const patch: Record<string, unknown> = {};
      if (typeof s.billing_enabled === 'boolean') patch.billing_enabled = s.billing_enabled;
      for (const [key, max] of [['trial_days', 365], ['grace_days', 90], ['gst_percent', 100]] as const) {
        const v = intOrNull(s[key]);
        if (v != null && v <= max) patch[key] = v;
      }
      if (Object.keys(patch).length) {
        patch.updated_at = new Date().toISOString();
        const { error } = await db.from('platform_settings').update(patch).eq('id', true);
        if (error) throw error;
      }
    }

    for (const p of body.plans ?? []) {
      if (typeof p.code !== 'string') continue;
      const patch: Record<string, unknown> = {};
      for (const key of ['name', 'description'] as const) {
        if (typeof p[key] === 'string') patch[key] = (p[key] as string).slice(0, 300);
      }
      for (const key of ['is_public', 'is_active', 'highlighted', 'contact_sales'] as const) {
        if (typeof p[key] === 'boolean') patch[key] = p[key];
      }
      for (const key of ['price_inr_monthly', 'price_inr_annual', 'sort_order'] as const) {
        const v = intOrNull(p[key]);
        if (v !== undefined) patch[key] = v;
      }
      if (p.limits && typeof p.limits === 'object') {
        const limits: Record<string, number | null> = {};
        for (const key of LIMIT_KEYS) {
          const v = intOrNull((p.limits as Record<string, unknown>)[key]);
          if (v !== undefined) limits[key] = v;
        }
        patch.limits = limits;
      }
      if (p.features && typeof p.features === 'object') {
        const features: Record<string, boolean> = {};
        for (const key of FEATURE_KEYS) {
          features[key] = (p.features as Record<string, unknown>)[key] === true;
        }
        patch.features = features;
      }
      // A price change needs a new Razorpay plan (Razorpay plans are
      // immutable) — clear the cached id so checkout creates one.
      // Existing subscribers stay on their old price until they switch.
      if ('price_inr_monthly' in patch) patch.razorpay_plan_id_monthly = null;
      if (Object.keys(patch).length) {
        const { error } = await db.from('plans').update(patch).eq('code', p.code);
        if (error) throw error;
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * POST /api/admin/settings — test Razorpay keys. Body may carry
 * { key_id, key_secret } to test before saving; otherwise the saved /
 * environment keys are tested.
 */
export async function POST(request: Request) {
  try {
    await requirePlatformAdmin();
    const body = (await request.json().catch(() => ({}))) as { key_id?: unknown; key_secret?: unknown };
    let creds: { keyId: string; keySecret: string } | null = null;
    if (typeof body.key_id === 'string' && typeof body.key_secret === 'string' && body.key_id.trim() && body.key_secret.trim()) {
      creds = { keyId: body.key_id.trim(), keySecret: body.key_secret.trim() };
    } else {
      creds = await razorpayCredentials();
    }
    if (!creds) return NextResponse.json({ ok: false, error: 'No Razorpay keys saved yet.' });
    const result = await testRazorpayCredentials(creds);
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
