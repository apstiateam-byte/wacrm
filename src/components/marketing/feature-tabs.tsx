"use client";

import { useState } from "react";
import { BarChart3, Bot, Check, GitBranch, MessageSquare, Radio, Workflow } from "lucide-react";

import { cn } from "@/lib/utils";
import { productTour } from "@/content/marketing";

type TourId = (typeof productTour)[number]["id"];

/**
 * Product tour: a row of pill tabs (like the category chips on modern
 * SaaS galleries) switching a two-column panel of copy + illustration.
 */
export function FeatureTabs() {
  const [active, setActive] = useState<TourId>(productTour[0].id);
  const item = productTour.find((p) => p.id === active) ?? productTour[0];

  return (
    <div>
      <div role="tablist" aria-label="Product tour" className="flex flex-wrap justify-center gap-2">
        {productTour.map((p) => (
          <button
            key={p.id}
            role="tab"
            id={`tab-${p.id}`}
            aria-selected={p.id === active}
            aria-controls={`panel-${p.id}`}
            onClick={() => setActive(p.id)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              p.id === active
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`panel-${item.id}`}
        aria-labelledby={`tab-${item.id}`}
        className="mt-10 grid items-center gap-10 rounded-3xl border border-border bg-card p-6 sm:p-10 lg:grid-cols-2"
      >
        <div className="min-w-0">
          <h3 className="font-heading text-2xl sm:text-3xl">{item.title}</h3>
          <p className="mt-4 text-muted-foreground">{item.body}</p>
          <ul className="mt-6 space-y-2.5">
            {item.points.map((pt) => (
              <li key={pt} className="flex items-center gap-2 text-sm">
                <span className="flex size-5 items-center justify-center rounded-full bg-primary/12 text-primary">
                  <Check className="size-3" />
                </span>
                {pt}
              </li>
            ))}
          </ul>
        </div>
        <TourVisual id={item.id} />
      </div>
    </div>
  );
}

function TourVisual({ id }: { id: TourId }) {
  const frame = "min-w-0 rounded-2xl border border-border bg-background p-5 text-sm";
  if (id === "broadcasts") {
    const rows = [
      ["Delivered", 96],
      ["Read", 81],
      ["Replied", 34],
    ] as const;
    return (
      <div aria-hidden className={frame}>
        <div className="flex items-center gap-2 font-medium">
          <Radio className="size-4 text-primary" /> Diwali sale — 2,400 recipients
        </div>
        <div className="mt-5 space-y-4">
          {rows.map(([label, pct]) => (
            <div key={label}>
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>{label}</span>
                <span>{pct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-5 text-xs text-muted-foreground">Illustrative numbers</p>
      </div>
    );
  }
  if (id === "flows") {
    return (
      <div aria-hidden className={cn(frame, "flex flex-col items-center gap-3")}>
        <div className="rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 font-medium text-primary">
          <Workflow className="mr-1.5 inline size-4" /> Welcome menu
        </div>
        <div className="h-5 w-px bg-border" />
        <div className="grid w-full grid-cols-3 gap-2 text-center text-xs">
          {["Order status", "New order", "Talk to us"].map((b) => (
            <div key={b} className="rounded-lg border border-border bg-card px-2 py-2">
              {b}
            </div>
          ))}
        </div>
        <div className="grid w-full grid-cols-3 gap-2 text-center text-[11px] text-muted-foreground">
          <span>Ask order ID</span>
          <span>Share catalogue</span>
          <span>Assign agent</span>
        </div>
      </div>
    );
  }
  if (id === "ai") {
    return (
      <div aria-hidden className={cn(frame, "space-y-3")}>
        <p className="w-fit max-w-[85%] rounded-xl rounded-tl-sm bg-muted px-3 py-2">What are your store timings on Sunday?</p>
        <div className="ml-auto w-fit max-w-[85%] rounded-xl rounded-tr-sm bg-primary px-3 py-2 text-primary-foreground">
          We&apos;re open 11am–7pm on Sundays 😊
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Bot className="size-3.5 text-primary" /> Answered by AI from “Store FAQ”
        </div>
      </div>
    );
  }
  if (id === "pipeline") {
    const cols = [
      ["New enquiry", ["B2B supply · ₹60k"]],
      ["Quote sent", ["Hotel covers · ₹84k"]],
      ["Won", ["Quarterly stock · ₹1.5L"]],
    ] as const;
    return (
      <div aria-hidden className={cn(frame, "grid grid-cols-3 gap-2")}>
        {cols.map(([title, cards]) => (
          <div key={title} className="rounded-xl bg-muted/50 p-2">
            <p className="mb-2 flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <GitBranch className="size-3" /> {title}
            </p>
            {cards.map((c) => (
              <div key={c} className="rounded-lg border border-border bg-card p-2 text-[11px]">
                {c}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }
  // inbox
  return (
    <div aria-hidden className={cn(frame, "space-y-2")}>
      {[
        ["Priya Sharma", "Do you deliver to Pune by Friday?", "Assigned to you"],
        ["Aditya Verma", "We need GST invoices for B2B", "Sales"],
        ["Vikram Singh", "Order #4821 update?", "Support"],
      ].map(([name, text, tag]) => (
        <div key={name} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
          <MessageSquare className="size-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{text}</p>
          </div>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">{tag}</span>
        </div>
      ))}
      <p className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
        <BarChart3 className="size-3.5" /> 3 open · 1 waiting on you
      </p>
    </div>
  );
}
