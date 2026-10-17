import type { Metadata } from "next";

import { LegalPage } from "@/components/marketing/legal-page";
import { LEGAL_UPDATED, privacySections } from "@/content/legal";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  path: "/privacy",
  title: "Privacy policy",
  description: "What data the WhatsApp CRM collects, how it is used and secured, which service providers process it, and your rights over it.",
});

export default function PrivacyPage() {
  return <LegalPage title="Privacy policy" updated={LEGAL_UPDATED} sections={privacySections()} />;
}
