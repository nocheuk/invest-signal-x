import type { Json } from "@/lib/supabase/utility-types";
import { PRESETS, type PresetName, type StrategyWeights } from "@/lib/strategy";
import type { SaveAlertInput } from "@/hooks/useSavedAlerts";

export const INVESTOR_TYPES = ["Private investor", "Developer", "Agent", "Business owner", "Other"] as const;
export const INVESTMENT_STRATEGIES = ["Income/yield", "Value-add", "Development", "Owner-occupier", "Auction opportunities", "Mixed-use"] as const;
export const PREFERRED_ASSET_TYPES = ["Retail", "Office", "Industrial", "Mixed-use", "Land", "Hospitality", "Residential investment"] as const;
export const RISK_APPETITES = ["Conservative", "Balanced", "Opportunistic"] as const;
export const ALERT_PREFERENCES = ["Daily", "Weekly", "Only Green Candidates", "No alerts yet"] as const;
export const BUDGET_RANGES = ["Up to GBP 250k", "GBP 250k - GBP 500k", "GBP 500k - GBP 1m", "GBP 1m - GBP 2.5m", "GBP 2.5m - GBP 5m", "GBP 5m+"] as const;

export type InvestorType = typeof INVESTOR_TYPES[number];
export type InvestmentStrategy = typeof INVESTMENT_STRATEGIES[number];
export type RiskAppetite = typeof RISK_APPETITES[number];
export type AlertPreference = typeof ALERT_PREFERENCES[number];
export type BudgetRange = typeof BUDGET_RANGES[number];

export type InvestorOnboardingAnswers = {
  investorType: InvestorType | string;
  strategy: InvestmentStrategy | string;
  targetLocations: string[];
  budgetRange: BudgetRange | string;
  minYieldTarget: number;
  preferredAssetTypes: string[];
  riskAppetite: RiskAppetite | string;
  alertPreference: AlertPreference | string;
  completedAt?: string;
  skippedAt?: string;
};

export type InvestorPreferences = InvestorOnboardingAnswers & {
  onboardingCompleted: boolean;
};

export const DEFAULT_ONBOARDING: InvestorOnboardingAnswers = {
  investorType: "Private investor",
  strategy: "Income/yield",
  targetLocations: [],
  budgetRange: "GBP 500k - GBP 1m",
  minYieldTarget: 6,
  preferredAssetTypes: ["Retail", "Industrial"],
  riskAppetite: "Balanced",
  alertPreference: "Daily",
};

export function getInvestorPreferences(profile: { preferences?: Json | null } | null | undefined): InvestorPreferences {
  const preferences = objectValue(profile?.preferences);
  const onboarding = objectValue(preferences.investor_onboarding);
  const answers = {
    ...DEFAULT_ONBOARDING,
    investorType: stringValue(onboarding.investorType, DEFAULT_ONBOARDING.investorType),
    strategy: stringValue(onboarding.strategy, DEFAULT_ONBOARDING.strategy),
    targetLocations: stringArray(onboarding.targetLocations),
    budgetRange: stringValue(onboarding.budgetRange, DEFAULT_ONBOARDING.budgetRange),
    minYieldTarget: numberValue(onboarding.minYieldTarget, DEFAULT_ONBOARDING.minYieldTarget),
    preferredAssetTypes: stringArray(onboarding.preferredAssetTypes, DEFAULT_ONBOARDING.preferredAssetTypes),
    riskAppetite: stringValue(onboarding.riskAppetite, DEFAULT_ONBOARDING.riskAppetite),
    alertPreference: stringValue(onboarding.alertPreference, DEFAULT_ONBOARDING.alertPreference),
    completedAt: optionalString(onboarding.completedAt),
    skippedAt: optionalString(onboarding.skippedAt),
  };

  return {
    ...answers,
    onboardingCompleted: Boolean(preferences.onboarding_completed || answers.completedAt || answers.skippedAt),
  };
}

export function isOnboardingComplete(profile: { preferences?: Json | null } | null | undefined) {
  return getInvestorPreferences(profile).onboardingCompleted;
}

