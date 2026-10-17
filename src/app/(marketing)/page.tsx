import type { Metadata } from "next";
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
import { ctaLg, FaqList, gridTexture, PricingFallback, SectionHead, Spotlight } from "@/components/marketing/sections";
import { gstAnswer, loadPlans } from "@/lib/marketing/plans";
import { pageMetadata } from "@/lib/marketing/seo";
import { HomeJsonLd } from "@/components/marketing/json-ld";

const HOME_DESCRIPTION =
  "Shared WhatsApp inbox, broadcasts, chatbot flows, AI replies and a sales pipeline on the official WhatsApp Business API. Plans from ₹1,999/month with GST invoices. 14-day free trial.";

export const metadata: Metadata = pageMetadata({
  path: "/",
  absoluteTitle: true,
  title: `${brand.name} — WhatsApp CRM for Indian businesses`,
  description: HOME_DESCRIPTION,
});

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

export default async function LandingPage() {
  // Self-hosted / internal installs skip the public site entirely.
  if (!marketingSiteEnabled()) redirect("/dashboard");
  const live = demoEnabled();
  const { plans, tax } = await loadPlans();

  // The GST answer follows the platform's actual pricing setting.
  const faqItems = faqs.map((f) => (f.q === "Do prices include GST?" ? { ...f, a: gstAnswer(tax) } : f));

  return (
    <>
      <HomeJsonLd plans={plans} faqs={faqItems} description={HOME_DESCRIPTION} />
      {/* ================= Hero ================= */}
      <section className="relative overflow-hidden border-b border-border">
        <div aria-hidden className={cn(gridTexture, "opacity-60 [mask-image:radial-gradient(ellipse_70%_60%_at_30%_0%,black,transparent)]")} />
        <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-14 sm:px-6 sm:pt-24">
          <Link
            href="/#product"
            className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-card py-1 pr-3 pl-1 text-xs font-medium text-muted-foreground shadow-xs transition-colors hover:text-foreground"
          >
            <span className="rounded-full bg-primary-soft px-2 py-0.5 text-primary">Official</span>
            <span className="truncate">{hero.eyebrow}</span>
            <ArrowRight className="size-3 shrink-0" />
          </Link>
          <h1 className="font-display mt-6 max-w-4xl text-[2.75rem] text-balance sm:text-6xl lg:text-[4.4rem]">
            Run WhatsApp like a real sales and support team
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-pretty text-muted-foreground">{hero.subtitle}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), ctaLg)}>
              {hero.primaryCta} <ArrowRight className="size-4" />
            </Link>
            <SecondaryCta live={live} />
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            {hero.note.split("·").map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <Check className="size-4 text-primary" /> {item.trim()}
              </li>
            ))}
          </ul>
        </div>

        <div id="product" className="relative mx-auto max-w-6xl scroll-mt-24 px-4 pb-20 sm:px-6">
          <ProductPreview />
        </div>
      </section>

      {/* ================= Built on ================= */}
      <section className="border-b border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-7 sm:px-6 md:flex-row md:items-center md:gap-10">
          <p className="shrink-0 text-sm text-muted-foreground">Works with</p>
          <ul className="flex flex-wrap items-center gap-x-7 gap-y-2">
            {integrations.map((name) => (
              <li key={name} className="text-sm font-medium text-foreground/70">
                {name}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ================= Product tour ================= */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
        <SectionHead
          eyebrow="Product"
          title="One workspace for every WhatsApp conversation"
          subtitle="Marketing, sales and support share the same customer history — so nobody asks the customer twice."
        />
        <div className="mt-12">
          <FeatureTabs />
        </div>
      </section>

      {/* ================= Spotlights (zig-zag) ================= */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-6xl space-y-24 px-4 py-24 sm:px-6">
          <Spotlight
            eyebrow="Broadcasts"
            title="Campaigns your customers actually read"
            body="Send Meta-approved templates to opted-in audiences, personalise every message, and watch delivery, read and reply rates as they come in."
            points={["Audiences by tag, field or CSV", "Scheduled sends", "Replies land straight in the shared inbox"]}
            visual={<BroadcastPreview />}
          />
          <Spotlight
            reverse
            eyebrow="Automations & API"
            title="The busywork runs itself"
            body="Follow up on keywords, tag new leads, assign chats and branch on replies. Connect your store or ERP with a REST API and webhooks."
            points={["Keyword, tag and new-contact triggers", "Waits, branches and assignment", "REST API, webhooks and an MCP server"]}
            visual={
              <div className="space-y-3">
                <AutomationChain />
                <ApiSnippet />
              </div>
            }
          />
        </div>
      </section>

      {/* ================= Everything included ================= */}
      <section className="mx-auto grid max-w-6xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHead
            eyebrow="Included"
            title="Everything a WhatsApp team needs"
            subtitle="No bolt-ons for the basics. Every plan gets the inbox, contacts and broadcasts; higher plans add chatbots, AI and the API."
          />
          <Link href="/pricing" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            Compare plans <ArrowRight className="size-4" />
          </Link>
        </div>
        <dl className="grid gap-x-8 sm:grid-cols-2">
          {features.map((f) => {
            const Icon = ICONS[f.icon];
            return (
              <div key={f.title} className="border-t border-border py-6">
                <dt className="flex items-center gap-2.5 font-medium">
                  <Icon className="size-[18px] text-muted-foreground" strokeWidth={1.75} />
                  {f.title}
                </dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</dd>
              </div>
            );
          })}
        </dl>
      </section>

      {/* ================= Facts ================= */}
      <section className="border-y border-border">
        <dl className="mx-auto grid max-w-6xl grid-cols-2 px-4 sm:px-6 lg:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={cn(
                "border-border py-10 pr-4 sm:pr-6",
                i % 2 === 1 ? "border-l pl-4 sm:pl-6" : "pl-0",
                i >= 2 && "border-t lg:border-t-0",
                i === 2 && "lg:border-l lg:pl-6",
              )}
            >
              <dt className="sr-only">{s.label}</dt>
              <dd className="font-display text-4xl tabular-nums">{s.value}</dd>
              <dd className="mt-1.5 text-sm text-muted-foreground">{s.label}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ================= How it works ================= */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <SectionHead eyebrow="How it works" title="Live on WhatsApp in an afternoon" />
        <ol className="mt-12 grid gap-8 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="border-t-2 border-border pt-5 first:border-primary">
              <span className="font-mono text-sm text-muted-foreground">0{i + 1}</span>
              <h3 className="mt-2 text-lg font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ================= About ================= */}
      <section id="about" className="scroll-mt-20 border-t border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[1.1fr_1fr]">
          <div className="min-w-0">
            <p className="text-sm font-medium text-primary">{about.eyebrow}</p>
            <h2 className="font-display mt-3 text-3xl text-balance sm:text-[2.6rem]">{about.title}</h2>
            {about.paragraphs.map((p) => (
              <p key={p.slice(0, 32)} className="mt-5 text-pretty text-muted-foreground sm:text-lg">
                {p}
              </p>
            ))}
          </div>
          <ul className="grid content-start gap-x-8 sm:grid-cols-2">
            {about.values.map((v) => (
              <li key={v.title} className="border-t border-border py-5">
                <h3 className="flex items-center gap-2 font-medium">
                  <Check className="size-4 text-primary" /> {v.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{v.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ================= Pricing ================= */}
      <section id="pricing" className="scroll-mt-20 border-t border-border py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHead
            align="center"
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

      {/* ================= FAQ ================= */}
      <section className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-24 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-medium text-primary">FAQ</p>
            <h2 className="font-display mt-3 text-3xl sm:text-[2.6rem]">Questions, answered</h2>
            <p className="mt-4 text-muted-foreground">
              Can&apos;t find what you need?{" "}
              <Link href="/#contact" className="font-medium text-foreground underline-offset-4 hover:underline">
                Talk to us
              </Link>
              .
            </p>
          </div>
          <FaqList items={faqItems} />
        </div>
      </section>

      {/* ================= Contact ================= */}
      <section id="contact" className="scroll-mt-20 border-t border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-24 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="min-w-0">
            <p className="text-sm font-medium text-primary">{contactSection.eyebrow}</p>
            <h2 className="font-display mt-3 text-3xl sm:text-[2.6rem]">{contactSection.title}</h2>
            <p className="mt-4 text-muted-foreground">{contactSection.subtitle}</p>
            <ul className="mt-8 space-y-3 text-sm">
              <li className="flex items-center gap-2.5">
                <Mail className="size-4 text-muted-foreground" />
                <a href={`mailto:${brand.supportEmail}`} className="font-medium hover:text-primary">
                  {brand.supportEmail}
                </a>
              </li>
              {brand.supportPhone ? (
                <li className="flex items-center gap-2.5">
                  <Phone className="size-4 text-muted-foreground" /> {brand.supportPhone}
                </li>
              ) : null}
            </ul>
          </div>
          <div className="min-w-0">
            <ContactForm />
          </div>
        </div>
      </section>

      {/* ================= Closing CTA ================= */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card px-6 py-16 sm:px-14">
          <div aria-hidden className={cn(gridTexture, "opacity-50 [mask-image:radial-gradient(ellipse_60%_80%_at_100%_100%,black,transparent)]")} />
          <div className="relative max-w-2xl">
            <h2 className="font-display text-3xl text-balance sm:text-5xl">Turn WhatsApp into your best sales channel</h2>
            <p className="mt-4 text-muted-foreground">{hero.note}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), ctaLg)}>
                {hero.primaryCta} <ArrowRight className="size-4" />
              </Link>
              <Link href="/pricing" className={cn(buttonVariants({ variant: "outline", size: "lg" }), ctaLg)}>
                View pricing
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/** Trigger → wait → action chain. */
function AutomationChain() {
  const chain = [
    { tag: "When", text: "Message contains “price”" },
    { tag: "Wait", text: "2 minutes" },
    { tag: "Then", text: "Send price list · tag Lead" },
  ];
  return (
    <div aria-hidden className="rounded-lg border border-border bg-card p-4">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Zap className="size-3.5" /> Price enquiry follow-up
        <span className="ml-auto rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-300">Active</span>
      </p>
      <ol className="space-y-2">
        {chain.map((st) => (
          <li key={st.tag} className="flex items-center gap-2.5 rounded-md border border-border bg-background px-3 py-2 text-xs">
            <span className="w-10 shrink-0 font-mono text-[11px] text-primary">{st.tag}</span>
            {st.text}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Tiny REST example. */
function ApiSnippet() {
  return (
    <div aria-hidden className="space-y-1 rounded-lg border border-border bg-card p-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
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

/** Campaign preview. Illustrative numbers. */
function BroadcastPreview() {
  const rows = [
    { label: "Delivered", pct: 96 },
    { label: "Read", pct: 81 },
    { label: "Replied", pct: 34 },
  ];
  return (
    <div aria-hidden className="grid gap-4 sm:grid-cols-[1fr_0.9fr]">
      <div className="rounded-lg bg-muted p-3">
        <div className="max-w-[94%] rounded-lg rounded-tl-sm bg-card p-3 text-[12px] shadow-xs">
          <p className="font-medium">Hi Priya, our Diwali sale is live</p>
          <p className="mt-1 text-muted-foreground">Flat 20% off silk sarees till Sunday. Reply YES to reserve yours.</p>
          <div className="mt-2.5 grid grid-cols-2 gap-1 text-center text-[11px] font-medium text-primary">
            <span className="rounded-md border border-border py-1">Shop now</span>
            <span className="rounded-md border border-border py-1">YES</span>
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs font-medium">Diwali sale</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">VIP, Repeat buyer · 2,400 contacts</p>
        <div className="mt-4 space-y-3">
          {rows.map((st) => (
            <div key={st.label}>
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="text-muted-foreground">{st.label}</span>
                <span className="font-medium tabular-nums">{st.pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${st.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[10px] text-muted-foreground">Sample campaign</p>
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
      <DemoButton variant="outline" className={ctaLg}>
        {hero.secondaryCta}
      </DemoButton>
    );
  }
  return (
    <Link href="/demo" className={cn(buttonVariants({ variant: "outline", size: "lg" }), ctaLg)}>
      Book a demo
    </Link>
  );
}
