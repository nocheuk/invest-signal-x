import type { Deal } from "@/lib/deals";
import { classificationLabel, classifyDeal, countDealClassifications, greenCandidateReasons, isGreenCandidate, isLowPriority } from "@/lib/dealClassification";

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
    expect(classifyDeal(deal({ guidePrice: 0 }))).toBe("low-priority");
    expect(classifyDeal(deal({ passingRent: 0, netInitialYield: 0, grossYield: 0 }))).toBe("low-priority");
  });

  it("does not make normal missing comparable evidence low priority", () => {
    const diligence = deal({
      score: 68,
      dataConfidenceScore: 85,
      passingRent: 62100,
      netInitialYield: 8.25,
      sourceUrl: "https://example.com/listing",
      scoreReasons: {
        positiveDrivers: [],
        negativeDrivers: [],
        missingDataWarnings: ["No comparable evidence yet"],
        verifyBeforeTrusting: [],
      },
    });

    expect(isLowPriority(diligence)).toBe(false);
    expect(classifyDeal(diligence)).toBe("requires-due-diligence");
    expect(classificationLabel("requires-due-diligence")).toBe("Requires Due Diligence");
  });

  it("classifies severe sparse listings as low priority", () => {
    const sparse = deal({
      score: 39,
      dataConfidenceScore: 38,
      confidenceLevel: "low",
      guidePrice: 0,
      passingRent: 0,
      netInitialYield: 0,
      grossYield: 0,
      sourceUrl: undefined,
    });

    expect(isLowPriority(sparse)).toBe(true);
    expect(classifyDeal(sparse)).toBe("low-priority");
  });

  it("counts classifications", () => {
    expect(countDealClassifications([
      deal({ score: 82, dataConfidenceScore: 90, rating: "green" }),
      deal({ score: 73, dataConfidenceScore: 85, rating: "amber" }),
      deal({ score: 65, dataConfidenceScore: 85, rating: "amber", sourceUrl: "https://example.com/listing" }),
      deal({ score: 42, dataConfidenceScore: 30, confidenceLevel: "low", rating: "red" }),
    ])).toEqual({
      "verified-green": 1,
      "green-candidate": 1,
      "requires-due-diligence": 1,
      "low-priority": 1,
    });
  });
});
