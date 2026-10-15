import type { Metadata } from "next";

import { LegalPage } from "@/components/marketing/legal-page";
import { LEGAL_UPDATED, termsSections } from "@/content/legal";

export const metadata: Metadata = { title: "Terms of service" };

export default function TermsPage() {
  return <LegalPage title="Terms of service" updated={LEGAL_UPDATED} sections={termsSections()} />;
}
