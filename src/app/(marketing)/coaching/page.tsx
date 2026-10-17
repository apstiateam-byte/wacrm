import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { marketingSiteEnabled } from "@/content/marketing";
import { coaching } from "@/content/niches";
import { NichePage } from "@/components/marketing/niche-page";

export const metadata: Metadata = coaching.meta;

export default function CoachingPage() {
  if (!marketingSiteEnabled()) redirect("/dashboard");
  return <NichePage content={coaching} />;
}
