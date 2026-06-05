import type { Deal } from "@/lib/deals";

export type AreaGroup = "city" | "postcodeArea" | "region";

export type AreaStats = {
  group: AreaGroup;
  area: string;
  dealCount: number;
  averageYield: number | null;
  medianYield: number | null;
  averagePricePerSqft: number | null;
  medianPricePerSqft: number | null;
};

export type AreaIntelligence = {
  stats: AreaStats | null;
  yieldDelta: number | null;
  pricePerSqftDelta: number | null;
  insights: string[];
};

export function buildAreaStats(deals: Deal[], { excludeDealId }: { excludeDealId?: string } = {}) {
  const imported = deals.filter((deal) => isImportedDeal(deal) && deal.id !== excludeDealId);
  return {
    city: groupStats(imported, cityKey),
    postcodeArea: groupStats(imported, postcodeAreaKey),
    region: groupStats(imported, regionKey),
  };
}

export function getAreaIntelligence(deal: Deal, deals: Deal[]): AreaIntelligence {
  const statsByGroup = buildAreaStats(deals, { excludeDealId: deal.id });
  const city = cityKey(deal);
  const postcodeArea = postcodeAreaKey(deal);
  const region = regionKey(deal);
  const stats =
    (city ? statsByGroup.city.get(city) : undefined) ??
    (postcodeArea ? statsByGroup.postcodeArea.get(postcodeArea) : undefined) ??
    (region ? statsByGroup.region.get(region) : undefined) ??
    null;

  const yieldDelta = delta(deal.netInitialYield, stats?.averageYield);
  const pricePerSqft = deal.pricePerSqft || calculatedPricePerSqft(deal);
  const pricePerSqftDelta = delta(pricePerSqft, stats?.averagePricePerSqft);
  return {
    stats,
    yieldDelta,
    pricePerSqftDelta,
    insights: areaInsights({ stats, yieldDelta, pricePerSqftDelta, hasYield: deal.netInitialYield > 0, hasPricePerSqft: pricePerSqft > 0 }),
  };
}

export function formatAreaDelta(value: number | null, unit: "yield" | "price") {
  if (value === null) return "No local benchmark";
  const sign = value > 0 ? "+" : "";
  return unit === "yield" ? `${sign}${value.toFixed(1)} pts vs local avg` : `${value < 0 ? "-" : sign}£${Math.abs(Math.round(value))}/sqft vs local avg`;
}

export function formatAreaValue(value: number | null, unit: "yield" | "price") {
  if (value === null) return "Not available";
  return unit === "yield" ? `${value.toFixed(1)}%` : `£${Math.round(value)}`;
}

function groupStats(deals: Deal[], keyFn: (deal: Deal) => string) {
  const groups = new Map<string, Deal[]>();
  for (const deal of deals) {
    const key = keyFn(deal);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), deal]);
  }
  return new Map([...groups.entries()].map(([area, groupDeals]) => [area, statsForGroup(area, groupDeals, keyFn === cityKey ? "city" : keyFn === postcodeAreaKey ? "postcodeArea" : "region")]));
}

function statsForGroup(area: string, deals: Deal[], group: AreaGroup): AreaStats {
  const yields = deals.map((deal) => deal.netInitialYield).filter((value) => value > 0);
  const prices = deals.map((deal) => deal.pricePerSqft || calculatedPricePerSqft(deal)).filter((value) => value > 0);
  return {
    group,
    area,
    dealCount: deals.length,
    averageYield: average(yields),
    medianYield: median(yields),
    averagePricePerSqft: average(prices),
    medianPricePerSqft: median(prices),
  };
}

function areaInsights({
  stats,
  yieldDelta,
  pricePerSqftDelta,
  hasYield,
  hasPricePerSqft,
}: {
  stats: AreaStats | null;
  yieldDelta: number | null;
  pricePerSqftDelta: number | null;
  hasYield: boolean;
  hasPricePerSqft: boolean;
}) {
  const insights: string[] = [];
  if (!stats || stats.dealCount < 3) insights.push("Limited area data");
  if (!hasYield) insights.push("Yield unavailable for local comparison");
  else if (yieldDelta !== null && yieldDelta >= 1) insights.push("Above average yield");
  else if (yieldDelta !== null && yieldDelta <= -1) insights.push("Below average yield");

  if (!hasPricePerSqft) insights.push("£/sqft unavailable for local comparison");
  else if (pricePerSqftDelta !== null && pricePerSqftDelta <= -25) insights.push("Below average £/sqft");
  else if (pricePerSqftDelta !== null && pricePerSqftDelta >= 25) insights.push("Premium pricing");

  return [...new Set(insights)];
}

function cityKey(deal: Deal) {
  return normalizeArea(deal.location.split(",")[0]);
}

function postcodeAreaKey(deal: Deal) {
  const postcode = deal.location.match(/\b[A-Z]{1,2}\d[A-Z\d]?\b/i)?.[0] ?? "";
  return postcode.toUpperCase();
}

function regionKey(deal: Deal) {
  return normalizeArea(deal.region);
}

function normalizeArea(value: string | undefined) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function isImportedDeal(deal: Deal) {
  return Boolean(deal.isImported || deal.importSourceName);
}

function calculatedPricePerSqft(deal: Deal) {
  return deal.guidePrice > 0 && deal.sqft > 0 ? deal.guidePrice / deal.sqft : 0;
}

function delta(value: number, benchmark: number | null | undefined) {
  if (!value || !benchmark) return null;
  return value - benchmark;
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
