import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Deal } from "@/lib/deals";
import { useAuth } from "@/lib/auth";
import { applyConfidenceCap } from "@/lib/scoring";
import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase/client";

export type StrategyWeights = {
  yield: number;
  growth: number;
  discount: number;
  risk: number;
  demand: number;
};

export type PresetName = "Cashflow" | "Growth" | "Value" | "Balanced" | "Opportunistic";

export const PRESETS: Record<PresetName, StrategyWeights> = {
  Balanced: { yield: 60, growth: 60, discount: 60, risk: 60, demand: 60 },
  Cashflow: { yield: 90, growth: 35, discount: 55, risk: 75, demand: 70 },
  Growth: { yield: 35, growth: 90, discount: 55, risk: 50, demand: 65 },
  Value: { yield: 65, growth: 55, discount: 90, risk: 60, demand: 55 },
  Opportunistic: { yield: 80, growth: 75, discount: 85, risk: 30, demand: 50 },
};

export const SLIDER_META: { key: keyof StrategyWeights; label: string; helper: string }[] = [
  { key: "yield", label: "Yield", helper: "Prioritise income return and net yield." },
  { key: "growth", label: "Capital Growth", helper: "Prioritise long-term area and value growth." },
  { key: "discount", label: "Discount to Market", helper: "Prioritise assets priced below comparable evidence." },
  { key: "risk", label: "Risk Control", helper: "Prioritise covenant strength, lease security and downside protection." },
  { key: "demand", label: "Rental / Occupier Demand", helper: "Prioritise re-lettability and local demand." },
];

type StrategyState = {
  id?: string;
  name: string;
  preset: PresetName;
  weights: StrategyWeights;
};

type Ctx = StrategyState & {
  isSaving: boolean;
  error: string | null;
  setName: (n: string) => void;
  setPreset: (p: PresetName) => void;
  setWeights: (w: StrategyWeights) => void;
  save: (s: { name: string; preset: PresetName; weights: StrategyWeights }) => Promise<void>;
  reset: () => void;
};

const StrategyContext = createContext<Ctx | null>(null);
const KEY = "dealsignal:strategy";
const DEFAULT_STRATEGY: StrategyState = { name: "Balanced", preset: "Balanced", weights: PRESETS.Balanced };

function readLocalStrategy() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved) return saved as StrategyState;
  } catch {
    // Keep demo fallback resilient to malformed localStorage.
  }
  return DEFAULT_STRATEGY;
}

export function StrategyProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [state, setState] = useState<StrategyState>(() => isSupabaseConfigured ? DEFAULT_STRATEGY : readLocalStrategy());
  const [error, setError] = useState<string | null>(null);

  const queryKey = ["active-strategy", auth.user?.id];
  const strategyQuery = useQuery({
    queryKey,
    enabled: isSupabaseConfigured && Boolean(auth.user?.id),
    queryFn: async (): Promise<StrategyState> => {
      const { data, error: queryError } = await requireSupabase()
        .from("strategies")
        .select("*")
        .eq("user_id", auth.user!.id)
        .eq("is_active", true)
        .maybeSingle();
      if (queryError) throw queryError;
      if (!data) return DEFAULT_STRATEGY;
      return {
        id: data.id,
        name: data.name,
        preset: data.preset as PresetName,
        weights: data.weights as StrategyWeights,
      };
    },
  });

  useEffect(() => {
    if (strategyQuery.data) setState(strategyQuery.data);
  }, [strategyQuery.data]);

  useEffect(() => {
    if (!isSupabaseConfigured) localStorage.setItem(KEY, JSON.stringify(state));
  }, [state]);

  const saveMutation = useMutation({
    mutationFn: async (next: StrategyState) => {
      if (!isSupabaseConfigured) {
        localStorage.setItem(KEY, JSON.stringify(next));
        return next;
      }
      if (!auth.user) throw new Error("Cannot save strategy without an authenticated Supabase user.");

      const db = requireSupabase();
      if (!next.id) {
        await db.from("strategies").update({ is_active: false }).eq("user_id", auth.user.id).eq("is_active", true);
      }

      const { data, error: upsertError } = await db
        .from("strategies")
        .upsert({
          id: next.id,
          user_id: auth.user.id,
          name: next.name,
          preset: next.preset,
          weights: next.weights,
          is_active: true,
        })
        .select("*")
        .single();
      if (upsertError) throw upsertError;
      return { id: data.id, name: data.name, preset: data.preset as PresetName, weights: data.weights as StrategyWeights };
    },
    onMutate: async (next) => {
      setError(null);
      await queryClient.cancelQueries({ queryKey });
      const previous = state;
      setState(next);
      queryClient.setQueryData(queryKey, next);
      return { previous };
    },
    onError: (mutationError, _next, context) => {
      if (context?.previous) setState(context.previous);
      setError(mutationError instanceof Error ? mutationError.message : "Could not save strategy.");
    },
    onSuccess: (saved) => {
      setState(saved);
      queryClient.setQueryData(queryKey, saved);
    },
  });

  const value = useMemo<Ctx>(() => ({
    ...state,
    isSaving: saveMutation.isPending,
    error,
    setName: (n) => setState((s) => ({ ...s, name: n })),
    setPreset: (p) => setState((s) => ({ ...s, preset: p, weights: PRESETS[p] })),
    setWeights: (w) => setState((s) => ({ ...s, weights: w })),
    save: async (s) => {
      await saveMutation.mutateAsync({ ...state, ...s });
    },
    reset: () => setState(DEFAULT_STRATEGY),
  }), [error, saveMutation, state]);

  return <StrategyContext.Provider value={value}>{children}</StrategyContext.Provider>;
}

