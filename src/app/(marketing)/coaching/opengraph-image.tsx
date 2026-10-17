import { ogImage, OG_CONTENT_TYPE, OG_SIZE } from "@/components/marketing/og-image";

export const alt = "WhatsApp CRM for coaching institutes in Jaipur";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogImage({
    eyebrow: "For coaching institutes in Jaipur",
    title: "Turn every admission enquiry into a demo class",
    subtitle: "Instant enquiry replies, demo-class booking, fee reminders and parent updates on WhatsApp.",
  });
}
