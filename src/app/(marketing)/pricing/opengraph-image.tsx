import { ogImage, OG_CONTENT_TYPE, OG_SIZE } from "@/components/marketing/og-image";

export const alt = "WhatsApp CRM pricing in INR";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogImage({
    eyebrow: "Pricing",
    title: "Plans from ₹1,999 a month",
    subtitle: "Billed in INR with GST invoices. No markup on Meta message charges. 14-day free trial.",
  });
}
