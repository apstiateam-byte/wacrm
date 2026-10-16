// ============================================================
// A signed-in user whose `profiles` row is gone (deleted by an operator,
// or never created because handle_new_user failed) has no account and
// can do nothing in the app — but their Supabase Auth login still
// works. Treat that session as removed: sign it out and say why.
//
// Used by the proxy (every page load), the login form and the browser
// AuthProvider (focus / interval re-checks).
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

/** `?error=` value the login page explains. */
export const ACCOUNT_REMOVED_ERROR = 'account_removed';

/**
 * true  — the profile row exists
 * false — the lookup succeeded and found no row (account removed)
 * null  — the lookup failed; callers must NOT sign out on a hiccup
 */
export async function profileExists(supabase: SupabaseClient, userId: string): Promise<boolean | null> {
  try {
    const { data, error } = await supabase.from('profiles').select('id').eq('user_id', userId).maybeSingle();
    if (error) return null;
    return data != null;
  } catch {
    return null;
  }
}
