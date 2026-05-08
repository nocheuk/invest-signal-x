import type { Deal } from "@/lib/deals";
import { personalisedScore, type StrategyWeights } from "@/lib/strategy";

export const IMPORTED_SOURCE_FILTER = "Imported";
export const DEMO_SOURCE_FILTER = "Demo/Seed";
export const RIGHTMOVE_BOURNEMOUTH_SOURCE = "Rightmove Commercial Bournemouth";

export type DashboardFilters = {
  region: string;
  asset: string;
  source: string;
  rating: "all" | Deal["rating"];
  minYield: number;
  search: string;
  sort: "score" | "yield" | "price";
};

export function filterAndSortDeals(deals: Deal[], filters: DashboardFilters, weights: StrategyWeights) {
  const query = normalize(filters.search);
  let result = deals.filter((deal) => (
    (filters.region === "All UK" || deal.region === filters.region) &&
    (filters.asset === "All" || deal.assetType === filters.asset) &&
    sourceMatches(deal, filters.source) &&
    (filters.rating === "all" || deal.rating === filters.rating) &&
    (deal.netInitialYield >= filters.minYield) &&
    (!query || searchableText(deal).includes(query))
  ));

  if (filters.sort === "score") result = [...result].sort((a, b) => personalisedScore(b, weights) - personalisedScore(a, weights));
  if (filters.sort === "yield") result = [...result].sort((a, b) => b.netInitialYield - a.netInitialYield);
  if (filters.sort === "price") result = [...result].sort((a, b) => a.guidePrice - b.guidePrice);
  return result;
}

export function sourceMatches(deal: Deal, source: string) {
  if (source === "All") return true;
  if (source === IMPORTED_SOURCE_FILTER) return Boolean(deal.isImported || deal.importSourceName);
  if (source === DEMO_SOURCE_FILTER) return !deal.isImported && !deal.importSourceName;
  return sourceLabel(deal) === source;
}

export function sourceLabel(deal: Deal) {
  if (deal.importSourceName) return deal.importSourceName;
  if (deal.isImported) return IMPORTED_SOURCE_FILTER;
  return deal.source;
}

export function buildSourceOptions(deals: Deal[]) {
  const dynamic = deals.map(sourceLabel).filter(Boolean);
  return [...new Set([
    IMPORTED_SOURCE_FILTER,
    DEMO_SOURCE_FILTER,
    RIGHTMOVE_BOURNEMOUTH_SOURCE,
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