export function buildProfilePreferences(current: Json | null | undefined, answers: InvestorOnboardingAnswers, mode: "completed" | "skipped") {
  const preferences = objectValue(current);
  const timestamp = new Date().toISOString();
  return {
    ...preferences,
    onboarding_completed: true,
    investor_onboarding: {
      ...answers,
      targetLocations: cleanLocations(answers.targetLocations),
      preferredAssetTypes: answers.preferredAssetTypes.filter(Boolean),
      completedAt: mode === "completed" ? timestamp : answers.completedAt,
      skippedAt: mode === "skipped" ? timestamp : answers.skippedAt,
    },
  };
}

export function strategyFromOnboarding(answers: InvestorOnboardingAnswers): { name: string; preset: PresetName; weights: StrategyWeights } {
  const preset = presetFromStrategy(answers.strategy);
  const weights = { ...PRESETS[preset] };

  if (answers.riskAppetite === "Conservative") {
    weights.risk = Math.max(weights.risk, 82);
    weights.discount = Math.min(weights.discount, 65);
  }
  if (answers.riskAppetite === "Opportunistic") {
    weights.risk = Math.min(weights.risk, 35);
    weights.discount = Math.max(weights.discount, 82);
    weights.growth = Math.max(weights.growth, 72);
  }
  if (answers.strategy === "Income/yield") weights.yield = Math.max(weights.yield, 90);
  if (answers.strategy === "Development") weights.growth = Math.max(weights.growth, 90);
  if (answers.strategy === "Auction opportunities") weights.discount = Math.max(weights.discount, 90);

  return {
    name: `${answers.strategy} acquisition brief`,
    preset,
    weights,
  };
}

export function alertFromOnboarding(answers: InvestorOnboardingAnswers): SaveAlertInput | null {
  if (answers.alertPreference === "No alerts yet") return null;
  const location = cleanLocations(answers.targetLocations)[0] ?? "";
  const assetType = answers.preferredAssetTypes[0] ?? "All";
  return {
    name: `${location || "National"} ${answers.strategy} alert`,
    locationQuery: location,
    minYield: answers.minYieldTarget,
    maxPrice: budgetMaxPrice(answers.budgetRange),
    assetType,
    minScore: answers.alertPreference === "Only Green Candidates" ? 72 : 60,
    enabled: true,
  };
}

export function alertPreferencesFromOnboarding(answers: InvestorOnboardingAnswers) {
  return {
    email: answers.alertPreference !== "No alerts yet",
    frequency: answers.alertPreference === "Weekly" ? "weekly" : "daily",
    min_score: answers.alertPreference === "Only Green Candidates" ? 72 : 60,
  };
}

export function dashboardDefaultsFromPreferences(preferences: InvestorPreferences) {
  return {
    locationQuery: preferences.targetLocations[0] ?? "",
    assetType: preferences.preferredAssetTypes[0] ?? "All",
    minYield: preferences.minYieldTarget || 0,
  };
}

export function acquisitionBriefSummary(answers: InvestorOnboardingAnswers) {
  const locations = cleanLocations(answers.targetLocations);
  return [
    `${answers.investorType} focused on ${answers.strategy.toLowerCase()} opportunities.`,
    locations.length ? `Target locations: ${locations.join(", ")}.` : "Target locations: national coverage.",
    `Budget: ${answers.budgetRange}; minimum yield target: ${answers.minYieldTarget}%.`,
    `Preferred assets: ${answers.preferredAssetTypes.length ? answers.preferredAssetTypes.join(", ") : "All assets"}; risk appetite: ${answers.riskAppetite}.`,
  ];
}

export function cleanLocations(locations: string[]) {
  return locations.map((location) => location.trim()).filter(Boolean);
}

export function parseLocations(value: string) {
  return cleanLocations(value.split(","));
}

function presetFromStrategy(strategy: string): PresetName {
  if (strategy === "Income/yield") return "Cashflow";
  if (strategy === "Value-add") return "Value";
  if (strategy === "Development") return "Growth";
  if (strategy === "Auction opportunities") return "Opportunistic";
  return "Balanced";
}

function budgetMaxPrice(value: string) {
  if (value.includes("5m")) return 5000000;
  if (value.includes("2.5m")) return 2500000;
  if (value.includes("1m")) return 1000000;
  if (value.includes("500k")) return 500000;
  if (value.includes("250k")) return 250000;
  return 0;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringArray(value: unknown, fallback: string[] = []) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : fallback;
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value ? value : fallback;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function numberValue(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
