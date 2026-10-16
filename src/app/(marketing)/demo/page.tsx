import type { Metadata } from "next";
import { CalendarDays, MousePointerClick } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { brand } from "@/content/marketing";
import { demoEnabled } from "@/lib/demo/server";
import { DemoButton } from "@/components/marketing/demo-button";

export const metadata: Metadata = {
  title: "Live demo",
  description: "Explore a live WhatsApp CRM workspace with sample data, or book a guided demo.",
};

export default function DemoPage() {
  const live = demoEnabled();
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-display text-4xl sm:text-5xl">See {brand.name} in action</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Click around a real workspace filled with sample chats, contacts and deals — or let us walk you through it.
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <div className="flex flex-col rounded-xl border border-border bg-card p-6">
          <MousePointerClick className="size-6 text-primary" />
          <h2 className="mt-4 text-xl font-semibold">Try the live demo</h2>
          <p className="mt-2 flex-1 text-sm text-muted-foreground">
            Instant access, no sign-up. Explore the inbox, pipeline, broadcasts and automations of a sample retail
            business. Demo data resets every night, and sending to real WhatsApp numbers is switched off.
          </p>
          {live ? (
            <DemoButton className="mt-6 w-full">Open the live demo</DemoButton>
          ) : (
            <p className="mt-6 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              The live demo is not available on this installation.
            </p>
          )}
        </div>

        <div className="flex flex-col rounded-xl border border-border bg-card p-6">
          <CalendarDays className="size-6 text-primary" />
          <h2 className="mt-4 text-xl font-semibold">Book a guided demo</h2>
          <p className="mt-2 flex-1 text-sm text-muted-foreground">
            30 minutes with our team: we&apos;ll map your WhatsApp use case, show the features that matter to you and
            help you plan onboarding — including connecting your number.
          </p>
          <a
            href={brand.bookingUrl || `mailto:${brand.supportEmail}?subject=${encodeURIComponent(`${brand.name} demo request`)}`}
            className={buttonVariants({ variant: "outline", size: "lg", className: "mt-6 w-full" })}
          >
            Book a demo
          </a>
        </div>
      </div>
    </div>
  );
}
