import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { marketingSiteEnabled } from "@/content/marketing";
import { realEstate } from "@/content/niches";
import { NichePage } from "@/components/marketing/niche-page";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({ path: "/real-estate", ...realEstate.meta });

export default function RealEstatePage() {
  if (!marketingSiteEnabled()) redirect("/dashboard");
  return <NichePage content={realEstate} />;
}
