"use client";

// ============================================================
// Marketing contact form, delivered by Web3Forms (web3forms.com).
//
// The browser posts straight to https://api.web3forms.com/submit —
// no server route — and Web3Forms emails the submission to the
// address the access key was created for.
//
//   NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY   from web3forms.com (free); it is
//                                       designed to be public
//
// Without a key the form still renders, with submission disabled and
// a mailto fallback, so the page never shows a broken form.
// ============================================================

import { useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { brand } from "@/content/marketing";

const ACCESS_KEY = process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY?.trim() || "";
const ENDPOINT = "https://api.web3forms.com/submit";

const TOPICS = ["Pricing & plans", "Book a demo", "Onboarding help", "Partnership", "Something else"];

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string };

interface Fields {
  name: string;
  email: string;
  phone: string;
  company: string;
  topic: string;
  message: string;
}

const EMPTY: Fields = { name: "", email: "", phone: "", company: "", topic: TOPICS[0], message: "" };

export function validateContact(f: Fields): Partial<Record<keyof Fields, string>> {
  const errors: Partial<Record<keyof Fields, string>> = {};
  if (f.name.trim().length < 2) errors.name = "Please enter your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) errors.email = "Please enter a valid email address.";
  if (f.phone.trim() && !/^[+\d][\d\s()-]{6,}$/.test(f.phone.trim())) errors.phone = "Please enter a valid phone number.";
  if (f.message.trim().length < 10) errors.message = "Please tell us a little more (at least 10 characters).";
  return errors;
}

export function ContactForm() {
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  // Honeypot: real people never see or fill this; bots do.
  const [botcheck, setBotcheck] = useState(false);

  const set = (key: keyof Fields) => (value: string) => {
    setFields((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const found = validateContact(fields);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (!ACCESS_KEY) return;
    if (botcheck) {
      // Pretend success so bots learn nothing.
      setStatus({ kind: "sent" });
      return;
    }

    setStatus({ kind: "sending" });
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: ACCESS_KEY,
          subject: `New enquiry (${fields.topic}) — ${brand.name} website`,
          from_name: `${brand.name} website`,
          name: fields.name.trim(),
          email: fields.email.trim(),
          phone: fields.phone.trim() || undefined,
          company: fields.company.trim() || undefined,
          topic: fields.topic,
          message: fields.message.trim(),
          page: typeof window !== "undefined" ? window.location.href : undefined,
          botcheck: false,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { success?: boolean; message?: string };
      if (!response.ok || !data.success) {
        setStatus({ kind: "error", message: data.message || "We couldn't send your message. Please try again." });
        return;
      }
      setStatus({ kind: "sent" });
      setFields(EMPTY);
    } catch {
      setStatus({ kind: "error", message: "Network error — please check your connection and try again." });
    }
  }

  if (status.kind === "sent") {
    return (
      <div role="status" className="flex flex-col items-center rounded-xl border border-border bg-card p-10 text-center">
        <CheckCircle2 className="size-10 text-primary" />
        <h3 className="mt-4 text-xl font-semibold">Thanks — message sent!</h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          We&apos;ve received your enquiry and will reply to your email within one business day.
        </p>
        <Button variant="outline" className="mt-6" onClick={() => setStatus({ kind: "idle" })}>
          Send another message
        </Button>
      </div>
    );
  }

  const field = (key: keyof Fields) => ({
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `${key}-error` : undefined,
  });
  const errorText = (key: keyof Fields) =>
    errors[key] ? (
      <p id={`${key}-error`} className="text-xs text-destructive">
        {errors[key]}
      </p>
    ) : null;

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 rounded-xl border border-border bg-background p-6 sm:grid-cols-2 sm:p-8">
      <div className="space-y-1.5">
        <Label htmlFor="cf-name">Name *</Label>
        <Input id="cf-name" autoComplete="name" value={fields.name} onChange={(e) => set("name")(e.target.value)} {...field("name")} />
        {errorText("name")}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cf-email">Work email *</Label>
        <Input
          id="cf-email"
          type="email"
          autoComplete="email"
          value={fields.email}
          onChange={(e) => set("email")(e.target.value)}
          {...field("email")}
        />
        {errorText("email")}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cf-phone">Phone / WhatsApp</Label>
        <Input
          id="cf-phone"
          type="tel"
          autoComplete="tel"
          placeholder="+91 98xxxxxxxx"
          value={fields.phone}
          onChange={(e) => set("phone")(e.target.value)}
          {...field("phone")}
        />
        {errorText("phone")}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cf-company">Company</Label>
        <Input id="cf-company" autoComplete="organization" value={fields.company} onChange={(e) => set("company")(e.target.value)} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="cf-topic">What can we help with?</Label>
        <select
          id="cf-topic"
          value={fields.topic}
          onChange={(e) => set("topic")(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground focus:border-ring focus:outline-none"
        >
          {TOPICS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="cf-message">Message *</Label>
        <Textarea
          id="cf-message"
          rows={5}
          value={fields.message}
          onChange={(e) => set("message")(e.target.value)}
          {...field("message")}
        />
        {errorText("message")}
      </div>

      {/* Honeypot — hidden from people and assistive tech. */}
      <input
        type="checkbox"
        name="botcheck"
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
        checked={botcheck}
        onChange={(e) => setBotcheck(e.target.checked)}
      />

      <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
        {ACCESS_KEY ? (
          <p className="text-xs text-muted-foreground">We reply within one business day. No spam, ever.</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            The contact form isn&apos;t set up yet — email us at{" "}
            <a className="underline" href={`mailto:${brand.supportEmail}`}>
              {brand.supportEmail}
            </a>
            .
          </p>
        )}
        <Button type="submit" size="lg" className="h-10 px-5" disabled={!ACCESS_KEY || status.kind === "sending"}>
          {status.kind === "sending" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          {status.kind === "sending" ? "Sending…" : "Send message"}
        </Button>
      </div>
      {status.kind === "error" ? (
        <p role="alert" className="text-sm text-destructive sm:col-span-2">
          {status.message}
        </p>
      ) : null}
    </form>
  );
}
