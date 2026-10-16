import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Bot,
  Braces,
  Check,
  GitBranch,
  Mail,
  MessageSquare,
  Phone,
  Radio,
  Sparkles,
  Users,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  about,
  brand,
  contactSection,
  faqs,
  features,
  hero,
  integrations,
  marketingSiteEnabled,
  stats,
  steps,
} from "@/content/marketing";
import { ContactForm } from "@/components/marketing/contact-form";
import { DemoButton } from "@/components/marketing/demo-button";
import { FeatureTabs } from "@/components/marketing/feature-tabs";
import { ProductPreview } from "@/components/marketing/product-preview";
import { demoEnabled } from "@/lib/demo/server";
import { PricingTable } from "@/components/marketing/pricing-table";
import { createClient } from "@/lib/supabase/server";
import { taxSettingsOf, type Plan, type TaxSettings } from "@/lib/billing/types";
import { supabaseAdmin } from "@/lib/flows/admin-client";

const ICONS: Record<(typeof features)[number]["icon"], LucideIcon> = {
  inbox: MessageSquare,
  broadcast: Radio,
  flows: Workflow,
  ai: Bot,
  automations: Zap,
  pipeline: GitBranch,
  contacts: Users,
  api: Braces,
};

/** Live plan catalogue (edited in /admin). Empty when unavailable. */
async function loadPlans(): Promise<{ plans: Plan[]; tax: TaxSettings }> {
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

/** Pill buttons, as on the reference design. */
const pill = "rounded-full h-11 px-6 text-base";

/** Small eyebrow + serif heading + subcopy, centred. */
function SectionHead({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-medium text-primary">{eyebrow}</p>
      <h2 className="mt-2 text-3xl tracking-tight text-balance sm:text-5xl">{title}</h2>
      {subtitle ? <p className="mt-4 text-pretty text-muted-foreground sm:text-lg">{subtitle}</p> : null}
    </div>
  );
}

export default async function LandingPage() {
  // Self-hosted / internal installs skip the public site entirely.
  if (!marketingSiteEnabled()) redirect("/dashboard");
  const live = demoEnabled();
  const { plans, tax } = await loadPlans();

  // Bento layout: one wide and one tall card first, then regular ones.
  const [f0, f1, f2, f3, ...rest] = features;

  return (
    <>
      {/* ================= Hero (centred) ================= */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-24 h-[520px] bg-[radial-gradient(ellipse_at_top,var(--color-primary)_0%,transparent_62%)] opacity-[0.14]"
        />
        <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-10 text-center sm:px-6 sm:pt-24">
          <Link
            href="/#product"
            className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm hover:text-foreground"
          >
            <Sparkles className="size-3.5 shrink-0 text-primary" />
            <span className="truncate">{hero.eyebrow}</span>
            <ArrowRight className="size-3 shrink-0" />
          </Link>
          <h1 className="mx-auto mt-6 max-w-4xl text-5xl leading-[1.05] tracking-tight text-balance sm:text-6xl lg:text-7xl">
            Sell, support and grow on <span className="text-primary italic">WhatsApp</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-pretty text-muted-foreground">{hero.subtitle}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), pill)}>
              {hero.primaryCta} <ArrowRight className="size-4" />
            </Link>
            <SecondaryCta live={live} />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">{hero.note}</p>
        </div>

        <div id="product" className="relative mx-auto max-w-6xl scroll-mt-24 px-4 pb-16 sm:px-6">
          <ProductPreview />
        </div>
      </section>

      {/* ================= Works with ================= */}
      <section className="border-y border-border/60 bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <p className="text-center text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Works with the tools you already use
          </p>
          <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {integrations.map((name) => (
              <li key={name} className="text-sm font-semibold text-foreground/70">
                {name}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ================= Product tour (pill tabs) ================= */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
        <SectionHead
          eyebrow="Product"
          title="One workspace for every WhatsApp conversation"
          subtitle="Marketing, sales and support in the same place — for your whole team."
        />
        <div className="mt-12">
          <FeatureTabs />
        </div>
      </section>

      {/* ================= Bento grid ================= */}
      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <SectionHead eyebrow="Features" title="Everything you need, nothing you don't" />
        <div className="mt-12 grid auto-rows-[minmax(180px,auto)] gap-4 md:grid-cols-3">
          <BentoCard feature={f0} className="md:col-span-2" big />
          <BentoCard feature={f1} className="md:row-span-2" tall />
          <BentoCard feature={f2} />
          <BentoCard feature={f3} />
          {/* Remaining rows alternate wide + small, small + wide, so no row
              is left with a single orphan card. */}
          {rest.map((f, i) => (
            <BentoCard key={f.title} feature={f} className={i % 3 === 0 ? "md:col-span-2" : undefined} />
          ))}
        </div>
      </section>

      {/* ================= Stats ================= */}
      <section className="border-y border-border/60 bg-card/40">
        <div className="mx-auto grid max-w-6xl grid-cols-2 divide-border px-4 py-10 sm:px-6 lg:grid-cols-4 lg:divide-x">
          {stats.map((s) => (
            <div key={s.label} className="px-4 py-3 text-center">
              <p className="font-heading text-4xl text-foreground">{s.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= About ================= */}
      <section id="about" className="scroll-mt-20">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-start">
          <div className="min-w-0">
            <p className="text-sm font-medium text-primary">{about.eyebrow}</p>
            <h2 className="mt-2 text-3xl tracking-tight text-balance sm:text-5xl">{about.title}</h2>
            {about.paragraphs.map((p) => (
              <p key={p.slice(0, 32)} className="mt-5 text-pretty text-muted-foreground sm:text-lg">
                {p}
              </p>
            ))}
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {about.values.map((v) => (
              <li key={v.title} className="rounded-2xl border border-border bg-card p-5">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Check className="size-4" />
                </span>
                <h3 className="mt-3 font-semibold">{v.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{v.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ================= How it works ================= */}
      <section className="border-y border-border/60 bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <SectionHead eyebrow="How it works" title="Live in three steps" />
          <ol className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-6">
            <div aria-hidden className="absolute top-5 right-[16%] left-[16%] hidden h-px bg-border md:block" />
            {steps.map((s, i) => (
              <li key={s.title} className="relative text-center">
                <span className="relative mx-auto flex size-10 items-center justify-center rounded-full border border-primary/40 bg-background font-heading text-lg text-primary">
                  {i + 1}
                </span>
                <h3 className="mt-5 font-semibold">{s.title}</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ================= Pricing ================= */}
      <section id="pricing" className="scroll-mt-20 py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHead
            eyebrow="Pricing"
            title="Simple plans that grow with you"
            subtitle="Start with a 14-day free trial of Growth. No card required — pick a plan when you are ready."
          />
          {plans.length > 0 ? (
            <PricingTable
              plans={plans}
              addons={[]}
              tax={tax}
              salesHref={brand.salesUrl || `mailto:${brand.supportEmail}`}
              compact
            />
          ) : (
            <PricingFallback />
          )}
        </div>
      </section>

      {/* ================= FAQ (two columns) ================= */}
      <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-24 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="text-sm font-medium text-primary">FAQ</p>
          <h2 className="mt-2 text-3xl tracking-tight sm:text-5xl">Questions, answered</h2>
          <p className="mt-4 text-muted-foreground">
            Can&apos;t find what you need?{" "}
            <Link href="/#contact" className="text-primary underline-offset-4 hover:underline">
              Talk to us
            </Link>
            .
          </p>
        </div>
        <div className="divide-y divide-border rounded-2xl border border-border bg-card">
          {faqs.map((f) => (
            <details key={f.q} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                {f.q}
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ================= Contact ================= */}
      <section id="contact" className="scroll-mt-20 border-t border-border/60 bg-card/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-24 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="min-w-0">
            <p className="text-sm font-medium text-primary">{contactSection.eyebrow}</p>
            <h2 className="mt-2 text-3xl tracking-tight sm:text-5xl">{contactSection.title}</h2>
            <p className="mt-4 text-muted-foreground">{contactSection.subtitle}</p>
            <ul className="mt-8 space-y-3 text-sm">
              <li className="flex items-center gap-2 text-muted-foreground">
                <Mail className="size-4 text-primary" />
                <a href={`mailto:${brand.supportEmail}`} className="hover:text-foreground">
                  {brand.supportEmail}
                </a>
              </li>
              {brand.supportPhone ? (
                <li className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="size-4 text-primary" /> {brand.supportPhone}
                </li>
              ) : null}
            </ul>
          </div>
          <div className="min-w-0">
            <ContactForm />
          </div>
        </div>
      </section>

      {/* ================= Closing CTA panel ================= */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-foreground px-6 py-16 text-center text-background sm:px-12">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,var(--color-primary)_0%,transparent_55%)] opacity-50"
          />
          <div className="relative">
            <Sparkles className="mx-auto size-6 text-primary" />
            <h2 className="mx-auto mt-4 max-w-2xl text-3xl tracking-tight text-balance sm:text-5xl">
              Turn WhatsApp into your best sales channel
            </h2>
            <p className="mt-4 text-background/70">{hero.note}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), pill)}>
                {hero.primaryCta} <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/pricing"
                className={cn(pill, "inline-flex items-center border border-background/25 font-medium text-background hover:bg-background/10")}
              >
                View pricing
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function BentoCard({
  feature,
  className,
  big,
  tall,
}: {
  feature: (typeof features)[number];
  className?: string;
  big?: boolean;
  tall?: boolean;
}) {
  // Wide cards (2 columns) in the lower rows get a small illustration too.
  const wide = !big && !!className?.includes("col-span-2");
  const Icon = ICONS[feature.icon];
  return (
    <div className={cn("relative flex flex-col overflow-hidden rounded-3xl border border-border bg-card p-6", className)}>
      <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <h3 className={cn("mt-5 font-semibold", big && "font-heading text-2xl font-medium")}>{feature.title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{feature.body}</p>
      {big ? <InboxBoard /> : null}
      {tall ? <BroadcastPreview /> : null}
      {wide && feature.icon === "automations" ? <AutomationChain /> : null}
      {wide && feature.icon === "api" ? <ApiSnippet /> : null}
    </div>
  );
}

/** Mini kanban of real-looking conversations for the "Shared team inbox" card. */
function InboxBoard() {
  const columns: { label: string; dot: string; chats: { name: string; text: string; agent?: string }[] }[] = [
    {
      label: "Assigned",
      dot: "bg-primary",
      chats: [
        { name: "Priya Sharma", text: "Deliver to Pune by Friday?", agent: "RK" },
        { name: "Aditya Verma", text: "Need GST invoices for B2B", agent: "SM" },
      ],
    },
    {
      label: "Open",
      dot: "bg-amber-500",
      chats: [
        { name: "Vikram Singh", text: "Order #4821 update?" },
        { name: "Kavya Reddy", text: "Do you ship abroad?" },
      ],
    },
    {
      label: "Resolved",
      dot: "bg-emerald-500",
      chats: [{ name: "Sneha Kapoor", text: "Loved the packaging! 😊" }],
    },
  ];
  return (
    <div aria-hidden className="mt-6 grid flex-1 gap-2 sm:grid-cols-3">
      {columns.map((col) => (
        <div key={col.label} className="min-w-0 rounded-2xl border border-border bg-background p-2.5">
          <p className="mb-2 flex items-center gap-1.5 px-0.5 text-[11px] font-medium text-muted-foreground">
            <span className={cn("size-1.5 rounded-full", col.dot)} />
            {col.label}
            <span className="ml-auto rounded-full bg-muted px-1.5 text-[10px]">{col.chats.length}</span>
          </p>
          <div className="space-y-1.5">
            {col.chats.map((c) => (
              <div key={c.name} className="flex items-center gap-2 rounded-xl border border-border/70 bg-card p-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                  {c.name[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium">{c.name}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{c.text}</p>
                </div>
                {c.agent ? (
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-[8px] font-semibold text-background">
                    {c.agent}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Trigger → wait → action chain for the wide "Automations" card. */
function AutomationChain() {
  const steps = [
    { tag: "When", text: "Message contains “price”" },
    { tag: "Wait", text: "2 minutes" },
    { tag: "Then", text: "Send price list · Tag: Lead" },
  ];
  return (
    <div aria-hidden className="mt-6 flex flex-wrap items-center gap-2">
      {steps.map((st, i) => (
        <div key={st.tag} className="flex items-center gap-2">
          <div className="rounded-xl border border-border bg-background px-3 py-2 text-[11px]">
            <span className="mr-1.5 rounded-md bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">{st.tag}</span>
            {st.text}
          </div>
          {i < steps.length - 1 ? <ArrowRight className="size-3.5 text-muted-foreground" /> : null}
        </div>
      ))}
    </div>
  );
}

/** Tiny REST example for the wide "API & webhooks" card. */
function ApiSnippet() {
  return (
    <div
      aria-hidden
      className="mt-6 space-y-1 rounded-xl border border-border bg-background p-3 font-mono text-[11px] leading-relaxed text-muted-foreground"
    >
      <p>
        <span className="text-primary">POST</span> /api/v1/messages
      </p>
      <p className="truncate">
        {"{ "}
        <span className="text-foreground">&quot;to&quot;</span>: &quot;+9198100…&quot;,{" "}
        <span className="text-foreground">&quot;template&quot;</span>: &quot;order_update&quot;{" }"}
      </p>
      <p className="text-emerald-700 dark:text-emerald-300">→ 202 Accepted</p>
    </div>
  );
}

/** Campaign preview filling the tall "Broadcast campaigns" card. Illustrative numbers. */
function BroadcastPreview() {
  const stats = [
    { label: "Delivered", pct: 96 },
    { label: "Read", pct: 81 },
    { label: "Replied", pct: 34 },
  ];
  return (
    <div aria-hidden className="mt-6 flex flex-1 flex-col gap-3">
      <div className="rounded-2xl border border-border bg-background p-3">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-medium">Diwali sale</span>
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-300">Sent</span>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">Tag: VIP, Repeat buyer · 2,400 contacts</p>
      </div>
      <div className="flex-1 rounded-2xl bg-muted/50 p-3">
        <div className="max-w-[92%] rounded-xl rounded-tl-sm bg-card p-2.5 text-[11px] shadow-sm">
          <p className="font-medium">🪔 Hi Priya, our Diwali sale is live!</p>
          <p className="mt-1 text-muted-foreground">Flat 20% off sarees till Sunday. Reply YES to reserve yours.</p>
          <div className="mt-2 grid grid-cols-2 gap-1 text-center text-[10px] font-medium text-primary">
            <span className="rounded-md border border-border py-1">Shop now</span>
            <span className="rounded-md border border-border py-1">YES</span>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {stats.map((st, i) => (
          <div key={st.label}>
            <div className="mb-1 flex justify-between text-[11px]">
              <span className="text-muted-foreground">{st.label}</span>
              <span className="font-medium tabular-nums">{st.pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${st.pct}%`, opacity: 1 - i * 0.22 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * "Try the live demo" when DEMO_ENABLED is on; otherwise a link to /demo,
 * which offers "Book a demo" — never a button that can only fail.
 */
function SecondaryCta({ live }: { live: boolean }) {
  if (live) {
    return (
      <DemoButton variant="outline" className={pill}>
        {hero.secondaryCta}
      </DemoButton>
    );
  }
  return (
    <Link href="/demo" className={cn(buttonVariants({ variant: "outline", size: "lg" }), pill)}>
      Book a demo
    </Link>
  );
}

/** Shown when the plan catalogue can't be loaded (e.g. billing migration not applied yet). */
function PricingFallback() {
  return (
    <div className="mt-12">
      <div className="grid items-center gap-8 rounded-3xl border border-border bg-card p-8 sm:p-12 lg:grid-cols-[1fr_auto]">
        <div>
          <ul className="grid gap-2.5 text-sm text-muted-foreground sm:grid-cols-2">
            {[
              "Plans from ₹1,999/month",
              "Save 20% with annual billing",
              "No markup on Meta message fees",
              "GST invoices for every payment",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Check className="size-4 text-primary" /> {item}
              </li>
            ))}
          </ul>
        </div>
        <Link href="/pricing" className={cn(buttonVariants({ size: "lg" }), pill)}>
          See pricing <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
