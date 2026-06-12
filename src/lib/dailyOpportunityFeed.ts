import type { Deal } from "@/lib/deals";
import { classificationLabel, classifyDeal } from "@/lib/dealClassification";
import { buildComparableEvidence } from "@/lib/comparableEvidence";
import { sourceLabel } from "@/lib/dashboardFilters";
import { isNewThisWeek, isNewToday } from "@/lib/freshness";
import { buildInvestmentThesis } from "@/lib/investmentThesis";
import { buildInvestorShortlist, type RankedOpportunity } from "@/lib/investorShortlist";

export type NationalRanking = {
  deal: Deal;
  rank: number;
  total: number;
  percentile: number;
  topPercent: number;
  rankingScore: number;
  verdict: string;
  whyMadeList: string[];
};

export type DailyOpportunityFeed = {
  rankings: NationalRanking[];
  top5Today: NationalRanking[];
  top10ThisWeek: NationalRanking[];
  strongOpportunities: NationalRanking[];
  newHighRankingOpportunities: NationalRanking[];
};

export function buildDailyOpportunityFeed(deals: Deal[], allDeals = deals, now = new Date()): DailyOpportunityFeed {
  const rankings = buildNationalOpportunityRankings(deals, allDeals);
  const feedRankings = rankings.filter((item) => classifyDeal(item.deal) !== "low-priority");
  return {
    rankings,
    top5Today: feedRankings.filter((item) => isNewToday(item.deal, now)).slice(0, 5),
    top10ThisWeek: feedRankings.filter((item) => isNewThisWeek(item.deal, now)).slice(0, 10),
    strongOpportunities: feedRankings.filter((item) => {
      const classification = classifyDeal(item.deal);
      return classification === "verified-green" || classification === "green-candidate";
    }).slice(0, 10),
    newHighRankingOpportunities: feedRankings.filter((item) => (
      isNewThisWeek(item.deal, now) &&
      (item.topPercent <= 20 || item.deal.score >= 72 || classifyDeal(item.deal) === "green-candidate")
    )).slice(0, 10),
  };
}

export function buildNationalOpportunityRankings(deals: Deal[], allDeals = deals): NationalRanking[] {
  const ranked = buildInvestorShortlist(deals, { allDeals, mode: "balanced", limit: Math.max(deals.length, 25) });
  const rankedById = new Map(ranked.map((item) => [item.deal.id, item]));
  const importedDeals = deals.filter(isImportedDeal);
  const sortable = importedDeals.map((deal) => rankedById.get(deal.id) ?? fallbackRankedOpportunity(deal));

  const sorted = sortable
    .sort((a, b) => b.shortlistScore - a.shortlistScore || b.deal.score - a.deal.score || (b.deal.dataConfidenceScore ?? 0) - (a.deal.dataConfidenceScore ?? 0));

  const total = sorted.length;
  return sorted.map((item, index) => {
    const rank = index + 1;
    const percentile = percentileForRank(rank, total);
    const topPercent = topPercentForRank(rank, total);
    const evidence = buildComparableEvidence(item.deal, allDeals);
    const thesis = buildInvestmentThesis(item.deal, { comparableEvidence: evidence });
    return {
      deal: item.deal,
      rank,
      total,
      percentile,
      topPercent,
      rankingScore: item.shortlistScore,
      verdict: thesis.investorVerdict,
      whyMadeList: whyMadeList(item.deal, item.reasons, thesis.whyInteresting, evidence.shortEvidenceLine),
    };
  });
}

export function getNationalRankingForDeal(deal: Deal, deals: Deal[]): NationalRanking | null {
  return buildNationalOpportunityRankings(deals, deals).find((item) => item.deal.id === deal.id) ?? null;
}

export function percentileForRank(rank: number, total: number) {
  if (total <= 0 || rank <= 0) return 0;
  return Math.max(1, Math.min(100, Math.round(((total - rank + 1) / total) * 100)));
}

export function topPercentForRank(rank: number, total: number) {
  if (total <= 0 || rank <= 0) return 0;
  return Math.max(1, Math.min(100, Math.ceil((rank / total) * 100)));
}

function fallbackRankedOpportunity(deal: Deal): RankedOpportunity {
  const classification = classifyDeal(deal);
  const confidence = deal.dataConfidenceScore ?? 0;
  const yieldValue = deal.netInitialYield || deal.grossYield || 0;
  const classificationBonus = classification === "verified-green" ? 12 : classification === "green-candidate" ? 9 : classification === "requires-due-diligence" ? 2 : -8;
  const shortlistScore = clamp(Math.round(deal.score * 0.55 + confidence * 0.25 + Math.min(yieldValue * 4, 20) + classificationBonus));
  return {
    deal,
    rank: 0,
    shortlistScore,
    reasons: [`${classificationLabel(classification)} classification`, `DealSignal score ${deal.score}`, sourceLabel(deal)],
    areaIntelligence: {
      stats: null,
      yieldDelta: null,
      pricePerSqftDelta: null,
      insights: ["Comparable evidence limited"],
    },
  };
}

function whyMadeList(deal: Deal, rankedReasons: string[], thesisReasons: string[], evidenceLine: string) {
  const reasons: string[] = [];
  const yieldValue = deal.netInitialYield || deal.grossYield;
  if (/yield/i.test(evidenceLine) && !/limited/i.test(evidenceLine)) reasons.push(evidenceLine);
  if (yieldValue >= 8) reasons.push("Yield above benchmark");
  if (deal.pricePerSqft > 0 && /below/i.test(evidenceLine)) reasons.push("Below-market GBP/sqft");
  if (deal.tenant && deal.tenant !== "Unknown" && deal.tenant !== "Vacant") reasons.push("Strong tenant signal");
  if (deal.leaseLength >= 5 || deal.wault >= 5) reasons.push("Long lease income visibility");
  if (deal.rentReview !== "None" || hasRentReviews(deal)) reasons.push("Rent reviews recorded");
  rankedReasons.forEach((reason) => {
    if (/strategy|classification|confidence|verdict/i.test(reason)) reasons.push(reason);
  });
  thesisReasons.forEach((reason) => {
    if (/strategy|tenant|lease|rent review|confidence|guide price/i.test(reason)) reasons.push(reason);
  });
  return uniqueStrings(reasons).slice(0, 5);
}

function hasRentReviews(deal: Deal) {
  return Array.isArray(deal.enrichment?.extractedPayload?.rentReviews) && deal.enrichment.extractedPayload.rentReviews.length > 0;
}

function isImportedDeal(deal: Deal) {
  return Boolean(deal.isImported || deal.importSourceName);
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function uniqueStrings(items: string[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const normalized = item.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}
