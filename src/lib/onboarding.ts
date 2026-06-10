import type { Json } from "@/lib/supabase/utility-types";
import { PRESETS, type PresetName, type StrategyWeights } from "@/lib/strategy";
import type { SaveAlertInput } from "@/hooks/useSavedAlerts";

export const INVESTOR_TYPES = ["Private investor", "Developer", "Asset manager", "Agent/advisor", "Business owner/occupier", "First-time commercial buyer", "Other"] as const;
export const INVESTMENT_STRATEGIES = ["Passive income", "High-yield investments", "Capital growth", "Refurb/value-add", "Development opportunity", "Owner-occupier purchase", "Auction opportunities", "Mixed-use opportunities"] as const;
export const PREFERRED_ASSET_TYPES = ["Retail", "Office", "Industrial", "Warehouse/logistics", "Mixed-use", "Land", "Hospitality", "Residential investment", "Medical/healthcare", "Leisure", "Other"] as const;
export const FINANCING_POSITIONS = ["Cash buyer", "Commercial mortgage", "Bridging finance", "Investor-backed", "Not sure yet"] as const;
export const DEAL_PREFERENCES = ["Freehold only", "Leasehold accepted", "Tenanted investments", "Vacant possession", "Development potential", "Refurb required", "Planning upside", "Auction lots"] as const;
export const DEAL_BLOCKERS = ["No tenant information", "Short lease", "POA/missing price", "Low confidence data", "Too much refurbishment", "Planning uncertainty", "Small lot size", "Large lot size", "None"] as const;
export const RISK_APPETITES = ["Conservative", "Balanced", "Opportunistic", "Distressed/high-risk"] as const;
export const ALERT_PREFERENCES = ["Daily", "Weekly", "Only Strong Opportunities", "Only Top Opportunities", "No alerts yet"] as const;
export const EXPERIENCE_LEVELS = ["Beginner", "Intermediate", "Experienced", "Professional/institutional"] as const;
export const BUDGET_RANGES = ["Up to GBP 250k", "GBP 250k - GBP 500k", "GBP 500k - GBP 1m", "GBP 1m - GBP 2.5m", "GBP 2.5m - GBP 5m", "GBP 5m+"] as const;

export type InvestorType = typeof INVESTOR_TYPES[number];
export type InvestmentStrategy = typeof INVESTMENT_STRATEGIES[number];
export type RiskAppetite = typeof RISK_APPETITES[number];
export type AlertPreference = typeof ALERT_PREFERENCES[number];
export type BudgetRange = typeof BUDGET_RANGES[number];
export type FinancingPosition = typeof FINANCING_POSITIONS[number];
export type ExperienceLevel = typeof EXPERIENCE_LEVELS[number];

export type InvestorOnboardingAnswers = {
  investorType: InvestorType | string;
  strategy: InvestmentStrategy | string;
  targetLocations: string[];
  budgetRange: BudgetRange | string;
  minBudget: number;
  maxBudget: number;
  cashAvailable: string;
  financingPosition: FinancingPosition | string;
  minYieldTarget: number;
  yieldNotImportant: boolean;
  capitalGrowthPriority: boolean;
  preferredAssetTypes: string[];
  dealPreferences: string[];
  dealBlockers: string[];
  riskAppetite: RiskAppetite | string;
  alertPreference: AlertPreference | string;
  experienceLevel: ExperienceLevel | string;
  completedAt?: string;
  skippedAt?: string;
};

export type InvestorPreferences = InvestorOnboardingAnswers & {
  onboardingCompleted: boolean;
};

