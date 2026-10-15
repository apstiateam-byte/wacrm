import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { planLimitAwareFetch } from '@/lib/billing/plan-limit-events'

// Singleton instance — one client shared across the whole browser session.
// Creating multiple clients causes auth-lock contention ("Lock was released
// because another request stole it") and intermittent fetch failures.
let browserClient: SupabaseClient | undefined

export function createClient() {
  if (browserClient) return browserClient

  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // Reports plan-limit / read-only failures to <BillingProvider>,
    // which opens the upgrade dialog. Pass-through otherwise.
    { global: { fetch: planLimitAwareFetch } }
  )

  return browserClient
}
