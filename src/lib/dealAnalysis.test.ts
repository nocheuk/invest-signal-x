import { describe, expect, it } from "vitest";
import type { Deal } from "@/lib/deals";
import { buildDealAnalysis } from "@/lib/dealAnalysis";

function deal(overrides: Partial<Deal> = {}): Deal {
  return {
    id: "imp-analysis",
    title: "Bournemouth retail investment",
    location: "Bournemouth, BH1",
    region: "South West",
    assetType: "Retail",
    source: "Private treaty",
    sourceUrl: "https://example.com/deal",
    importSourceName: "Rightmove Commercial",
    isImported: true,
    needsReview: false,
    guidePrice: 1_000_000,
    passingRent: 90_000,
    sqft: 12_000,
    grossYield: 9,
    netInitialYield: 9,
    reversionaryYield: 10,
    wault: 6,
    leaseLength: 7,
    tenant: "National Retailer Ltd",
    covenantStrength: "Good",
    tenantHealthScore: 80,
    rentSustainability: "Market rent",
    rentReview: "None",
    pricePerSqft: 83,
    planningUpsideScore: 40,
    voidRiskScore: 25,
    exitYieldSensitivity: "Moderate",
    cashflowAfterDebt: 0,
    returnOnEquity: 0,
    redFlags: [],
    mainRiskFlag: "Underwriting data verified",
    score: 84,
    rating: "green",
    dataConfidenceScore: 82,
    confidenceLevel: "high",
    scoreBreakdown: { incomeQuality: 88, tenantSecurity: 70, marketPricing: 78, upside: 60, riskExit: 78 },
    scoreReasons: {
      positiveDrivers: ["Auction source includes investment yield"],
      negativeDrivers: [],
      missingDataWarnings: [],
      verifyBeforeTrusting: ["Verify rent roll"],
    },
    insights: { mispricing: "", couldGoWrong: "", askAgent: "", negotiation: "" },
    thumbnail: "",
    postedAt: "2026-05-20T00:00:00Z",
    ...overrides,
  };
}

describe("Deal Analysis V2", () => {
  it("generates deterministic opportunity signals and an investment summary from real fields", () => {
    const analysis = buildDealAnalysis(deal());

    expect(analysis.opportunitySignals).toEqual(expect.arrayContaining([
      "9.0% yield is above an 8% acquisition benchmark",
      "Below benchmark capital value at £83 / sq ft",
      "Existing tenant in place: National Retailer Ltd",
    ]));
    expect(analysis.investmentSummary).toContain("Bournemouth retail investment is a retail opportunity in Bournemouth, BH1");
    expect(analysis.investmentSummary).toContain("with a guide price of £1.00m and 9.00% NIY");
  });

  it("flags sparse listings and missing data without inventing facts", () => {
    const analysis = buildDealAnalysis(deal({
      guidePrice: 0,
      passingRent: 0,
      netInitialYield: 0,
      grossYield: 0,
      sqft: 0,
      pricePerSqft: 0,
      tenant: "Unknown",
      wault: 0,
      leaseLength: 0,
      dataConfidenceScore: 30,
      confidenceLevel: "low",
      needsReview: true,
      sourceUrl: undefined,
    }));

    expect(analysis.riskSignals).toEqual(expect.arrayContaining([
      "Guide price missing or POA",
      "Passing rent missing",
      "Tenant unknown",
      "Lease information missing",
      "Low confidence data",
    ]));
    expect(analysis.investmentSummary).toContain("with no guide price available and no verified yield");
    expect(analysis.investmentSummary).not.toContain("National Retailer");
  });
});
