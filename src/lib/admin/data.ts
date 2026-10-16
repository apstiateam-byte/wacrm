// Server-only helpers for the owner console's API routes.

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Reads every row of a query, 1,000 at a time (PostgREST's default cap).
 * `build` must return a fresh query each call.
 */
export async function fetchAll<T>(
  build: () => { range: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }> },
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build().range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < pageSize) return out;
  }
}

/** Ids of the live-demo workspaces — never counted as customers. */
export async function demoAccountIds(db: SupabaseClient): Promise<Set<string>> {
  const { data } = await db.from('accounts').select('id').eq('is_demo', true);
  return new Set((data ?? []).map((a) => a.id as string));
}

/** account id → { name, owner email } for display. */
export async function accountLabels(
  db: SupabaseClient,
  accountIds: string[],
): Promise<Map<string, { name: string; owner_email: string | null }>> {
  const ids = [...new Set(accountIds)].filter(Boolean);
  if (!ids.length) return new Map();
  const { data: accounts } = await db.from('accounts').select('id, name, owner_user_id').in('id', ids);
  const ownerIds = (accounts ?? []).map((a) => a.owner_user_id as string);
  const { data: owners } = ownerIds.length
    ? await db.from('profiles').select('user_id, email').in('user_id', ownerIds)
    : { data: [] };
  const emailBy = new Map((owners ?? []).map((o) => [o.user_id as string, o.email as string | null]));
  return new Map(
    (accounts ?? []).map((a) => [
      a.id as string,
      { name: a.name as string, owner_email: emailBy.get(a.owner_user_id as string) ?? null },
    ]),
  );
}

/** Strips characters that would break a PostgREST `or`/`ilike` filter. */
export function safeSearch(q: string | null): string {
  return (q ?? '').trim().slice(0, 100).replace(/[%_,()*\\]/g, '');
}
