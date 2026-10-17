import type { Metadata } from "next";

import { LegalPage } from "@/components/marketing/legal-page";
import { LEGAL_UPDATED, refundSections } from "@/content/legal";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  path: "/refund",
  title: "Refund & cancellation policy",
  description: "How the free trial, cancellations and refunds work for WhatsApp CRM subscriptions, and how the service is delivered.",
});

export default function RefundPage() {
  return <LegalPage title="Refund & cancellation policy" updated={LEGAL_UPDATED} sections={refundSections()} />;
}
