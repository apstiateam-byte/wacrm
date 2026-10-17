import { ogImage, OG_CONTENT_TYPE, OG_SIZE } from "@/components/marketing/og-image";

export const alt = "Privacy policy";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogImage({
    eyebrow: "Legal",
    title: "Privacy policy",
    subtitle: "WhatsApp CRM for Indian businesses, built on the official WhatsApp Business Platform.",
  });
}
