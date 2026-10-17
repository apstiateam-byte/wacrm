import Link from "next/link";
import { ArrowRight, Check, FileText, MessageCircle, Workflow, Zap } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { brand } from "@/content/marketing";
import { GST_QUESTION, whatsappHref, type NicheContent, type NicheVisual } from "@/content/niches";
import { PricingTable } from "@/components/marketing/pricing-table";
import { ProductPreview } from "@/components/marketing/product-preview";
import { ctaLg, FaqList, gridTexture, PricingFallback, SectionHead, Spotlight } from "@/components/marketing/sections";
import { gstAnswer, loadPlans } from "@/lib/marketing/plans";
import { breadcrumbLd, faqLd, JsonLd, organizationLd, softwareLd } from "@/components/marketing/json-ld";

/**
 * Landing page for one niche (coaching, real estate…). Server component;
 * all copy comes from src/content/niches.ts.
 */
export async function NichePage({ content }: { content: NicheContent }) {
  const { plans, tax } = await loadPlans();
  const faqItems = content.faqs.map((f) => (f.q === GST_QUESTION ? { ...f, a: gstAnswer(tax) } : f));

  return (
    <>
      <JsonLd
        graph={[
          organizationLd(),
          softwareLd(plans, content.meta.description),
          faqLd(faqItems),
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: content.navLabel, path: `/${content.slug}` },
          ]),
        ]}
      />
      {/* ================= Hero ================= */}
      <section className="relative overflow-hidden border-b border-border">
        <div aria-hidden className={cn(gridTexture, "opacity-60 [mask-image:radial-gradient(ellipse_70%_60%_at_30%_0%,black,transparent)]")} />
        <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-14 sm:px-6 sm:pt-24">
          <p className="inline-flex max-w-full items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs">
            <span className="truncate">{content.hero.badge}</span>
          </p>
          <h1 className="font-display mt-6 max-w-4xl text-[2.5rem] text-balance sm:text-6xl lg:text-[4.2rem]">{content.hero.title}</h1>
          <p className="mt-6 max-w-2xl text-lg text-pretty text-muted-foreground">{content.hero.subtitle}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), ctaLg)}>
              Start free trial <ArrowRight className="size-4" />
            </Link>
            <TalkToUs text={content.whatsappText} />
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            {content.hero.points.map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <Check className="size-4 text-primary" /> {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <ProductPreview sample={content.preview} />
          <p className="mt-3 text-center text-xs text-muted-foreground">Sample conversation — names and projects are illustrative.</p>
        </div>
      </section>

      {/* ================= Use cases ================= */}
      <section className="mx-auto max-w-6xl px-4 pt-24 sm:px-6">
        <SectionHead eyebrow={content.useCases.eyebrow} title={content.useCases.title} subtitle={content.useCases.subtitle} />
      </section>
      <div className="mx-auto max-w-6xl space-y-24 px-4 py-20 sm:px-6">
        {content.useCases.items.map((item, i) => (
          <Spotlight
            key={item.title}
            reverse={i % 2 === 1}
            eyebrow={item.eyebrow}
            title={item.title}
            body={item.body}
            points={item.points}
            visual={<Visual visual={item.visual} />}
          />
        ))}
      </div>

      {/* ================= Setup ================= */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <SectionHead eyebrow="How setup works" title={content.setup.title} subtitle={content.setup.subtitle} />
          <ol className="mt-12 grid gap-8 md:grid-cols-3">
            {content.setup.steps.map((s, i) => (
              <li key={s.title} className="border-t-2 border-border pt-5 first:border-primary">
                <span className="font-mono text-sm text-muted-foreground">0{i + 1}</span>
                <h3 className="mt-2 text-lg font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ================= Pricing ================= */}
      <section id="pricing" className="scroll-mt-20 py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHead align="center" eyebrow="Pricing" title={content.pricing.title} subtitle={content.pricing.subtitle} />
          {plans.length > 0 ? (
            <PricingTable plans={plans} addons={[]} tax={tax} salesHref={brand.salesUrl || `mailto:${brand.supportEmail}`} compact />
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
              Something else?{" "}
              <Link href="/contact" className="font-medium text-foreground underline-offset-4 hover:underline">
                Talk to us
              </Link>
              .
            </p>
          </div>
          <FaqList items={faqItems} />
        </div>
      </section>

      {/* ================= Closing CTA ================= */}
      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card px-6 py-16 sm:px-14">
          <div aria-hidden className={cn(gridTexture, "opacity-50 [mask-image:radial-gradient(ellipse_60%_80%_at_100%_100%,black,transparent)]")} />
          <div className="relative max-w-2xl">
            <h2 className="font-display text-3xl text-balance sm:text-5xl">{content.closing.title}</h2>
            <p className="mt-4 text-muted-foreground">{content.closing.body}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), ctaLg)}>
                Start free trial <ArrowRight className="size-4" />
              </Link>
              <TalkToUs text={content.whatsappText} />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/** "Chat on WhatsApp" when a support number is set; else booking link or /contact. */
function TalkToUs({ text }: { text: string }) {
  const className = cn(buttonVariants({ variant: "outline", size: "lg" }), ctaLg);
  const wa = whatsappHref(text);
  if (wa) {
    return (
      <a href={wa} target="_blank" rel="noopener noreferrer" className={className}>
        <MessageCircle className="size-4" strokeWidth={1.75} /> Chat on WhatsApp
      </a>
    );
  }
  if (brand.bookingUrl) {
    return (
      <a href={brand.bookingUrl} target="_blank" rel="noopener noreferrer" className={className}>
        Book a setup call
      </a>
    );
  }
  return (
    <Link href="/contact" className={className}>
      Talk to us
    </Link>
  );
}

function Visual({ visual }: { visual: NicheVisual }) {
  switch (visual.kind) {
    case "chat":
      return <ChatVisual visual={visual} />;
    case "template":
      return <TemplateVisual visual={visual} />;
    case "flow":
      return <FlowVisual visual={visual} />;
  }
}

/** WhatsApp-style thread with tap-to-pick buttons. */
function ChatVisual({ visual }: { visual: Extract<NicheVisual, { kind: "chat" }> }) {
  return (
    <div aria-hidden className="rounded-lg bg-muted p-3 text-[12px]">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Workflow className="size-3.5" /> {visual.title}
      </p>
      <div className="space-y-2">
        {visual.messages.map((m) =>
          m.from === "business" ? (
            <div key={m.text} className="max-w-[88%] rounded-lg rounded-tl-sm bg-card p-3 shadow-xs">
              <p>{m.text}</p>
              {m.buttons ? (
                <div className="mt-2.5 grid gap-1 text-center text-[11px] font-medium text-primary">
                  {m.buttons.map((b) => (
                    <span key={b} className="rounded-md border border-border py-1">
                      {b}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <p key={m.text} className="ml-auto w-fit max-w-[80%] rounded-lg rounded-tr-sm bg-primary px-3 py-2 text-primary-foreground">
              {m.text}
            </p>
          ),
        )}
      </div>
    </div>
  );
}

/** Approved template preview plus how it is sent. */
function TemplateVisual({ visual }: { visual: Extract<NicheVisual, { kind: "template" }> }) {
  return (
    <div aria-hidden className="grid gap-4 sm:grid-cols-[1.15fr_0.85fr]">
      <div className="min-w-0 rounded-lg bg-muted p-3 text-[12px]">
        <div className="rounded-lg rounded-tl-sm bg-card p-3 shadow-xs">
          {visual.document ? (
            <p className="mb-2.5 flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-2 text-[11px]">
              <FileText className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
              <span className="min-w-0 truncate font-medium">{visual.document}</span>
            </p>
          ) : null}
          <p>{visual.body}</p>
          {visual.buttons ? (
            <div className="mt-2.5 grid gap-1 text-center text-[11px] font-medium text-primary">
              {visual.buttons.map((b) => (
                <span key={b} className="rounded-md border border-border py-1">
                  {b}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div className="min-w-0 rounded-lg border border-border bg-card p-4 text-[11px]">
        <p className="font-mono text-xs break-all">{visual.name}</p>
        <p className="mt-1.5 flex items-center gap-1.5">
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-muted-foreground">{visual.category}</span>
          <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-300">Approved</span>
        </p>
        <dl className="mt-4 space-y-3">
          {visual.meta.map((m) => (
            <div key={m.label}>
              <dt className="text-muted-foreground">{m.label}</dt>
              <dd className="mt-0.5 font-medium">{m.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-[10px] text-muted-foreground">Sample template</p>
      </div>
    </div>
  );
}

/** Trigger → action chain. */
function FlowVisual({ visual }: { visual: Extract<NicheVisual, { kind: "flow" }> }) {
  return (
    <div aria-hidden className="rounded-lg border border-border bg-card p-4">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Zap className="size-3.5" /> {visual.title}
        <span className="ml-auto rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-300">Active</span>
      </p>
      <ol className="space-y-2">
        {visual.steps.map((st) => (
          <li key={st.text} className="flex items-center gap-2.5 rounded-md border border-border bg-background px-3 py-2 text-xs">
            <span className="w-10 shrink-0 font-mono text-[11px] text-primary">{st.tag}</span>
            <span className="min-w-0">{st.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
