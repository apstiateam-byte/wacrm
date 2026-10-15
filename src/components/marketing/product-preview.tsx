import {
  Bot,
  GitBranch,
  LayoutDashboard,
  MessageSquare,
  Radio,
  Search,
  Users,
  Workflow,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Large, framed "screenshot" of the app for the landing hero — pure
 * markup in theme tokens, so it follows the colour scheme and light /
 * dark mode and never goes stale like a PNG would. Decorative only.
 */
export function ProductPreview({ className }: { className?: string }) {
  const nav = [
    { icon: LayoutDashboard, label: "Dashboard" },
    { icon: MessageSquare, label: "Inbox", active: true },
    { icon: Users, label: "Contacts" },
    { icon: Radio, label: "Broadcasts" },
    { icon: Zap, label: "Automations" },
    { icon: Workflow, label: "Flows" },
    { icon: Bot, label: "AI Agents" },
    { icon: GitBranch, label: "Pipelines" },
  ];
  const chats = [
    { name: "Priya Sharma", text: "Do you deliver to Pune by Friday?", time: "11m", unread: 2, active: true },
    { name: "Aditya Verma", text: "We need GST invoices for B2B", time: "6m", unread: 3 },
    { name: "Vikram Singh", text: "My order #4821 still shows…", time: "30m", unread: 1 },
    { name: "Ananya Iyer", text: "Perfect, waiting for the quote", time: "1d" },
    { name: "Arjun Nair", text: "Please send the invoice to accounts", time: "1d" },
  ];

  return (
    <div aria-hidden className={cn("min-w-0 rounded-2xl border border-border bg-card/80 p-2 shadow-2xl shadow-primary/10 backdrop-blur", className)}>
      <div className="flex items-center gap-1.5 px-2 pb-2 pt-1">
        <span className="size-2.5 rounded-full bg-red-400/70" />
        <span className="size-2.5 rounded-full bg-amber-400/70" />
        <span className="size-2.5 rounded-full bg-emerald-400/70" />
        <span className="mx-auto hidden rounded-md bg-muted px-16 py-0.5 text-[10px] text-muted-foreground sm:block">app / inbox</span>
      </div>
      <div className="grid overflow-hidden rounded-xl border border-border bg-background text-left md:grid-cols-[150px_240px_1fr] lg:grid-cols-[160px_260px_1fr_220px]">
        {/* Sidebar */}
        <div className="hidden flex-col gap-0.5 border-r border-border bg-sidebar p-2 md:flex">
          {nav.map(({ icon: Icon, label, active }) => (
            <div
              key={label}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px]",
                active ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-3.5" /> {label}
            </div>
          ))}
        </div>
        {/* Chat list */}
        <div className="hidden border-r border-border md:block">
          <div className="flex items-center gap-1.5 border-b border-border px-3 py-2 text-[11px] text-muted-foreground">
            <Search className="size-3" /> Search conversations
          </div>
          {chats.map((c) => (
            <div key={c.name} className={cn("flex items-center gap-2 border-b border-border/60 px-3 py-2.5", c.active && "bg-primary/[0.07]")}>
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
                {c.name[0]}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-1">
                  <p className="truncate text-[11px] font-medium">{c.name}</p>
                  <span className="text-[9px] text-muted-foreground">{c.time}</span>
                </div>
                <p className="truncate text-[10px] text-muted-foreground">{c.text}</p>
              </div>
              {c.unread ? (
                <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-semibold text-primary-foreground">
                  {c.unread}
                </span>
              ) : null}
            </div>
          ))}
        </div>
        {/* Conversation */}
        <div className="flex min-h-[300px] flex-col gap-2 bg-muted/30 p-4 text-[12px]">
          <div className="mx-auto rounded-full bg-background px-2.5 py-0.5 text-[10px] text-muted-foreground">Today</div>
          <p className="max-w-[80%] rounded-xl rounded-tl-sm bg-background px-3 py-2 shadow-sm">
            Hi! Is the blue silk saree back in stock?
          </p>
          <p className="ml-auto max-w-[80%] rounded-xl rounded-tr-sm bg-primary px-3 py-2 text-primary-foreground">
            Yes, it arrived this morning 👋 Shall I reserve one for you?
          </p>
          <p className="max-w-[80%] rounded-xl rounded-tl-sm bg-background px-3 py-2 shadow-sm">
            Yes please! Do you deliver to Pune by Friday?
          </p>
          <div className="mt-auto flex items-center gap-2 rounded-xl border border-primary/30 bg-background px-3 py-2 text-primary">
            <Bot className="size-3.5 shrink-0" />
            <span className="truncate">AI draft: “Yes — order by Wednesday for Friday delivery.”</span>
            <span className="ml-auto shrink-0 rounded-md bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">Use</span>
          </div>
        </div>
        {/* Contact panel */}
        <div className="hidden flex-col gap-3 border-l border-border p-4 text-[11px] lg:flex">
          <div className="flex flex-col items-center text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">P</span>
            <p className="mt-2 font-medium">Priya Sharma</p>
            <p className="text-[10px] text-muted-foreground">Sharma Boutique</p>
          </div>
          <div className="flex flex-wrap gap-1">
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] text-amber-700 dark:text-amber-300">VIP</span>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] text-emerald-700 dark:text-emerald-300">Repeat buyer</span>
          </div>
          <div className="rounded-lg border border-border bg-card p-2.5">
            <p className="text-[10px] text-muted-foreground">Deal</p>
            <p className="font-medium">Wedding trousseau</p>
            <p className="mt-1 flex justify-between text-[10px]">
              <span>₹48,500</span>
              <span className="text-primary">Negotiation</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
