import type { Deal } from "@/lib/deals";
import { classifyDeal, type DealClassification } from "@/lib/dealClassification";
import { personalisedScore, type StrategyWeights } from "@/lib/strategy";

export const IMPORTED_SOURCE_FILTER = "Imported";
export const DEMO_SOURCE_FILTER = "Demo/Seed";
export const ALL_REAL_DEALS_FILTER = "All real deals";
export const NEEDS_REVIEW_FILTER = "Needs review";
export const ACUITUS_SOURCE = "Acuitus";
export const EDDISONS_SOURCE = "Eddisons";
export const RIGHTMOVE_COMMERCIAL_SOURCE = "Rightmove Commercial";

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
  sort: "score" | "yield" | "price" | "confidence";
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

  if (filters.sort === "score") result = [...result].sort((a, b) => personalisedScore(b, weights) - personalisedScore(a, weights));
  if (filters.sort === "yield") result = [...result].sort((a, b) => b.netInitialYield - a.netInitialYield);
  if (filters.sort === "price") result = [...result].sort((a, b) => a.guidePrice - b.guidePrice);
  if (filters.sort === "confidence") result = [...result].sort((a, b) => (b.dataConfidenceScore ?? 0) - (a.dataConfidenceScore ?? 0));
  return result;
}

function ratingMatches(deal: Deal, rating: DashboardFilters["rating"]) {
  if (rating === "all") return true;
  if (rating === "green-candidate") return classifyDeal(deal) === "green-candidate";
  if (rating === "verified-green") return classifyDeal(deal) === "verified-green";
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
  if (source === NEEDS_REVIEW_FILTER) return Boolean(deal.needsReview);
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
    RIGHTMOVE_COMMERCIAL_SOURCE,
    ACUITUS_SOURCE,
    EDDISONS_SOURCE,
    IMPORTED_SOURCE_FILTER,
    NEEDS_REVIEW_FILTER,
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

function normalizeSourceLabel(name: string, sourceType?: string) {
  const value = `${name} ${sourceType ?? ""}`.toLowerCase();
  if (value.includes("rightmove")) return RIGHTMOVE_COMMERCIAL_SOURCE;
  if (value.includes("acuitus")) return ACUITUS_SOURCE;
  if (value.includes("eddisons")) return EDDISONS_SOURCE;
  return name;
}
