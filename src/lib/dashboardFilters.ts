import type { Deal } from "@/lib/deals";
import { classifyDeal, type DealClassification } from "@/lib/dealClassification";
import { personalisedScore, type StrategyWeights } from "@/lib/strategy";
import { filterDealsForStrategyMode, type StrategyModeId } from "@/lib/strategyModes";

export const IMPORTED_SOURCE_FILTER = "Imported";
export const DEMO_SOURCE_FILTER = "Demo/Seed";
export const ALL_REAL_DEALS_FILTER = "All real deals";
export const REQUIRES_DUE_DILIGENCE_FILTER = "Requires Due Diligence";
export const ACUITUS_SOURCE = "Acuitus";
export const EDDISONS_SOURCE = "Eddisons";
export const ALLSOP_SOURCE = "Allsop";
export const RIGHTMOVE_COMMERCIAL_SOURCE = "Rightmove Commercial";
export const GOADSBY_SOURCE = "Goadsby Commercial";
export const ZOOPLA_SOURCE = "Zoopla Commercial";
export const SAVILLS_SOURCE = "Savills Commercial";
export const SDL_SOURCE = "SDL Property Auctions";
export const PUGH_SOURCE = "Pugh Auctions";
export const BOND_WOLFE_SOURCE = "Bond Wolfe";
export const FISHER_GERMAN_SOURCE = "Fisher German Commercial";
export const LSH_SOURCE = "Lambert Smith Hampton";

export const IMPORT_SOURCE_OPTIONS = [
  RIGHTMOVE_COMMERCIAL_SOURCE,
  ACUITUS_SOURCE,
  EDDISONS_SOURCE,
  ALLSOP_SOURCE,
  GOADSBY_SOURCE,
  ZOOPLA_SOURCE,
  SAVILLS_SOURCE,
  SDL_SOURCE,
  PUGH_SOURCE,
  BOND_WOLFE_SOURCE,
  FISHER_GERMAN_SOURCE,
  LSH_SOURCE,
] as const;

export type DashboardFilters = {
  region: string;
  asset: string;
  source: string;
  rating: "all" | Deal["rating"] | DealClassification;
  confidence: "all" | NonNullable<Deal["confidenceLevel"]>;
  minYield: number;
  maxPrice: number;
  search: string;
  locationQuery: string;
  sort: "score" | "yield" | "price" | "confidence" | "newest";
  strategyMode?: StrategyModeId;
};

export function filterAndSortDeals(deals: Deal[], filters: DashboardFilters, weights: StrategyWeights) {
  const query = normalize(filters.search);
  const locationQuery = normalize(filters.locationQuery);
  let result = deals.filter((deal) => (
    (filters.region === "All UK" || deal.region === filters.region) &&
    (filters.asset === "All" || deal.assetType === filters.asset) &&
    sourceMatches(deal, filters.source) &&
    ratingMatches(deal, filters.rating) &&
    (filters.confidence === "all" || deal.confidenceLevel === filters.confidence) &&
    (deal.netInitialYield >= filters.minYield) &&
    (!filters.maxPrice || deal.guidePrice <= filters.maxPrice) &&
    (!query || searchableText(deal).includes(query))
    && (!locationQuery || locationSearchableText(deal).includes(locationQuery))
  ));

  result = filterDealsForStrategyMode(result, filters.strategyMode ?? "general-investment");

  if (filters.sort === "score") result = [...result].sort((a, b) => personalisedScore(b, weights) - personalisedScore(a, weights));
  if (filters.sort === "yield") result = [...result].sort((a, b) => b.netInitialYield - a.netInitialYield);
  if (filters.sort === "price") result = [...result].sort((a, b) => a.guidePrice - b.guidePrice);
  if (filters.sort === "confidence") result = [...result].sort((a, b) => (b.dataConfidenceScore ?? 0) - (a.dataConfidenceScore ?? 0));
  if (filters.sort === "newest") result = [...result].sort((a, b) => dateValue(b.postedAt) - dateValue(a.postedAt));
  return result;
}

