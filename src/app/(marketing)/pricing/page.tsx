import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { brand, faqs } from "@/content/marketing";
import type { Addon, Plan } from "@/lib/billing/types";
import { PricingTable } from "@/components/marketing/pricing-table";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple monthly or annual plans for WhatsApp CRM. 14-day free trial, no card required.",
};

// Plans are edited in /admin — always render the live catalogue.
export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const supabase = await createClient();
  const [{ data: plans }, { data: addons }, { data: settings }] = await Promise.all([
    supabase
      .from("plans")
      .select("code, name, description, sort_order, is_public, is_active, highlighted, contact_sales, price_inr_monthly, price_inr_annual, limits, features")
      .eq("is_active", true)
      .eq("is_public", true)
      .order("sort_order"),
    supabase.from("addons").select("*").eq("is_active", true).order("price_inr_monthly"),
    // Anonymous visitors can't read platform_settings (RLS); fall back to 18%.
    supabase.from("platform_settings").select("gst_percent").eq("id", true).maybeSingle(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight">Plans for every stage of growth</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Start with a 14-day free trial of Growth. No card required — pick a plan when you&apos;re ready.
        </p>
      </div>

      <PricingTable
        plans={(plans ?? []) as Plan[]}
        addons={(addons ?? []) as Addon[]}
        gstPercent={Number(settings?.gst_percent ?? 18)}
        salesHref={brand.salesUrl || `mailto:${brand.supportEmail}`}
      />

      <div className="mx-auto mt-16 max-w-3xl rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">About WhatsApp message charges</p>
        <p className="mt-2">
          Meta charges per delivered template message (marketing, utility and authentication), at rates that depend on
          the recipient&apos;s country. These are billed by Meta directly to the payment method on your WhatsApp
          Business Account — {brand.name} adds no markup. Replies inside the 24-hour customer-service window are free.
        </p>
      </div>

      <div className="mx-auto mt-16 max-w-3xl">
        <h2 className="text-center text-2xl font-bold tracking-tight">Pricing FAQ</h2>
        <div className="mt-8 divide-y divide-border rounded-xl border border-border bg-card">
          {faqs.map((f) => (
            <details key={f.q} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                {f.q}
                <span className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
