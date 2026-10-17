import type { Metadata } from "next";

import { brand } from "@/content/marketing";
import { niches } from "@/content/niches";

/**
 * Public origin of the marketing site, used for canonical URLs, the
 * sitemap and Open Graph links. Set NEXT_PUBLIC_SITE_URL to the host
 * that serves pages directly (not one that redirects), e.g.
 * https://www.cluade.si.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");

/** Indexable marketing routes, most important first. */
export const MARKETING_ROUTES: { path: string; priority: number; changeFrequency: "weekly" | "monthly" | "yearly" }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  ...niches.map((n) => ({ path: `/${n.slug}`, priority: 0.9, changeFrequency: "monthly" as const })),
  { path: "/pricing", priority: 0.8, changeFrequency: "monthly" },
  { path: "/demo", priority: 0.6, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.5, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
  { path: "/refund", priority: 0.2, changeFrequency: "yearly" },
];

/**
 * Per-page metadata with a canonical URL and matching Open Graph tags.
 * Child `openGraph` objects replace the parent's, so every page sets
 * the full set here rather than relying on the layout.
 */
export function pageMetadata({
  path,
  title,
  description,
  absoluteTitle = false,
}: {
  path: string;
  title: string;
  description: string;
  /** Use `title` as-is instead of appending the brand via the layout template. */
  absoluteTitle?: boolean;
}): Metadata {
  const fullTitle = absoluteTitle ? title : `${title} — ${brand.name}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      url: path,
      siteName: brand.name,
      locale: "en_IN",
      title: fullTitle,
      description,
    },
    twitter: { card: "summary_large_image", title: fullTitle, description },
  };
}

/** Serialise JSON-LD for a <script> tag; escapes "<" so content can't close the tag. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
