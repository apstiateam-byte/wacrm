// ============================================================
// Browser-side detection of plan-limit failures.
//
// Plan limits are enforced in two places the UI talks to:
//   - Postgres triggers (client-side Supabase inserts), which raise
//     `plan_limit_reached` → PostgREST answers 400 with that message;
//     a lapsed account's writes fail RLS → 42501.
//   - Our API routes, which answer HTTP 402 with a PlanLimitPayload.
//
// Rather than teach every one of the ~30 call sites about billing, the
// Supabase browser client and window.fetch are wrapped here: any such
// response emits a window event, and <BillingProvider> listens and
// opens the upgrade dialog. Call sites keep their own error handling.
// ============================================================

import { parsePlanLimitError, type PlanLimitPayload } from './types';

export const PLAN_LIMIT_EVENT = 'wacrm:plan-limit';

export type PlanLimitEventDetail = PlanLimitPayload | { code: 'rls_denied' };

function emit(detail: PlanLimitEventDetail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<PlanLimitEventDetail>(PLAN_LIMIT_EVENT, { detail }));
}

async function inspect(response: Response): Promise<void> {
  try {
    const body = (await response.json()) as Record<string, unknown>;
    const parsed = parsePlanLimitError(body);
    if (parsed) {
      emit(parsed);
      return;
    }
    if (body.code === '42501') emit({ code: 'rls_denied' });
  } catch {
    // Not JSON — nothing to report.
  }
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/** fetch for the Supabase browser client: reports PostgREST plan errors. */
export const planLimitAwareFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  if (response.status >= 400 && urlOf(input).includes('/rest/v1/')) {
    void inspect(response.clone());
  }
  return response;
};

let installed = false;

/**
 * Wrap window.fetch once so same-origin `/api/*` 402s are reported.
 * Only failed responses are cloned and read; everything else passes
 * straight through.
 */
export function installPlanLimitFetch(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const response = await original(input, init);
    if (response.status === 402) {
      const url = urlOf(input);
      if (url.startsWith('/api/') || url.startsWith(`${window.location.origin}/api/`)) {
        void inspect(response.clone());
      }
    }
    return response;
  };
}
