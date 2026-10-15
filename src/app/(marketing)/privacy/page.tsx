import type { Metadata } from "next";

import { LegalPage } from "@/components/marketing/legal-page";
import { LEGAL_UPDATED, privacySections } from "@/content/legal";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return <LegalPage title="Privacy policy" updated={LEGAL_UPDATED} sections={privacySections()} />;
}
