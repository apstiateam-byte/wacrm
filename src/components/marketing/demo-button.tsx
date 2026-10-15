"use client";

import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/**
 * "Try the live demo" — signs the visitor into the shared demo
 * workspace via POST /api/demo/start, then opens the dashboard.
 */
export function DemoButton({
  children,
  variant = "default",
  className,
}: {
  children: ReactNode;
  variant?: "default" | "outline";
  className?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try {
      const res = await fetch("/api/demo/start", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "The live demo is unavailable right now.");
        return;
      }
      // Full navigation so the new session cookies drive the app shell.
      window.location.assign(data.redirect ?? "/dashboard");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="lg" variant={variant} className={className} onClick={start} disabled={busy}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : null}
      {children}
    </Button>
  );
}