export const DEFAULT_ONBOARDING: InvestorOnboardingAnswers = {
  investorType: "Private investor",
  strategy: "Passive income",
  targetLocations: [],
  budgetRange: "GBP 500k - GBP 1m",
  minBudget: 250000,
  maxBudget: 1000000,
  cashAvailable: "",
  financingPosition: "Commercial mortgage",
  minYieldTarget: 6,
  yieldNotImportant: false,
  capitalGrowthPriority: false,
  preferredAssetTypes: ["Retail", "Industrial"],
  dealPreferences: ["Tenanted investments"],
  dealBlockers: [],
  riskAppetite: "Balanced",
  alertPreference: "Daily",
  experienceLevel: "Intermediate",
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
    minBudget: numberValue(onboarding.minBudget, DEFAULT_ONBOARDING.minBudget),
    maxBudget: numberValue(onboarding.maxBudget, budgetMaxPrice(stringValue(onboarding.budgetRange, DEFAULT_ONBOARDING.budgetRange)) || DEFAULT_ONBOARDING.maxBudget),
    cashAvailable: stringValue(onboarding.cashAvailable, DEFAULT_ONBOARDING.cashAvailable),
    financingPosition: stringValue(onboarding.financingPosition, DEFAULT_ONBOARDING.financingPosition),
    minYieldTarget: numberValue(onboarding.minYieldTarget, DEFAULT_ONBOARDING.minYieldTarget),
    yieldNotImportant: booleanValue(onboarding.yieldNotImportant, DEFAULT_ONBOARDING.yieldNotImportant),
    capitalGrowthPriority: booleanValue(onboarding.capitalGrowthPriority, DEFAULT_ONBOARDING.capitalGrowthPriority),
    preferredAssetTypes: stringArray(onboarding.preferredAssetTypes, DEFAULT_ONBOARDING.preferredAssetTypes),
    dealPreferences: stringArray(onboarding.dealPreferences, DEFAULT_ONBOARDING.dealPreferences),
    dealBlockers: stringArray(onboarding.dealBlockers, DEFAULT_ONBOARDING.dealBlockers),
    riskAppetite: stringValue(onboarding.riskAppetite, DEFAULT_ONBOARDING.riskAppetite),
    alertPreference: stringValue(onboarding.alertPreference, DEFAULT_ONBOARDING.alertPreference),
    experienceLevel: stringValue(onboarding.experienceLevel, DEFAULT_ONBOARDING.experienceLevel),
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
    onboarding_skipped: mode === "skipped",
    investor_onboarding: {
      ...answers,
      targetLocations: cleanLocations(answers.targetLocations),
      preferredAssetTypes: answers.preferredAssetTypes.filter(Boolean),
      dealPreferences: answers.dealPreferences.filter(Boolean),
      dealBlockers: answers.dealBlockers.filter(Boolean),
      budgetRange: budgetRangeFromBounds(answers.minBudget, answers.maxBudget, answers.budgetRange),
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
  if (answers.riskAppetite === "Distressed/high-risk") {
    weights.risk = Math.min(weights.risk, 25);
    weights.discount = Math.max(weights.discount, 88);
    weights.growth = Math.max(weights.growth, 78);
  }
  if (answers.strategy === "Income/yield" || answers.strategy === "Passive income" || answers.strategy === "High-yield investments") weights.yield = Math.max(weights.yield, 90);
  if (answers.strategy === "Development" || answers.strategy === "Development opportunity") weights.growth = Math.max(weights.growth, 90);
  if (answers.strategy === "Capital growth" || answers.capitalGrowthPriority) weights.growth = Math.max(weights.growth, 84);
  if (answers.strategy === "Refurb/value-add") weights.discount = Math.max(weights.discount, 84);
  if (answers.strategy === "Owner-occupier purchase") {
    weights.demand = Math.max(weights.demand, 82);
    weights.yield = Math.min(weights.yield, 45);
  }
  if (answers.strategy === "Auction opportunities") weights.discount = Math.max(weights.discount, 90);
  if (answers.yieldNotImportant) weights.yield = Math.min(weights.yield, 35);
  if (answers.dealPreferences.includes("Development potential") || answers.dealPreferences.includes("Planning upside")) weights.growth = Math.max(weights.growth, 84);
  if (answers.dealPreferences.includes("Tenanted investments")) weights.risk = Math.max(weights.risk, 68);

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
    minYield: answers.yieldNotImportant ? 0 : answers.minYieldTarget,
    maxPrice: answers.maxBudget !== DEFAULT_ONBOARDING.maxBudget ? answers.maxBudget : budgetMaxPrice(answers.budgetRange),
    assetType,
    minScore: isOpportunityOnlyAlertPreference(answers.alertPreference) ? 72 : 60,
    enabled: true,
  };
}

