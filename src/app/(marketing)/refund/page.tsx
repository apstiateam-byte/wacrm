import type { Metadata } from "next";

import { LegalPage } from "@/components/marketing/legal-page";
import { LEGAL_UPDATED, refundSections } from "@/content/legal";

export const metadata: Metadata = { title: "Refund & cancellation policy" };

export default function RefundPage() {
  return <LegalPage title="Refund & cancellation policy" updated={LEGAL_UPDATED} sections={refundSections()} />;
}
