import type { MetadataRoute } from "next";

import { marketingSiteEnabled } from "@/content/marketing";
import { MARKETING_ROUTES, SITE_URL } from "@/lib/marketing/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  if (!marketingSiteEnabled()) return [];
  return MARKETING_ROUTES.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE_URL}${path === "/" ? "" : path}`,
    changeFrequency,
    priority,
  }));
}
