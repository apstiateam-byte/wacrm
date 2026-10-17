import { ogImage, OG_CONTENT_TYPE, OG_SIZE } from "@/components/marketing/og-image";

export const alt = "WhatsApp CRM for real-estate agents in Jaipur";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogImage({
    eyebrow: "For real-estate agents in Jaipur",
    title: "Reply to every property lead in seconds",
    subtitle: "Budget, locality and BHK questions, site-visit booking and brochure follow-ups on WhatsApp.",
  });
}
