"use client";

import { useState } from "react";
import { BarChart3, Bot, Check, GitBranch, MessageSquare, Radio, Workflow } from "lucide-react";

import { cn } from "@/lib/utils";
import { productTour } from "@/content/marketing";

type TourId = (typeof productTour)[number]["id"];

/**
 * Product tour: a vertical tab list (horizontal scroll on mobile) beside
 * a panel with the selected feature's copy and a live-looking preview.
 */
export function FeatureTabs() {
  const [active, setActive] = useState<TourId>(productTour[0].id);
  const item = productTour.find((p) => p.id === active) ?? productTour[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[17rem_1fr] lg:gap-10">
      <div
        role="tablist"
        aria-label="Product tour"
        aria-orientation="vertical"
        className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0"
      >
        {productTour.map((p) => {
          const selected = p.id === active;
          return (
            <button
              key={p.id}
              role="tab"
              id={`tab-${p.id}`}
              aria-selected={selected}
              aria-controls={`panel-${p.id}`}
              onClick={() => setActive(p.id)}
              className={cn(
                "shrink-0 rounded-lg px-3.5 py-2.5 text-left text-sm transition-colors lg:border-l-2 lg:rounded-none lg:rounded-r-lg lg:py-3",
                selected
                  ? "bg-card font-medium text-foreground shadow-xs ring-1 ring-border lg:border-primary lg:ring-0 lg:shadow-none lg:bg-card"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground lg:border-transparent",
              )}
            >
              {p.label}
              <span className="mt-0.5 hidden text-xs font-normal text-muted-foreground lg:block">{p.title}</span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`panel-${item.id}`}
        aria-labelledby={`tab-${item.id}`}
        className="grid items-center gap-8 rounded-xl border border-border bg-card p-6 sm:p-8 xl:grid-cols-[0.9fr_1.1fr]"
      >
        <div className="min-w-0">
          <h3 className="font-display text-2xl sm:text-3xl">{item.title}</h3>
          <p className="mt-3 text-pretty text-muted-foreground">{item.body}</p>
          <ul className="mt-6 space-y-2.5">
            {item.points.map((pt) => (
              <li key={pt} className="flex items-center gap-2 text-sm">
                <Check className="size-4 shrink-0 text-primary" />
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
  const frame = "min-w-0 rounded-lg border border-border bg-background p-5 text-sm";
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
          We&apos;re open 11am–7pm on Sundays.
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
