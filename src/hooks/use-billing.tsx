"use client";

// ============================================================
// BillingProvider — the account's plan, limits and usage for the
// dashboard, plus the global upgrade dialog.
//
// Loads GET /api/billing once the account context is ready and
// re-fetches on demand (after checkout, or when a plan-limit error is
// reported). Any component can call `openUpgrade(reason)`; failures
// detected by `plan-limit-events` open it automatically.
// ============================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/hooks/use-auth";
import {
  installPlanLimitFetch,
  PLAN_LIMIT_EVENT,
  type PlanLimitEventDetail,
} from "@/lib/billing/plan-limit-events";
import {
  isReadOnlyState,
  type BillingSummary,
  type FeatureKey,
  type PlanLimitPayload,
} from "@/lib/billing/types";
import { UpgradeDialog } from "@/components/billing/upgrade-dialog";

interface BillingContextValue {
  summary: BillingSummary | null;
  loading: boolean;
  refresh: () => Promise<void>;
  /** True when billing is on and the account can still write. */
  writable: boolean;
  /** Feature flag from the plan; always true while billing is off / loading. */
  hasFeature: (feature: FeatureKey) => boolean;
  openUpgrade: (reason?: PlanLimitPayload) => void;
}

const BillingContext = createContext<BillingContextValue | null>(null);

export function BillingProvider({ children }: { children: ReactNode }) {
  const { user, accountStatus } = useAuth();
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgradeReason, setUpgradeReason] = useState<PlanLimitPayload | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/billing", { cache: "no-store" });
      if (res.ok) setSummary((await res.json()) as BillingSummary);
    } catch (err) {
      console.error("[billing] summary fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user || accountStatus !== "ready") return;
    void refresh();
  }, [user, accountStatus, refresh]);

  const openUpgrade = useCallback((reason?: PlanLimitPayload) => {
    setUpgradeReason(reason ?? null);
    setUpgradeOpen(true);
  }, []);

  // Plan-limit failures reported from anywhere in the app.
  useEffect(() => {
    installPlanLimitFetch();
    const onLimit = (event: Event) => {
      const detail = (event as CustomEvent<PlanLimitEventDetail>).detail;
      if (detail.code === "rls_denied") {
        // Only a billing problem when the account is actually read-only;
        // otherwise it's a role issue the call site already reports.
        if (summary && isReadOnlyState(summary.entitlements.state)) {
          openUpgrade({ code: "account_read_only" });
        }
        return;
      }
      openUpgrade(detail);
      void refresh();
    };
    window.addEventListener(PLAN_LIMIT_EVENT, onLimit);
    return () => window.removeEventListener(PLAN_LIMIT_EVENT, onLimit);
  }, [summary, openUpgrade, refresh]);

  const value = useMemo<BillingContextValue>(() => {
    const ent = summary?.entitlements;
    return {
      summary,
      loading,
      refresh,
      writable: ent ? ent.writable : true,
      hasFeature: (feature) => (ent ? ent.features[feature] !== false : true),
      openUpgrade,
    };
  }, [summary, loading, refresh, openUpgrade]);

  return (
    <BillingContext.Provider value={value}>
      {children}
      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        reason={upgradeReason}
        summary={summary}
      />
    </BillingContext.Provider>
  );
}

export function useBilling(): BillingContextValue {
  const ctx = useContext(BillingContext);
  if (!ctx) throw new Error("useBilling must be used inside <BillingProvider>");
  return ctx;
}
