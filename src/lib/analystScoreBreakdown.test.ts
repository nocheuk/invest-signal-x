import { describe, expect, it } from "vitest";
import type { ComparableEvidence } from "@/lib/comparableEvidence";
import type { Deal } from "@/lib/deals";
import { buildAnalystScoreBreakdown, scoreBreakdownLines } from "@/lib/analystScoreBreakdown";

describe("analyst score breakdown", () => {
  it("generates positive and negative contributors from real deal fields", () => {
    const breakdown = buildAnalystScoreBreakdown(deal(), {
      comparableEvidence: evidence(),
      strategyMatch: 82,
    });

    expect(breakdown.positives.map((item) => item.label)).toEqual(expect.arrayContaining([
      "Yield",
      "Yield vs benchmark",
      "Area value",
      "Tenant",
      "Lease",
      "Rent reviews",
      "Strategy match",
    ]));
    expect(breakdown.negatives.map((item) => item.label)).toEqual(expect.arrayContaining(["Missing EPC"]));
    expect(breakdown.explanation).toContain("DealSignal score 77/100");
    expect(scoreBreakdownLines(breakdown).join(" ")).toContain("+");
  });

  it("keeps sparse low-confidence deals cautious", () => {
    const breakdown = buildAnalystScoreBreakdown(deal({
      tenant: "Unknown",
      passingRent: 0,
      grossYield: 0,
      netInitialYield: 0,
      sqft: 0,
      leaseLength: 0,
      wault: 0,
      dataConfidenceScore: 38,
      confidenceLevel: "low",
      score: 42,
    }), { comparableEvidence: evidence({ isLimited: true, cleanedSampleSize: 0 }) });

    expect(breakdown.negatives.map((item) => item.label)).toEqual(expect.arrayContaining([
      "Missing floor area",
      "Limited comparable evidence",
      "Missing lease data",
      "Missing tenant data",
      "Missing income data",
      "Low confidence",
    ]));
    expect(breakdown.explanation).toMatch(/keeps the ranking cautious/i);
  });
});

function deal(overrides: Partial<Deal> = {}): Deal {
  return {
    id: "asda",
    title: "ASDA Stores Ltd, St Nicholas Gate Retail Park",
    location: "Carlisle, CA1",
    region: "North West",
    assetType: "Retail",
    source: "Auction",
    sourceUrl: "https://example.com/asda",
    importSourceName: "Allsop",
    isImported: true,
    guidePrice: 4250000,
    passingRent: 771722,
    sqft: 35807,
    grossYield: 18.16,
    netInitialYield: 16.89,
    reversionaryYield: 0,
    wault: 12,
    leaseLength: 12,
    tenant: "ASDA Stores Ltd",
    covenantStrength: "Strong",
    tenantHealthScore: 90,
    rentSustainability: "Market rent",
    rentReview: "Fixed uplift",
    pricePerSqft: 119,
    planningUpsideScore: 50,
    voidRiskScore: 25,
    exitYieldSensitivity: "Moderate",
    cashflowAfterDebt: 0,
    returnOnEquity: 0,
    redFlags: [],
    mainRiskFlag: "Verify source documents",
    score: 77,
    rating: "amber",
    dataConfidenceScore: 76,
    confidenceLevel: "high",
    scoreReasons: {
      positiveDrivers: ["Gross yield above 8%"],
      negativeDrivers: [],
      missingDataWarnings: [],
      verifyBeforeTrusting: [],
    },
    scoreBreakdown: { incomeQuality: 80, tenantSecurity: 75, marketPricing: 72, upside: 58, riskExit: 66 },
    insights: { mispricing: "", couldGoWrong: "", askAgent: "", negotiation: "" },
    enrichment: {
      status: "Enriched",
      extractedPayload: {
        rentReviews: [
          { year: 2028, amount: 894657 },
          { year: 2033, amount: 1037175 },
        ],
      },
    },
    thumbnail: "",
    postedAt: "2026-06-10T09:00:00Z",
    ...overrides,
  };
}

function evidence(overrides: Partial<ComparableEvidence> = {}): ComparableEvidence {
  return {
    group: "city-asset",
    area: "Carlisle",
    assetType: "Retail",
    sampleSize: 14,
    rawSampleSize: 18,
    cleanedSampleSize: 14,
    excludedSampleSize: 4,
    yieldSampleSize: 14,
    pricePerSqftSampleSize: 14,
    dealYield: 16.89,
    averageYield: 10,
    medianYield: 9,
    yieldDifferencePercent: 69,
    yieldPercentileRank: 95,
    dealPricePerSqft: 119,
    averagePricePerSqft: 165,
    medianPricePerSqft: 150,
    pricePerSqftDifferencePercent: -28,
    pricePerSqftPercentileRank: 80,
    isLimited: false,
    statements: [],
    shortEvidenceLine: "+69% vs area yield",
    ...overrides,
  };
}
