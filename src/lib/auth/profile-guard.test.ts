import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import { profileExists } from './profile-guard';

function client(result: { data: unknown; error: unknown } | Error): SupabaseClient {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => {
      if (result instanceof Error) throw result;
      return result;
    },
  };
  return { from: () => chain } as unknown as SupabaseClient;
}

describe('profileExists', () => {
  it('is true when the row exists', async () => {
    expect(await profileExists(client({ data: { id: 'p1' }, error: null }), 'u1')).toBe(true);
  });

  it('is false only when the lookup succeeds with no row', async () => {
    expect(await profileExists(client({ data: null, error: null }), 'u1')).toBe(false);
  });

  it('is null (unknown) on errors, so callers never sign out on a hiccup', async () => {
    expect(await profileExists(client({ data: null, error: { message: 'timeout' } }), 'u1')).toBeNull();
    expect(await profileExists(client(new Error('network')), 'u1')).toBeNull();
  });
});
