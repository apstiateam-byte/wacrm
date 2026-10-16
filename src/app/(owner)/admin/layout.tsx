import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/owner/admin-shell";
import { isPlatformAdmin } from "@/lib/billing/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Owner console",
  robots: { index: false, follow: false, nocache: true },
};

// The SaaS operator's console. Only users in `platform_admins` get in;
// everyone else is sent to their CRM. /api/admin/* re-checks on every
// request, so this is the UX gate, not the only one.
export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await isPlatformAdmin(user.id))) redirect("/dashboard");

  return <AdminShell email={user.email ?? null}>{children}</AdminShell>;
}
