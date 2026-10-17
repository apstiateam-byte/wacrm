import { ogImage, OG_CONTENT_TYPE, OG_SIZE } from "@/components/marketing/og-image";

export const alt = "Live demo of the WhatsApp CRM";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogImage({
    eyebrow: "Live demo",
    title: "Try the WhatsApp CRM with sample data",
    subtitle: "Shared inbox, broadcasts, chatbot flows and sales pipeline. No sign-up needed.",
  });
}
