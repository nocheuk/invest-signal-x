import type { Deal } from "@/lib/deals";
import { classifyDeal, classificationLabel } from "@/lib/dealClassification";
import { getAreaIntelligence, type AreaIntelligence } from "@/lib/areaIntelligence";
import { isNewThisWeek } from "@/lib/freshness";

export type ShortlistMode = "balanced" | "top-yield" | "most-undervalued" | "highest-confidence";

export type RankedOpportunity = {
  deal: Deal;
  rank: number;
  shortlistScore: number;
  reasons: string[];
  areaIntelligence: AreaIntelligence;
};

export function buildInvestorShortlist(
  deals: Deal[],
  {
    allDeals = deals,
    mode = "balanced",
    limit = 25,
    onlyThisWeek = false,
    now = new Date(),
  }: {
    allDeals?: Deal[];
    mode?: ShortlistMode;
    limit?: number;
    onlyThisWeek?: boolean;
    now?: Date;
  } = {}
) {
  return deals
    .filter((deal) => isImportedDeal(deal) && (!onlyThisWeek || isNewThisWeek(deal, now)))
    .map((deal) => rankDeal(deal, allDeals, mode))
    .sort((a, b) => b.shortlistScore - a.shortlistScore || b.deal.score - a.deal.score)
    .slice(0, limit)
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

export function top10ThisWeek(deals: Deal[], allDeals = deals, now = new Date(), mode: ShortlistMode = "balanced") {
  return buildInvestorShortlist(deals, { allDeals, now, mode, limit: 10, onlyThisWeek: true });
}

export function top25Opportunities(deals: Deal[], allDeals = deals, mode: ShortlistMode = "balanced") {
  return buildInvestorShortlist(deals, { allDeals, mode, limit: 25 });
}

function rankDeal(deal: Deal, allDeals: Deal[], mode: ShortlistMode): RankedOpportunity {
  const areaIntelligence = getAreaIntelligence(deal, allDeals);
  const classification = classifyDeal(deal);
  const confidence = deal.dataConfidenceScore ?? 50;
  const yieldScore = clamp((deal.netInitialYield || deal.grossYield || 0) * 8);
  const undervaluationScore = areaIntelligence.pricePerSqftDelta !== null
    ? clamp(50 + Math.abs(Math.min(areaIntelligence.pricePerSqftDelta, 0)) / 2)
    : 35;
  const areaYieldScore = areaIntelligence.yieldDelta !== null ? clamp(50 + areaIntelligence.yieldDelta * 10) : 35;
  const candidateBonus = classification === "verified-green" ? 12 : classification === "green-candidate" ? 9 : classification === "amber" ? 3 : 0;
  const weights = weightsForMode(mode);
  const shortlistScore = Math.round(
    deal.score * weights.score +
      yieldScore * weights.yield +
      undervaluationScore * weights.undervaluation +
      areaYieldScore * weights.area +
      confidence * weights.confidence +
      candidateBonus
  );

  return {
    deal,
    rank: 0,
    shortlistScore: clamp(shortlistScore),
    reasons: shortlistReasons(deal, areaIntelligence, classification, mode),
    areaIntelligence,
  };
}

function weightsForMode(mode: ShortlistMode) {
  if (mode === "top-yield") return { score: 0.25, yield: 0.4, undervaluation: 0.1, area: 0.1, confidence: 0.15 };
  if (mode === "most-undervalued") return { score: 0.25, yield: 0.15, undervaluation: 0.35, area: 0.15, confidence: 0.1 };
  if (mode === "highest-confidence") return { score: 0.15, yield: 0.08, undervaluation: 0.05, area: 0.07, confidence: 0.65 };
  return { score: 0.35, yield: 0.2, undervaluation: 0.15, area: 0.15, confidence: 0.15 };
}

function shortlistReasons(deal: Deal, areaIntelligence: AreaIntelligence, classification: ReturnType<typeof classifyDeal>, mode: ShortlistMode) {
  const reasons = [`${classificationLabel(classification)} classification`];
  if (deal.score > 0) reasons.push(`DealSignal score ${deal.score}`);
  if ((deal.dataConfidenceScore ?? 0) >= 75) reasons.push(`Confidence ${deal.dataConfidenceScore}`);
  if (deal.netInitialYield > 0) reasons.push(`NIY ${deal.netInitialYield.toFixed(2)}%`);
  else if (deal.grossYield > 0) reasons.push(`Gross yield ${deal.grossYield.toFixed(2)}%`);
  if (areaIntelligence.yieldDelta !== null && areaIntelligence.yieldDelta >= 1) reasons.push(`Yield ${areaIntelligence.yieldDelta.toFixed(1)} pts above local average`);
  if (areaIntelligence.pricePerSqftDelta !== null && areaIntelligence.pricePerSqftDelta <= -25) reasons.push(`£/sqft £${Math.abs(Math.round(areaIntelligence.pricePerSqftDelta))} below local average`);
  if (mode === "top-yield") reasons.push("Ranked by yield emphasis");
  if (mode === "most-undervalued") reasons.push("Ranked by local value signal");
  if (mode === "highest-confidence") reasons.push("Ranked by confidence emphasis");
  return [...new Set(reasons)].slice(0, 4);
}

function isImportedDeal(deal: Deal) {
  return Boolean(deal.isImported || deal.importSourceName);
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
