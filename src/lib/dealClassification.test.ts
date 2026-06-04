import type { Deal } from "@/lib/deals";
import { classifyDeal, countDealClassifications, greenCandidateReasons, isGreenCandidate } from "@/lib/dealClassification";

function deal(overrides: Partial<Deal> = {}): Deal {
  return {
    id: "imp-candidate",
    title: "Candidate deal",
    location: "Bournemouth, BH1",
    region: "South West",
    assetType: "Retail",
    source: "Private treaty",
    guidePrice: 700000,
    passingRent: 62100,
    sqft: 3689,
    grossYield: 8.87,
    netInitialYield: 8.25,
    reversionaryYield: 8.25,
    wault: 0,
    leaseLength: 0,
    tenant: "Unknown",
    covenantStrength: "Moderate",
    tenantHealthScore: 0,
    rentSustainability: "Market rent",
    rentReview: "None",
    pricePerSqft: 190,
    planningUpsideScore: 35,
    voidRiskScore: 40,
    exitYieldSensitivity: "Moderate",
    cashflowAfterDebt: 0,
    returnOnEquity: 0,
    redFlags: [],
    mainRiskFlag: "Needs review",
    score: 73,
    rating: "amber",
    dataConfidenceScore: 85,
    confidenceLevel: "high",
    scoreBreakdown: { incomeQuality: 80, tenantSecurity: 65, marketPricing: 70, upside: 35, riskExit: 80 },
    insights: { mispricing: "", couldGoWrong: "", askAgent: "", negotiation: "" },
    thumbnail: "",
    postedAt: "2026-05-20T00:00:00Z",
    isImported: true,
    importSourceName: "Rightmove Commercial",
    ...overrides,
  };
}

describe("deal classification", () => {
  it("keeps verified green strict", () => {
    expect(classifyDeal(deal({ score: 78, dataConfidenceScore: 80, rating: "green" }))).toBe("verified-green");
    expect(classifyDeal(deal({ score: 78, dataConfidenceScore: 79, rating: "green" }))).toBe("green-candidate");
  });

  it("classifies high-potential imported deals as green candidates", () => {
    const candidate = deal({ score: 72, dataConfidenceScore: 75, guidePrice: 500000, passingRent: 0, netInitialYield: 8 });

    expect(isGreenCandidate(candidate)).toBe(true);
    expect(classifyDeal(candidate)).toBe("green-candidate");
    expect(greenCandidateReasons(candidate)).toContain("Guide price is available");
  });

  it("requires price and yield or rent for green candidates", () => {
    expect(classifyDeal(deal({ guidePrice: 0 }))).toBe("amber");
    expect(classifyDeal(deal({ passingRent: 0, netInitialYield: 0, grossYield: 0 }))).toBe("amber");
  });

  it("counts classifications", () => {
    expect(countDealClassifications([
      deal({ score: 82, dataConfidenceScore: 90, rating: "green" }),
      deal({ score: 73, dataConfidenceScore: 85, rating: "amber" }),
      deal({ score: 65, dataConfidenceScore: 85, rating: "amber" }),
      deal({ score: 42, dataConfidenceScore: 61, rating: "red" }),
    ])).toEqual({
      "verified-green": 1,
      "green-candidate": 1,
      amber: 1,
      red: 1,
    });
  });
});
