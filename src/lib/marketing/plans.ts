import { createClient } from "@/lib/supabase/server";
import { taxSettingsOf, type Plan, type TaxSettings } from "@/lib/billing/types";
import { supabaseAdmin } from "@/lib/flows/admin-client";

/** Live plan catalogue (edited in /admin). Empty when unavailable. */
export async function loadPlans(): Promise<{ plans: Plan[]; tax: TaxSettings }> {
  try {
    const supabase = await createClient();
    const [{ data }, { data: settings }] = await Promise.all([
      supabase
        .from("plans")
        .select("code, name, description, sort_order, is_public, is_active, highlighted, contact_sales, price_inr_monthly, price_inr_annual, limits, features")
        .eq("is_active", true)
        .eq("is_public", true)
        .order("sort_order"),
      // Anonymous visitors can't read platform_settings; read it
      // server-side and pass only the tax treatment to the page.
      supabaseAdmin().from("platform_settings").select("*").eq("id", true).maybeSingle(),
    ]);
    return { plans: (data ?? []) as Plan[], tax: taxSettingsOf(settings) };
  } catch {
    return { plans: [], tax: taxSettingsOf(null) };
  }
}

/** The GST FAQ answer, following the platform's actual pricing setting. */
export function gstAnswer(tax: TaxSettings): string {
  return tax.pricesIncludeGst
    ? `Yes. Prices shown include ${tax.gstPercent}% GST, and a GST invoice is issued for every payment. Add your GSTIN to claim input tax credit.`
    : `Prices are shown excluding GST. ${tax.gstPercent}% GST is added at checkout — the total is shown before you pay — and a GST invoice is issued for every payment. Add your GSTIN to claim input tax credit.`;
}
