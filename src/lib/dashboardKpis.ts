import type { Deal } from "@/lib/deals";
import { countDealClassifications } from "@/lib/dealClassification";

export type DashboardKpiMetrics = {
  totalDatabaseDeals: number;
  filteredDeals: number;
  importedDeals: number;
  withGuidePrice: number;
  verifiedGreens: number;
  greenCandidates: number;
  amber: number;
  red: number;
  averageYield: number;
  yieldSampleSize: number;
  topScore: number;
  watchlistedDeals: number;
  activeWatchlistDeals: number;
};

export function buildDashboardKpis({
  allDeals,
  filteredDeals,
  watchlistIds,
  pipelineCounts,
  totalDatabaseDeals,
}: {
  allDeals: Deal[];
  filteredDeals: Deal[];
  watchlistIds: string[];
  pipelineCounts: Record<string, number>;
  totalDatabaseDeals?: number;
}): DashboardKpiMetrics {
  const classifications = countDealClassifications(filteredDeals);
  const yieldSamples = filteredDeals
    .map((deal) => deal.netInitialYield)
    .filter((value) => Number.isFinite(value) && value > 0);
  const averageYield = yieldSamples.length
    ? yieldSamples.reduce((sum, value) => sum + value, 0) / yieldSamples.length
    : 0;
  const topDeal = [...filteredDeals].sort((a, b) => b.score - a.score)[0];

  return {
    totalDatabaseDeals: totalDatabaseDeals ?? allDeals.length,
    filteredDeals: filteredDeals.length,
    importedDeals: allDeals.filter(isImportedDeal).length,
    withGuidePrice: filteredDeals.filter((deal) => Number.isFinite(deal.guidePrice) && deal.guidePrice > 0).length,
    verifiedGreens: classifications["verified-green"],
    greenCandidates: classifications["green-candidate"],
    amber: classifications.amber,
    red: classifications.red,
    averageYield,
    yieldSampleSize: yieldSamples.length,
    topScore: topDeal?.score ?? 0,
    watchlistedDeals: watchlistIds.length,
    activeWatchlistDeals:
      (pipelineCounts.Reviewing ?? 0) +
      (pipelineCounts["Viewing Booked"] ?? 0) +
      (pipelineCounts["Offer Submitted"] ?? 0),
  };
}

function isImportedDeal(deal: Deal) {
  return Boolean(deal.isImported || deal.importSourceName);
}