export function buildFilterDebugSteps(deals: Deal[], filters: DashboardFilters) {
  const query = normalize(filters.search);
  const locationQuery = normalize(filters.locationQuery);
  const steps: Array<{ label: string; count: number }> = [{ label: "before filters", count: deals.length }];
  let result = deals;

  result = result.filter((deal) => filters.region === "All UK" || deal.region === filters.region);
  steps.push({ label: "after region", count: result.length });
  result = result.filter((deal) => filters.asset === "All" || deal.assetType === filters.asset);
  steps.push({ label: "after asset", count: result.length });
  result = result.filter((deal) => sourceMatches(deal, filters.source));
  steps.push({ label: "after source", count: result.length });
  result = result.filter((deal) => ratingMatches(deal, filters.rating));
  steps.push({ label: "after classification", count: result.length });
  result = result.filter((deal) => filters.confidence === "all" || deal.confidenceLevel === filters.confidence);
  steps.push({ label: "after confidence", count: result.length });
  result = result.filter((deal) => deal.netInitialYield >= filters.minYield);
  steps.push({ label: "after min yield", count: result.length });
  result = result.filter((deal) => !filters.maxPrice || deal.guidePrice <= filters.maxPrice);
  steps.push({ label: "after max price", count: result.length });
  result = result.filter((deal) => !query || searchableText(deal).includes(query));
  steps.push({ label: "after search", count: result.length });
  result = result.filter((deal) => !locationQuery || locationSearchableText(deal).includes(locationQuery));
  steps.push({ label: "after location", count: result.length });
  result = filterDealsForStrategyMode(result, filters.strategyMode ?? "general-investment");
  steps.push({ label: "after strategy mode", count: result.length });

  return steps;
}

function ratingMatches(deal: Deal, rating: DashboardFilters["rating"]) {
  if (rating === "all") return true;
  if (rating === "green-candidate" || rating === "verified-green" || rating === "requires-due-diligence" || rating === "low-priority") return classifyDeal(deal) === rating;
  return deal.rating === rating;
}

export function locationSearchableText(deal: Deal) {
  return normalize([
    deal.location,
    extractPostcode(deal.location),
    deal.region,
    deal.title,
  ].filter(Boolean).join(" "));
}

export function sourceMatches(deal: Deal, source: string) {
  if (source === "All") return true;
  if (source === ALL_REAL_DEALS_FILTER) return !isSeedDeal(deal);
  if (source === IMPORTED_SOURCE_FILTER) return Boolean(deal.isImported || deal.importSourceName);
  if (source === REQUIRES_DUE_DILIGENCE_FILTER) return Boolean(deal.isImported || deal.importSourceName) && classifyDeal(deal) === "requires-due-diligence";
  if (source === DEMO_SOURCE_FILTER) return isSeedDeal(deal) || (!deal.isImported && !deal.importSourceName);
  return sourceLabel(deal) === source;
}

export function isSeedDeal(deal: Deal) {
  return Boolean(deal.isSeed || deal.id.startsWith("ds-"));
}

export function sourceLabel(deal: Deal) {
  if (deal.importSourceName) return normalizeSourceLabel(deal.importSourceName, deal.importSourceType);
  if (deal.isImported) return IMPORTED_SOURCE_FILTER;
  return deal.source;
}

export function buildSourceOptions(deals: Deal[]) {
  const dynamic = deals.map(sourceLabel).filter(Boolean);
  return [...new Set([
    ...IMPORT_SOURCE_OPTIONS,
    IMPORTED_SOURCE_FILTER,
    REQUIRES_DUE_DILIGENCE_FILTER,
    DEMO_SOURCE_FILTER,
    ...dynamic,
  ])];
}

export function searchableText(deal: Deal) {
  return normalize([
    deal.title,
    deal.location,
    extractPostcode(deal.location),
    deal.assetType,
    deal.tenant,
    sourceLabel(deal),
  ].filter(Boolean).join(" "));
}

export function extractPostcode(location: string) {
  const full = location.match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i);
  if (full) return full[0].toUpperCase().replace(/\s+/, " ");
  const outward = location.match(/\b[A-Z]{1,2}\d[A-Z\d]?\b/i);
  return outward ? outward[0].toUpperCase() : "";
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function dateValue(value: string) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function normalizeSourceLabel(name: string, sourceType?: string) {
  const value = `${name} ${sourceType ?? ""}`.toLowerCase();
  if (value.includes("rightmove")) return RIGHTMOVE_COMMERCIAL_SOURCE;
  if (value.includes("acuitus")) return ACUITUS_SOURCE;
  if (value.includes("eddisons")) return EDDISONS_SOURCE;
  if (value.includes("allsop")) return ALLSOP_SOURCE;
  if (value.includes("goadsby")) return GOADSBY_SOURCE;
  if (value.includes("zoopla")) return ZOOPLA_SOURCE;
  if (value.includes("savills")) return SAVILLS_SOURCE;
  if (value.includes("sdl")) return SDL_SOURCE;
  if (value.includes("pugh")) return PUGH_SOURCE;
  if (value.includes("bond wolfe") || value.includes("bondwolfe")) return BOND_WOLFE_SOURCE;
  if (value.includes("fisher german") || value.includes("fishergerman")) return FISHER_GERMAN_SOURCE;
  if (value.includes("lambert smith hampton") || value.includes("lsh")) return LSH_SOURCE;
  return name;
}
