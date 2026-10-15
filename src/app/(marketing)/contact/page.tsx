import type { Metadata } from "next";
import { CalendarDays, Mail, MapPin, Phone } from "lucide-react";

import { brand } from "@/content/marketing";
import { ContactForm } from "@/components/marketing/contact-form";

export const metadata: Metadata = {
  title: "Contact us",
  description: "Talk to sales or get support.",
};

export default function ContactPage() {
  const items = [
    { icon: Mail, label: "Email", value: brand.supportEmail, href: `mailto:${brand.supportEmail}` },
    brand.supportPhone ? { icon: Phone, label: "Phone", value: brand.supportPhone, href: `tel:${brand.supportPhone.replace(/\s/g, "")}` } : null,
    brand.address ? { icon: MapPin, label: "Registered address", value: brand.address } : null,
    brand.bookingUrl ? { icon: CalendarDays, label: "Book a demo", value: "Pick a time that suits you", href: brand.bookingUrl } : null,
  ].filter(Boolean) as { icon: typeof Mail; label: string; value: string; href?: string }[];

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Contact us</h1>
      <p className="mt-3 text-muted-foreground">
        Questions about plans, onboarding or your account? We usually reply within one business day.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {items.map(({ icon: Icon, label, value, href }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-5">
            <Icon className="size-5 text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">{label}</p>
            {href ? (
              <a href={href} className="mt-1 block font-medium break-words hover:underline">
                {value}
              </a>
            ) : (
              <p className="mt-1 font-medium whitespace-pre-line">{value}</p>
            )}
          </div>
        ))}
      </div>
      <div className="mt-10">
        <ContactForm />
      </div>
      <p className="mt-8 text-sm text-muted-foreground">
        Operated by {brand.legalEntity}. For privacy requests, write to {brand.supportEmail} with the subject
        &ldquo;Privacy request&rdquo;.
      </p>
    </div>
  );
}
