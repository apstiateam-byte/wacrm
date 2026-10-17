import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { marketingSiteEnabled } from "@/content/marketing";
import { coaching } from "@/content/niches";
import { NichePage } from "@/components/marketing/niche-page";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({ path: "/coaching", ...coaching.meta });

export default function CoachingPage() {
  if (!marketingSiteEnabled()) redirect("/dashboard");
  return <NichePage content={coaching} />;
}
