import type { MetadataRoute } from "next";

import { marketingSiteEnabled } from "@/content/marketing";
import { SITE_URL } from "@/lib/marketing/seo";

// The app itself (dashboard, auth, API) is private; only the public
// marketing site is meant to be crawled.
export default function robots(): MetadataRoute.Robots {
  if (!marketingSiteEnabled()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/auth/",
        "/join/",
        "/dashboard",
        "/inbox",
        "/contacts",
        "/pipelines",
        "/broadcasts",
        "/automations",
        "/flows",
        "/agents",
        "/notifications",
        "/settings",
        "/admin",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
