// ============================================================
// Billing types shared by server and client.
//
// The source of truth for plans, limits and an account's billing
// state is the database (migration 047): `account_entitlements()`
// computes everything below in one round trip so the app never
// re-implements the limit arithmetic.
// ============================================================

/** Count / metered limits a plan can cap. `null` = unlimited. */
export const LIMIT_KEYS = [
  'seats',
  'contacts',
  'broadcast_recipients_monthly',
  'pipelines',
  'automations',
  'flows',
  'api_keys',
  'webhook_endpoints',
] as const;
export type LimitKey = (typeof LIMIT_KEYS)[number];

/** On/off features a plan can include. */
export const FEATURE_KEYS = ['flows', 'ai', 'api'] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

/**
 * Effective billing state, as computed by `account_billing_state()`.
 * `trial_expired`, `expired` and `suspended` are read-only.
 */
export type BillingState =
  | 'unlimited'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'trial_expired'
  | 'expired'
  | 'suspended';

export type BillingInterval = 'monthly' | 'annual';

export interface Entitlements {
  state: BillingState;
  writable: boolean;
  plan_code: string | null;
  limits: Record<LimitKey, number | null>;
  features: Record<FeatureKey, boolean>;
  usage: Record<LimitKey, number>;
}

export interface Plan {
  code: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_public: boolean;
  is_active: boolean;
  highlighted: boolean;
  contact_sales: boolean;
  price_inr_monthly: number | null;
  price_inr_annual: number | null;
  limits: Partial<Record<LimitKey, number | null>>;
  features: Partial<Record<FeatureKey, boolean>>;
}

export interface Addon {
  code: string;
  name: string;
  description: string | null;
  limit_key: LimitKey;
  increment: number;
  price_inr_monthly: number;
  is_active: boolean;
}

export interface Subscription {
  account_id: string;
  plan_code: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';
  billing_interval: BillingInterval | null;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  provider: 'razorpay' | 'manual' | null;
}

export interface BillingPayment {
  id: string;
  provider_payment_id: string;
  plan_code: string | null;
  billing_interval: string | null;
  amount_paise: number;
  currency: string;
  status: string;
  invoice_url: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface BillingDetails {
  billing_name: string | null;
  billing_email: string | null;
  billing_gstin: string | null;
  billing_address: string | null;
  billing_state: string | null;
}

/** Shape of GET /api/billing. */
export interface BillingSummary {
  billing_enabled: boolean;
  checkout_available: boolean;
  gst_percent: number;
  prices_include_gst: boolean;
  entitlements: Entitlements;
  subscription: Subscription | null;
  plans: Plan[];
  addons: Addon[];
  account_addons: {
    addon_code: string;
    quantity: number;
    cancel_at_period_end: boolean;
    managed: boolean;
  }[];
  /** Only returned to admin+. */
  payments: BillingPayment[] | null;
  details: BillingDetails | null;
  is_platform_admin: boolean;
  /** The shared live-demo workspace (data resets nightly). */
  is_demo: boolean;
}

/** States in which the account can no longer write. */
export const READ_ONLY_STATES: readonly BillingState[] = ['trial_expired', 'expired', 'suspended'];

export function isReadOnlyState(state: BillingState): boolean {
  return READ_ONLY_STATES.includes(state);
}

/** Whole days left until `iso` (never negative). */
export function daysUntil(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/** Annual price as a per-month figure, rounded to the rupee. */
export function annualMonthlyEquivalent(plan: Pick<Plan, 'price_inr_annual'>): number | null {
  return plan.price_inr_annual == null ? null : Math.round(plan.price_inr_annual / 12);
}

/** Whole-percent saving of annual vs 12× monthly. */
export function annualSavingPercent(
  plan: Pick<Plan, 'price_inr_monthly' | 'price_inr_annual'>,
): number | null {
  const { price_inr_monthly: m, price_inr_annual: a } = plan;
  if (m == null || a == null || m <= 0) return null;
  return Math.round((1 - a / (m * 12)) * 100);
}

/** Price including tax, in paise (Razorpay's unit). */
export function withTaxPaise(priceInr: number, gstPercent: number): number {
  return Math.round(priceInr * (1 + gstPercent / 100) * 100);
}

/** How list prices are taxed (`platform_settings`). */
export interface TaxSettings {
  gstPercent: number;
  /** List prices already include GST and are charged as-is. */
  pricesIncludeGst: boolean;
}

/** What the customer is charged for a list price, in paise. */
export function chargePaise(priceInr: number, tax: TaxSettings): number {
  return tax.pricesIncludeGst ? Math.round(priceInr * 100) : withTaxPaise(priceInr, tax.gstPercent);
}

/** What the customer is charged for a list price, in rupees. */
export function finalPriceInr(priceInr: number, tax: TaxSettings): number {
  return chargePaise(priceInr, tax) / 100;
}

/** Reads the tax columns of a `platform_settings` row (defaults: 18%, exclusive). */
export function taxSettingsOf(
  row: { gst_percent?: unknown; prices_include_gst?: unknown } | null | undefined,
): TaxSettings {
  return {
    gstPercent: Number(row?.gst_percent ?? 18),
    pricesIncludeGst: row?.prices_include_gst === true,
  };
}

/** Usage ratio 0..1 for a meter; null when unlimited. */
export function usageRatio(used: number, limit: number | null): number | null {
  if (limit == null) return null;
  if (limit <= 0) return used > 0 ? 1 : 0;
  return Math.min(1, used / limit);
}

/**
 * Error payload the database raises when a count limit is hit
 * (`plan_limit_reached`, DETAIL = {"key","limit"}), and the shape
 * the billing API answers with on 402.
 */
export interface PlanLimitPayload {
  code: 'plan_limit_reached' | 'feature_not_in_plan' | 'account_read_only';
  key?: LimitKey | FeatureKey;
  limit?: number | null;
}

/**
 * Recognise a plan-limit failure from either a Supabase/PostgREST
 * error (`{ message: 'plan_limit_reached', details: '{"key":..}' }`)
 * or a billing 402 body (`{ code: 'plan_limit_reached', key, limit }`).
 */
export function parsePlanLimitError(err: unknown): PlanLimitPayload | null {
  if (!err || typeof err !== 'object') return null;
  const e = err as Record<string, unknown>;
  const code = (e.code as string | undefined) ?? (e.message as string | undefined);
  if (code === 'feature_not_in_plan' || code === 'account_read_only') {
    return { code, key: e.key as FeatureKey | undefined };
  }
  if (code === 'plan_limit_reached' || e.message === 'plan_limit_reached') {
    let key = e.key as LimitKey | undefined;
    let limit = e.limit as number | null | undefined;
    if (typeof e.details === 'string') {
      try {
        const parsed = JSON.parse(e.details) as { key?: LimitKey; limit?: number };
        key = parsed.key ?? key;
        limit = parsed.limit ?? limit;
      } catch {
        // details was not JSON — keep what we have
      }
    }
    return { code: 'plan_limit_reached', key, limit };
  }
  return null;
}
