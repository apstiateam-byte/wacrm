import { ogImage, OG_CONTENT_TYPE, OG_SIZE } from "@/components/marketing/og-image";

export const alt = "WhatsApp CRM for Indian businesses";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogImage({
    eyebrow: "WhatsApp CRM for Indian businesses",
    title: "Run WhatsApp like a real sales and support team",
    subtitle: "Shared inbox, broadcasts, chatbot flows, AI replies and a sales pipeline — from one number.",
  });
}
