import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import type { Deal } from "@/lib/deals";

export type StrategyWeights = {
  yield: number;
  growth: number;
  discount: number;
  risk: number;
  demand: number;
};

export type PresetName = "Cashflow" | "Growth" | "Value" | "Balanced" | "Opportunistic";

export const PRESETS: Record<PresetName, StrategyWeights> = {
  Balanced:      { yield: 60, growth: 60, discount: 60, risk: 60, demand: 60 },
  Cashflow:      { yield: 90, growth: 35, discount: 55, risk: 75, demand: 70 },
  Growth:        { yield: 35, growth: 90, discount: 55, risk: 50, demand: 65 },
  Value:         { yield: 65, growth: 55, discount: 90, risk: 60, demand: 55 },
  Opportunistic: { yield: 80, growth: 75, discount: 85, risk: 30, demand: 50 },
};

export const SLIDER_META: { key: keyof StrategyWeights; label: string; helper: string }[] = [
  { key: "yield",    label: "Yield",                    helper: "Prioritise income return and net yield." },
  { key: "growth",   label: "Capital Growth",           helper: "Prioritise long-term area and value growth." },
  { key: "discount", label: "Discount to Market",       helper: "Prioritise assets priced below comparable evidence." },
  { key: "risk",     label: "Risk Control",             helper: "Prioritise covenant strength, lease security and downside protection." },
  { key: "demand",   label: "Rental / Occupier Demand", helper: "Prioritise re-lettability and local demand." },
];

type StrategyState = {
  name: string;
  preset: PresetName;
  weights: StrategyWeights;
};

type Ctx = StrategyState & {
  setName: (n: string) => void;
  setPreset: (p: PresetName) => void;
  setWeights: (w: StrategyWeights) => void;
  save: (s: { name: string; preset: PresetName; weights: StrategyWeights }) => void;
  reset: () => void;
};

const StrategyContext = createContext<Ctx | null>(null);
const KEY = "dealsignal:strategy";

export function StrategyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StrategyState>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if (saved) return saved;
    } catch { /* noop */ }
    return { name: "Balanced", preset: "Balanced", weights: PRESETS.Balanced };
  });

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(state)); }, [state]);

  const value: Ctx = {
    ...state,
    setName: (n) => setState((s) => ({ ...s, name: n })),
    setPreset: (p) => setState((s) => ({ ...s, preset: p, weights: PRESETS[p] })),
    setWeights: (w) => setState((s) => ({ ...s, weights: w })),
    save: (s) => setState(s),
    reset: () => setState({ name: "Balanced", preset: "Balanced", weights: PRESETS.Balanced }),
  };
  return <StrategyContext.Provider value={value}>{children}</StrategyContext.Provider>;
}

export const useStrategy = () => {
  const ctx = useContext(StrategyContext);
  if (!ctx) throw new Error("useStrategy must be used within StrategyProvider");
  return ctx;
};

// --- Personalised scoring -------------------------------------------------

export function dealComponentScores(deal: Deal) {
  // Yield: NIY 0-10% mapped to 0-100, capped
  const yieldScore = Math.max(0, Math.min(100, deal.netInitialYield * 12));
  // Growth: blend of planning upside + reversionary uplift vs NIY
  const reversionaryUplift = deal.netInitialYield > 0
    ? Math.max(0, (deal.reversionaryYield - deal.netInitialYield) / deal.netInitialYield) * 100
    : deal.planningUpsideScore;
  const growthScore = Math.max(0, Math.min(100, deal.planningUpsideScore * 0.6 + reversionaryUplift * 4));
  // Discount: marketPricing breakdown is exactly that
  const discountScore = deal.scoreBreakdown.marketPricing;
  // Risk: tenant security combined with inverse void risk + exit sensitivity
  const exitPenalty = deal.exitYieldSensitivity === "Low" ? 0 : deal.exitYieldSensitivity === "Moderate" ? 15 : 30;
  const riskScore = Math.max(0, Math.min(100, (deal.scoreBreakdown.tenantSecurity * 0.6 + (100 - deal.voidRiskScore) * 0.4) - exitPenalty * 0.3));
  // Demand: inverse void risk weighted by tenant health
  const demandScore = Math.max(0, Math.min(100, (100 - deal.voidRiskScore) * 0.7 + deal.tenantHealthScore * 0.3));
  return { yield: yieldScore, growth: growthScore, discount: discountScore, risk: riskScore, demand: demandScore };
}

export function personalisedScore(deal: Deal, w: StrategyWeights) {
  const c = dealComponentScores(deal);
  const totalW = w.yield + w.growth + w.discount + w.risk + w.demand;
  if (totalW === 0) return deal.score;
  const raw =
    c.yield * w.yield +
    c.growth * w.growth +
    c.discount * w.discount +
    c.risk * w.risk +
    c.demand * w.demand;
  return Math.round(raw / totalW);
}

export function matchReasons(deal: Deal, w: StrategyWeights): string[] {
  const c = dealComponentScores(deal);
  const items: { key: keyof StrategyWeights; weight: number; score: number; text: string }[] = [
    { key: "yield",    weight: w.yield,    score: c.yield,    text: `Strong income return at ${deal.netInitialYield.toFixed(2)}% NIY` },
    { key: "growth",   weight: w.growth,   score: c.growth,   text: `Reversionary upside to ${deal.reversionaryYield.toFixed(2)}% with planning optionality` },
    { key: "discount", weight: w.discount, score: c.discount, text: `Priced below comparable evidence at £${deal.pricePerSqft}/sqft` },
    { key: "risk",     weight: w.risk,     score: c.risk,     text: `${deal.covenantStrength} covenant, ${deal.wault.toFixed(1)}y WAULT` },
    { key: "demand",   weight: w.demand,   score: c.demand,   text: `Low void risk in ${deal.location}` },
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
  const focus = top.map(t => t.label).join(" + ");
  return {
    focus,
    riskAppetite,
    prioritised: top.map(t => t.label),
    deprioritised: bottom.filter(b => b.value < 50).map(b => b.label),
  };
}