export const useStrategy = () => {
  const ctx = useContext(StrategyContext);
  if (!ctx) throw new Error("useStrategy must be used within StrategyProvider");
  return ctx;
};

export function dealComponentScores(deal: Deal) {
  const yieldScore = Math.max(0, Math.min(100, deal.netInitialYield * 12));
  const reversionaryUplift = deal.netInitialYield > 0
    ? Math.max(0, (deal.reversionaryYield - deal.netInitialYield) / deal.netInitialYield) * 100
    : deal.planningUpsideScore;
  const growthScore = Math.max(0, Math.min(100, deal.planningUpsideScore * 0.6 + reversionaryUplift * 4));
  const discountScore = deal.scoreBreakdown.marketPricing;
  const exitPenalty = deal.exitYieldSensitivity === "Low" ? 0 : deal.exitYieldSensitivity === "Moderate" ? 15 : 30;
  const riskScore = Math.max(0, Math.min(100, (deal.scoreBreakdown.tenantSecurity * 0.6 + (100 - deal.voidRiskScore) * 0.4) - exitPenalty * 0.3));
  const demandScore = Math.max(0, Math.min(100, (100 - deal.voidRiskScore) * 0.7 + deal.tenantHealthScore * 0.3));
  return { yield: yieldScore, growth: growthScore, discount: discountScore, risk: riskScore, demand: demandScore };
}

export function personalisedScore(deal: Deal, w: StrategyWeights) {
  const c = dealComponentScores(deal);
  const totalW = w.yield + w.growth + w.discount + w.risk + w.demand;
  if (totalW === 0) return deal.score;
  const raw = c.yield * w.yield + c.growth * w.growth + c.discount * w.discount + c.risk * w.risk + c.demand * w.demand;
  return applyConfidenceCap(Math.round(raw / totalW), deal.dataConfidenceScore);
}

export function matchReasons(deal: Deal, w: StrategyWeights): string[] {
  const c = dealComponentScores(deal);
  const items: { key: keyof StrategyWeights; weight: number; score: number; text: string }[] = [
    { key: "yield", weight: w.yield, score: c.yield, text: `Strong income return at ${deal.netInitialYield.toFixed(2)}% NIY` },
    { key: "growth", weight: w.growth, score: c.growth, text: `Reversionary upside to ${deal.reversionaryYield.toFixed(2)}% with planning optionality` },
    { key: "discount", weight: w.discount, score: c.discount, text: `Priced below comparable evidence at GBP ${deal.pricePerSqft}/sqft` },
    { key: "risk", weight: w.risk, score: c.risk, text: `${deal.covenantStrength} covenant, ${deal.wault.toFixed(1)}y WAULT` },
    { key: "demand", weight: w.demand, score: c.demand, text: `Low void risk in ${deal.location}` },
  ];
  return items
    .filter(i => i.weight >= 50 && i.score >= 55)
    .sort((a, b) => (b.weight * b.score) - (a.weight * a.score))
    .slice(0, 3)
    .map(i => i.text);
}

export function strategySummary(w: StrategyWeights) {
  const entries = SLIDER_META.map(m => ({ ...m, value: w[m.key] }));
  const sorted = [...entries].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, 2);
  const bottom = sorted.slice(-2).reverse();
  const riskAppetite = w.risk >= 70 ? "Conservative" : w.risk >= 50 ? "Balanced" : w.risk >= 35 ? "Assertive" : "Opportunistic";
  return {
    focus: top.map(t => t.label).join(" + "),
    riskAppetite,
    prioritised: top.map(t => t.label),
    deprioritised: bottom.filter(b => b.value < 50).map(b => b.label),
  };
}
