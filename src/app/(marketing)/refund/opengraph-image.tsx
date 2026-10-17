import { ogImage, OG_CONTENT_TYPE, OG_SIZE } from "@/components/marketing/og-image";

export const alt = "Refund & cancellation policy";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogImage({
    eyebrow: "Legal",
    title: "Refund & cancellation policy",
    subtitle: "WhatsApp CRM for Indian businesses, built on the official WhatsApp Business Platform.",
  });
}
