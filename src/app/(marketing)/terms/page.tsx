import type { Metadata } from "next";

import { LegalPage } from "@/components/marketing/legal-page";
import { LEGAL_UPDATED, termsSections } from "@/content/legal";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  path: "/terms",
  title: "Terms of service",
  description: "Terms of service for the WhatsApp CRM, covering accounts and trials, plans and payment, acceptable use, your data and termination.",
});

export default function TermsPage() {
  return <LegalPage title="Terms of service" updated={LEGAL_UPDATED} sections={termsSections()} />;
}
