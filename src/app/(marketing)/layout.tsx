import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { announcement, brand } from "@/content/marketing";
import { LogoMark } from "@/components/brand/logo";

// The public site is meant to be found — override the app-wide noindex.
export const metadata: Metadata = {
  // `absolute` so the root layout's "%s — wacrm" template doesn't append the brand twice.
  title: {
    absolute: `${brand.name} — WhatsApp CRM for growing businesses`,
    template: `%s — ${brand.name}`,
  },
  description:
    "Shared WhatsApp inbox, broadcast campaigns, chatbot flows, AI replies and a sales pipeline. 14-day free trial.",
  robots: { index: true, follow: true },
};

const NAV = [
  { href: "/#features", label: "Features" },
  { href: "/#about", label: "About" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/demo", label: "Demo" },
  { href: "/#contact", label: "Contact" },
];

const FOOTER = [
  {
    title: "Product",
    links: [
      { href: "/#features", label: "Features" },
      { href: "/pricing", label: "Pricing" },
      { href: "/demo", label: "Live demo" },
      { href: "/signup", label: "Start free trial" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/#about", label: "About" },
      { href: "/#contact", label: "Contact" },
      { href: "/contact", label: "Support" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms of service" },
      { href: "/privacy", label: "Privacy policy" },
      { href: "/refund", label: "Refund & cancellation" },
    ],
  },
];

/** Pill call-to-action, dark on light (and light on dark). */
const pillDark = "inline-flex h-9 items-center gap-1.5 rounded-full bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  // Signed-in visitors get "Open dashboard" instead of sign-up CTAs.
  let signedIn = false;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    signedIn = !!data.user;
  } catch {
    signedIn = false;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Announcement bar */}
      <div className="bg-foreground text-background">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-2 text-center text-xs sm:text-sm">
          <span aria-hidden>✨</span>
          <span className="truncate">{announcement.text}</span>
          {announcement.href ? (
            <Link href={announcement.href} className="inline-flex shrink-0 items-center gap-1 font-medium text-primary hover:underline">
              {announcement.cta} <ArrowRight className="size-3" />
            </Link>
          ) : null}
        </div>
      </div>

      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto grid h-16 max-w-6xl grid-cols-[1fr_auto] items-center gap-6 px-4 sm:px-6 md:grid-cols-[1fr_auto_1fr]">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <LogoMark size={32} />
            {brand.name}
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex" aria-label="Main">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="transition-colors hover:text-foreground">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center justify-end gap-2">
            {signedIn ? (
              <Link href="/dashboard" className={pillDark}>
                Open dashboard <ArrowRight className="size-3.5" />
              </Link>
            ) : (
              <>
                <Link href="/login" className={cn(buttonVariants({ variant: "ghost" }), "h-9 rounded-full px-4")}>
                  Log in
                </Link>
                <Link href="/signup" className={pillDark}>
                  Start free trial
                </Link>
              </>
            )}
          </div>
        </div>
        <nav className="flex gap-5 overflow-x-auto px-4 pb-2.5 text-sm text-muted-foreground md:hidden" aria-label="Main mobile">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="shrink-0 hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border/60 bg-card/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 text-sm sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <LogoMark size={32} />
              {brand.name}
            </Link>
            <p className="mt-4 max-w-xs text-muted-foreground">
              WhatsApp CRM for growing businesses. Built on the official WhatsApp Business Platform.
            </p>
            <a href={`mailto:${brand.supportEmail}`} className="mt-4 inline-block text-muted-foreground hover:text-foreground">
              {brand.supportEmail}
            </a>
            {brand.supportPhone ? <p className="mt-1 text-muted-foreground">{brand.supportPhone}</p> : null}
          </div>
          {FOOTER.map((col) => (
            <div key={col.title}>
              <p className="font-medium text-foreground">{col.title}</p>
              <ul className="mt-3 space-y-2 text-muted-foreground">
                {col.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link href={l.href} className="hover:text-foreground">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-border/60">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:px-6">
            <p>
              © {new Date().getFullYear()} {brand.legalEntity}. All rights reserved.
            </p>
            <p>WhatsApp is a trademark of Meta Platforms, Inc.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
