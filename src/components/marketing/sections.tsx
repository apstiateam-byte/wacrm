import Link from "next/link";
import { ArrowRight, Check, ChevronDown } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Building blocks shared by the landing page and the niche pages.

/** Large call-to-action buttons. */
export const ctaLg = "h-11 rounded-lg px-5 text-[15px]";

/** Subtle grid texture used behind the hero and the closing CTA. */
export const gridTexture =
  "pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:56px_56px]";

export function SectionHead({
  eyebrow,
  title,
  subtitle,
  align = "left",
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}>
      <p className="text-sm font-medium text-primary">{eyebrow}</p>
      <h2 className="font-display mt-3 text-3xl text-balance sm:text-[2.6rem]">{title}</h2>
      {subtitle ? <p className="mt-4 text-pretty text-muted-foreground sm:text-lg">{subtitle}</p> : null}
    </div>
  );
}

export function Spotlight({
  eyebrow,
  title,
  body,
  points,
  visual,
  reverse = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  points: readonly string[];
  visual: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className={cn("min-w-0", reverse && "lg:order-2")}>
        <p className="text-sm font-medium text-primary">{eyebrow}</p>
        <h3 className="font-display mt-3 text-2xl text-balance sm:text-4xl">{title}</h3>
        <p className="mt-4 text-pretty text-muted-foreground">{body}</p>
        <ul className="mt-6 space-y-2.5 text-sm">
          {points.map((pt) => (
            <li key={pt} className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" /> {pt}
            </li>
          ))}
        </ul>
      </div>
      <div className={cn("min-w-0 rounded-xl border border-border bg-background p-4 sm:p-6", reverse && "lg:order-1")}>{visual}</div>
    </div>
  );
}

/** Accordion list of questions (native <details>, no client JS). */
export function FaqList({ items }: { items: readonly { q: string; a: string }[] }) {
  return (
    <div className="border-b border-border">
      {items.map((f) => (
        <details key={f.q} className="group border-t border-border">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-medium [&::-webkit-details-marker]:hidden">
            {f.q}
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
          </summary>
          <p className="-mt-1 pb-5 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

/** Shown when the plan catalogue can't be loaded (e.g. billing migration not applied yet). */
export function PricingFallback() {
  return (
    <div className="mt-12 grid items-center gap-8 rounded-2xl border border-border bg-card p-8 sm:p-12 lg:grid-cols-[1fr_auto]">
      <ul className="grid gap-2.5 text-sm text-muted-foreground sm:grid-cols-2">
        {["Plans from ₹1,999/month", "Save 20% with annual billing", "No markup on Meta message fees", "GST invoices for every payment"].map(
          (item) => (
            <li key={item} className="flex items-center gap-2">
              <Check className="size-4 text-primary" /> {item}
            </li>
          ),
        )}
      </ul>
      <Link href="/pricing" className={cn(buttonVariants({ size: "lg" }), ctaLg)}>
        See pricing <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
