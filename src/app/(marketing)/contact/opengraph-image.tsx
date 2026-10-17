import { ogImage, OG_CONTENT_TYPE, OG_SIZE } from "@/components/marketing/og-image";

export const alt = "Contact the WhatsApp CRM team";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogImage({
    eyebrow: "Contact",
    title: "Talk to us about WhatsApp CRM",
    subtitle: "Plans, onboarding, in-person setup in Jaipur and support. We reply within one business day.",
  });
}
