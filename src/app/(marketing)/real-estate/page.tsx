import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { marketingSiteEnabled } from "@/content/marketing";
import { realEstate } from "@/content/niches";
import { NichePage } from "@/components/marketing/niche-page";

export const metadata: Metadata = realEstate.meta;

export default function RealEstatePage() {
  if (!marketingSiteEnabled()) redirect("/dashboard");
  return <NichePage content={realEstate} />;
}
