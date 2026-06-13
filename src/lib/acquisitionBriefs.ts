import type { AssetType, Deal } from "@/lib/deals";
import type { StrategyModeId } from "@/lib/strategyModes";

export type AcquisitionBrief = {
  id: string;
  name: string;
  strategyMode: StrategyModeId;
  regions: string[];
  budgetMin: number;
  budgetMax: number;
  assetTypes: AssetType[];
  yieldMin: number;
  floorAreaMin: number;
  floorAreaMax: number;
  keywordsPreferred: string[];
  keywordsExcluded: string[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type AcquisitionBriefInput = Omit<AcquisitionBrief, "id" | "createdAt" | "updatedAt"> & { id?: string };

export type BriefMatch = {
  score: number;
  matches: boolean;
  whyMatches: string[];
  whyNotFullyMatched: string[];
};

export const BRIEF_MATCH_THRESHOLD = 60;

export const EMPTY_BRIEF_INPUT: AcquisitionBriefInput = {
  name: "My acquisition brief",
  strategyMode: "general-investment",
  regions: [],
  budgetMin: 0,
  budgetMax: 0,
  assetTypes: [],
  yieldMin: 0,
  floorAreaMin: 0,
  floorAreaMax: 0,
  keywordsPreferred: [],
  keywordsExcluded: [],
  isActive: true,
};

export function scoreDealAgainstBrief(deal: Deal, brief: AcquisitionBrief | null | undefined): BriefMatch {
  if (!brief) {
    return {
      score: 0,
      matches: false,
      whyMatches: [],
      whyNotFullyMatched: ["No active acquisition brief selected"],
    };
  }

  let score = 0;
  const possible = 100;
  const whyMatches: string[] = [];
  const whyNotFullyMatched: string[] = [];
  const text = dealText(deal);

  if (brief.strategyMode && brief.strategyMode !== "general-investment") {
    score += 8;
    whyMatches.push(`Uses ${brief.strategyMode.replace(/-/g, " ")} strategy mode`);
  } else {
    score += 8;
  }

  if (brief.regions.length === 0) {
    score += 12;
  } else if (brief.regions.some((region) => containsText([deal.region, deal.location], region))) {
    score += 12;
    whyMatches.push("Location matches target region");
  } else {
    whyNotFullyMatched.push("Outside target regions");
  }

  if (brief.assetTypes.length === 0) {
    score += 14;
  } else if (brief.assetTypes.includes(deal.assetType)) {
    score += 14;
    whyMatches.push(`${deal.assetType} matches target asset type`);
  } else {
    whyNotFullyMatched.push(`${deal.assetType} is not in target asset types`);
  }

  const price = deal.guidePrice;
  if (brief.budgetMin > 0 || brief.budgetMax > 0) {
    if (price <= 0) {
      whyNotFullyMatched.push("Guide price missing");
    } else if (brief.budgetMin > 0 && price < brief.budgetMin) {
      whyNotFullyMatched.push("Below target budget range");
    } else if (brief.budgetMax > 0 && price > brief.budgetMax) {
      whyNotFullyMatched.push("Above maximum budget");
    } else {
      score += 18;
      whyMatches.push("Guide price is within budget");
    }
  } else {
    score += 18;
  }

  const yieldValue = deal.netInitialYield || deal.grossYield;
  if (brief.yieldMin > 0) {
    if (yieldValue >= brief.yieldMin) {
      score += 16;
      whyMatches.push(`Yield meets ${brief.yieldMin}% target`);
    } else if (yieldValue > 0) {
      score += 6;
      whyNotFullyMatched.push(`Yield below ${brief.yieldMin}% target`);
    } else {
      whyNotFullyMatched.push("Yield unavailable");
    }
  } else {
    score += 16;
  }

  if (brief.floorAreaMin > 0 || brief.floorAreaMax > 0) {
    if (deal.sqft <= 0) {
      whyNotFullyMatched.push("Floor area missing");
    } else if (brief.floorAreaMin > 0 && deal.sqft < brief.floorAreaMin) {
      whyNotFullyMatched.push("Below minimum floor area");
    } else if (brief.floorAreaMax > 0 && deal.sqft > brief.floorAreaMax) {
      whyNotFullyMatched.push("Above maximum floor area");
    } else {
      score += 12;
      whyMatches.push("Floor area fits the brief");
    }
  } else {
    score += 12;
  }

  const preferredMatches = brief.keywordsPreferred.filter((keyword) => text.includes(keyword.toLowerCase()));
  if (brief.keywordsPreferred.length === 0) {
    score += 12;
  } else if (preferredMatches.length > 0) {
    score += Math.min(12, 6 + preferredMatches.length * 3);
    whyMatches.push(`Preferred keyword matched: ${preferredMatches.slice(0, 3).join(", ")}`);
  } else {
    whyNotFullyMatched.push("No preferred keywords found");
  }

  const excludedMatches = brief.keywordsExcluded.filter((keyword) => text.includes(keyword.toLowerCase()));
  if (excludedMatches.length > 0) {
    score = Math.max(0, score - 30);
    whyNotFullyMatched.push(`Excluded keyword present: ${excludedMatches.slice(0, 3).join(", ")}`);
  } else {
    score += 8;
  }

  const finalScore = Math.max(0, Math.min(possible, Math.round(score)));
  return {
    score: finalScore,
    matches: finalScore >= BRIEF_MATCH_THRESHOLD,
    whyMatches: whyMatches.slice(0, 4),
    whyNotFullyMatched: whyNotFullyMatched.slice(0, 4),
  };
}

export function countBriefMatches(deals: Deal[], brief: AcquisitionBrief | null | undefined) {
  if (!brief) return 0;
  return deals.filter((deal) => scoreDealAgainstBrief(deal, brief).matches).length;
}

export function parseList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export function normalizeBriefInput(input: AcquisitionBriefInput): AcquisitionBriefInput {
  return {
    ...EMPTY_BRIEF_INPUT,
    ...input,
    name: input.name.trim() || "Untitled brief",
    regions: unique(input.regions.map((item) => item.trim()).filter(Boolean)),
    assetTypes: unique(input.assetTypes),
    keywordsPreferred: unique(input.keywordsPreferred.map((item) => item.trim().toLowerCase()).filter(Boolean)),
    keywordsExcluded: unique(input.keywordsExcluded.map((item) => item.trim().toLowerCase()).filter(Boolean)),
    budgetMin: cleanNumber(input.budgetMin),
    budgetMax: cleanNumber(input.budgetMax),
    yieldMin: cleanNumber(input.yieldMin),
    floorAreaMin: cleanNumber(input.floorAreaMin),
    floorAreaMax: cleanNumber(input.floorAreaMax),
  };
}

function dealText(deal: Deal) {
  return [
    deal.title,
    deal.location,
    deal.region,
    deal.assetType,
    deal.tenant,
    deal.mainRiskFlag,
    ...(deal.redFlags ?? []),
    deal.analysis?.investmentSummary,
    deal.enrichment?.investmentSummary,
    deal.enrichment?.extractedPayload ? JSON.stringify(deal.enrichment.extractedPayload) : "",
  ].filter(Boolean).join(" ").toLowerCase();
}

function containsText(values: string[], query: string) {
  const needle = query.toLowerCase();
  return values.some((value) => value.toLowerCase().includes(needle) || needle.includes(value.toLowerCase()));
}

function cleanNumber(value: number | string | null | undefined) {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? next : 0;
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}
