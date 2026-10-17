import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { announcement, brand } from "@/content/marketing";
import { niches } from "@/content/niches";
import { SITE_URL } from "@/lib/marketing/seo";
import { LogoMark } from "@/components/brand/logo";

// The public site is meant to be found — override the app-wide noindex.
// Pages set their own canonical URL and Open Graph tags via
// pageMetadata() in src/lib/marketing/seo.ts.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // `absolute` so the root layout's "%s — wacrm" template doesn't append the brand twice.
  title: {
    absolute: `${brand.name} — WhatsApp CRM for Indian businesses`,
    template: `%s — ${brand.name}`,
  },
  robots: { index: true, follow: true },
};

const NAV = [
  { href: "/#features", label: "Product" },
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
    title: "Solutions",
    links: niches.map((n) => ({ href: `/${n.slug}`, label: `For ${n.navLabel.toLowerCase()}` })),
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

const primaryBtn =
  "inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover active:translate-y-px";
const ghostBtn =
  "inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

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
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        Skip to content
      </a>

      {/* Announcement bar */}
      {announcement.text ? (
        <div className="border-b border-border bg-card">
          <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-2 text-center text-xs sm:text-sm">
            <span className="rounded-md bg-primary-soft px-1.5 py-0.5 text-[11px] font-semibold text-primary">New</span>
            <span className="truncate text-muted-foreground">{announcement.text}</span>
            {announcement.href ? (
              <Link href={announcement.href} className="inline-flex shrink-0 items-center gap-1 font-medium text-foreground hover:text-primary">
                {announcement.cta} <ArrowRight className="size-3" />
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-4 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2 text-[15px] font-semibold tracking-tight">
            <LogoMark size={28} />
            {brand.name}
          </Link>
          <nav className="hidden items-center gap-1 text-sm md:flex" aria-label="Main">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            {signedIn ? (
              <Link href="/dashboard" className={primaryBtn}>
                Open dashboard <ArrowRight className="size-3.5" />
              </Link>
            ) : (
              <>
                <Link href="/login" className={ghostBtn}>
                  Log in
                </Link>
                <Link href="/signup" className={primaryBtn}>
                  Start free trial
                </Link>
              </>
            )}
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2 text-sm md:hidden" aria-label="Main mobile">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="shrink-0 rounded-md px-2.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 text-sm sm:px-6 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <LogoMark size={26} />
              {brand.name}
            </Link>
            <p className="mt-4 max-w-xs text-muted-foreground">
              WhatsApp CRM for growing businesses, built on the official WhatsApp Business Platform.
            </p>
            <a href={`mailto:${brand.supportEmail}`} className="mt-4 inline-block text-foreground hover:text-primary">
              {brand.supportEmail}
            </a>
            {brand.supportPhone ? <p className="mt-1 text-muted-foreground">{brand.supportPhone}</p> : null}
          </div>
          {FOOTER.map((col) => (
            <div key={col.title}>
              <p className="text-xs font-medium text-muted-foreground">{col.title}</p>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link href={l.href} className="text-foreground/80 transition-colors hover:text-foreground">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-border">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:px-6">
            <p>
              © {new Date().getFullYear()} {brand.legalEntity.trim()}. All rights reserved.
            </p>
            <p>WhatsApp is a trademark of Meta Platforms, Inc.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
