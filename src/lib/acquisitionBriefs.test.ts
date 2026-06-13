import { describe, expect, it } from "vitest";
import type { Deal } from "@/lib/deals";
import { countBriefMatches, scoreDealAgainstBrief, type AcquisitionBrief } from "@/lib/acquisitionBriefs";

function deal(overrides: Partial<Deal> = {}): Deal {
  return {
    id: "deal-1",
    title: "Town centre retail investment with upper floors",
    location: "Bournemouth, Dorset",
    region: "South West",
    assetType: "Retail",
    source: "Private treaty",
    guidePrice: 500000,
    passingRent: 45000,
    sqft: 4200,
    grossYield: 9,
    netInitialYield: 8.5,
    reversionaryYield: 0,
    wault: 0,
    leaseLength: 0,
    tenant: "Known tenant",
    covenantStrength: "Moderate",
    tenantHealthScore: 50,
    rentSustainability: "Market rent",
    rentReview: "None",
    pricePerSqft: 119,
    planningUpsideScore: 50,
    voidRiskScore: 35,
    exitYieldSensitivity: "Moderate",
    cashflowAfterDebt: 0,
    returnOnEquity: 0,
    redFlags: [],
    mainRiskFlag: "",
    score: 75,
    rating: "amber",
    scoreBreakdown: { incomeQuality: 75, tenantSecurity: 60, marketPricing: 70, upside: 70, riskExit: 65 },
    insights: { mispricing: "", couldGoWrong: "", askAgent: "", negotiation: "" },
    thumbnail: "",
    postedAt: "2026-06-13T08:00:00Z",
    isImported: true,
    ...overrides,
  };
}

function brief(overrides: Partial<AcquisitionBrief> = {}): AcquisitionBrief {
  return {
    id: "brief-1",
    name: "South Coast retail",
    strategyMode: "general-investment",
    regions: ["Dorset"],
    budgetMin: 250000,
    budgetMax: 750000,
    assetTypes: ["Retail"],
    yieldMin: 7,
    floorAreaMin: 2000,
    floorAreaMax: 6000,
    keywordsPreferred: ["upper floors"],
    keywordsExcluded: ["industrial"],
    isActive: true,
    ...overrides,
  };
}

describe("acquisition brief matching", () => {
  it("scores matching opportunities without changing the deal score", () => {
    const source = deal({ score: 75 });
    const match = scoreDealAgainstBrief(source, brief());

    expect(match.score).toBeGreaterThanOrEqual(80);
    expect(match.matches).toBe(true);
    expect(match.whyMatches).toEqual(expect.arrayContaining(["Location matches target region", "Retail matches target asset type"]));
    expect(source.score).toBe(75);
  });

  it("explains why a deal does not fully match", () => {
    const match = scoreDealAgainstBrief(deal({ location: "Manchester", assetType: "Industrial", guidePrice: 1200000, grossYield: 4, netInitialYield: 4 }), brief());

    expect(match.matches).toBe(false);
    expect(match.whyNotFullyMatched).toEqual(expect.arrayContaining(["Outside target regions", "Industrial is not in target asset types", "Above maximum budget"]));
  });

  it("counts brief matches using the match threshold", () => {
    const activeBrief = brief();
    expect(countBriefMatches([
      deal({ id: "match" }),
      deal({ id: "miss", location: "Manchester", assetType: "Industrial", guidePrice: 1200000, grossYield: 4, netInitialYield: 4 }),
    ], activeBrief)).toBe(1);
  });
});