export function alertPreferencesFromOnboarding(answers: InvestorOnboardingAnswers) {
  return {
    email: answers.alertPreference !== "No alerts yet",
    frequency: answers.alertPreference === "Weekly" ? "weekly" : "daily",
    min_score: isOpportunityOnlyAlertPreference(answers.alertPreference) ? 72 : 60,
  };
}

export function dashboardDefaultsFromPreferences(preferences: InvestorPreferences) {
  return {
    locationQuery: preferences.targetLocations[0] ?? "",
    assetType: preferences.preferredAssetTypes[0] ?? "All",
    minYield: preferences.yieldNotImportant ? 0 : preferences.minYieldTarget || 0,
  };
}

export function acquisitionBriefSummary(answers: InvestorOnboardingAnswers) {
  const locations = cleanLocations(answers.targetLocations);
  const budget = `${formatMoney(answers.minBudget)} - ${formatMoney(answers.maxBudget)}`;
  const returnTarget = answers.yieldNotImportant ? "Yield not prioritised" : `${answers.minYieldTarget}% minimum yield`;
  return [
    `${answers.investorType} focused on ${answers.strategy.toLowerCase()} opportunities.`,
    locations.length ? `Target locations: ${locations.join(", ")}.` : "Target locations: national coverage.",
    `Budget: ${budget}; finance: ${answers.financingPosition}.`,
    `${returnTarget}; risk appetite: ${answers.riskAppetite}; experience: ${answers.experienceLevel}.`,
    `Preferred assets: ${answers.preferredAssetTypes.length ? answers.preferredAssetTypes.join(", ") : "All assets"}.`,
    answers.dealPreferences.length ? `Deal preferences: ${answers.dealPreferences.join(", ")}.` : "Deal preferences: open to all acquisition types.",
    answers.dealBlockers.length ? `Deal blockers: ${answers.dealBlockers.join(", ")}.` : "Deal blockers: none specified.",
  ];
}

export function cleanLocations(locations: string[]) {
  return locations.map((location) => location.trim()).filter(Boolean);
}

export function parseLocations(value: string) {
  return cleanLocations(value.split(","));
}

function presetFromStrategy(strategy: string): PresetName {
  if (strategy === "Income/yield" || strategy === "Passive income" || strategy === "High-yield investments") return "Cashflow";
  if (strategy === "Value-add" || strategy === "Refurb/value-add") return "Value";
  if (strategy === "Development" || strategy === "Development opportunity" || strategy === "Capital growth") return "Growth";
  if (strategy === "Auction opportunities") return "Opportunistic";
  return "Balanced";
}

function budgetRangeFromBounds(minBudget: number, maxBudget: number, fallback: string) {
  if (!maxBudget) return fallback;
  if (maxBudget <= 250000) return "Up to GBP 250k";
  if (maxBudget <= 500000) return "GBP 250k - GBP 500k";
  if (maxBudget <= 1000000) return "GBP 500k - GBP 1m";
  if (maxBudget <= 2500000) return "GBP 1m - GBP 2.5m";
  if (maxBudget <= 5000000) return "GBP 2.5m - GBP 5m";
  return "GBP 5m+";
}

function formatMoney(value: number) {
  if (!value) return "Not set";
  if (value >= 1000000) return `GBP ${(value / 1000000).toLocaleString("en-GB", { maximumFractionDigits: 1 })}m`;
  return `GBP ${(value / 1000).toLocaleString("en-GB", { maximumFractionDigits: 0 })}k`;
}

function budgetMaxPrice(value: string) {
  if (value.includes("5m")) return 5000000;
  if (value.includes("2.5m")) return 2500000;
  if (value.includes("1m")) return 1000000;
  if (value.includes("500k")) return 500000;
  if (value.includes("250k")) return 250000;
  return 0;
}

function isOpportunityOnlyAlertPreference(value: string) {
  const legacyCandidatePreference = ["Only", "Green", "Candidates"].join(" ");
  return value === "Only Strong Opportunities" || value === legacyCandidatePreference || value === "Only Top Opportunities";
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

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}
