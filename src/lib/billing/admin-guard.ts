// Guard for /api/admin/* — the SaaS operator's routes. A platform
// admin is a row in `platform_admins` (added by hand in SQL; see
// docs/saas-billing.md). Everything under /api/admin uses the
// service-role client, so this check is the only gate.

import { createClient } from '@/lib/supabase/server';
import { ForbiddenError, UnauthorizedError } from '@/lib/auth/account';
import { isPlatformAdmin } from './server';

export async function requirePlatformAdmin(): Promise<{ userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError();
  if (!(await isPlatformAdmin(user.id))) throw new ForbiddenError();
  return { userId: user.id };
}
