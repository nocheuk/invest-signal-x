import { describe, expect, it } from "vitest";
import type { ComparableEvidence } from "@/lib/comparableEvidence";
import type { Deal } from "@/lib/deals";
import { buildAcquisitionReadiness } from "@/lib/acquisitionReadiness";

describe("acquisition readiness", () => {
  it("scores a complete deal as offer ready", () => {
    const readiness = buildAcquisitionReadiness(deal(), evidence({ cleanedSampleSize: 12, isLimited: false }));

    expect(readiness.score).toBe(100);
    expect(readiness.band).toBe("Ready For Review");
    expect(readiness.missingLabels).toEqual([]);
    expect(readiness.checklist.every((item) => item.present)).toBe(true);
  });

  it("shows missing field checklist for incomplete deals", () => {
    const readiness = buildAcquisitionReadiness(deal({
      passingRent: 0,
      tenant: "Unknown",
      wault: 0,
      leaseLength: 0,
      sqft: 0,
      sourceUrl: "",
      enrichment: undefined,
    }), evidence({ cleanedSampleSize: 2, isLimited: true }));

    expect(readiness.band).toBe("Limited Information");
    expect(readiness.missingLabels).toEqual(expect.arrayContaining(["Rent", "Tenant", "Lease", "WAULT", "EPC", "Floor area", "Comparable evidence", "Source URL"]));
    expect(readiness.checklist.find((item) => item.label === "Price")?.present).toBe(true);
    expect(readiness.summary).toContain("Missing");
  });
});

function evidence(overrides: Partial<ComparableEvidence> = {}): ComparableEvidence {
  return {
    dealYield: 8,
    averageYield: 6,
    medianYield: 6,
    yieldDifferencePercent: 33,
    yieldPercentileRank: 80,
    dealPricePerSqft: 120,
    averagePricePerSqft: 160,
    medianPricePerSqft: 150,
    pricePerSqftDifferencePercent: -25,
    pricePerSqftPercentileRank: 20,
    sampleSize: 12,
    rawSampleSize: 12,
    cleanedSampleSize: 12,
    excludedSampleSize: 0,
    isLimited: false,
    statements: [],
    shortEvidenceLine: "+33% vs area yield",
    ...overrides,
  };
}

function deal(overrides: Partial<Deal> = {}): Deal {
  return {
    id: "deal-1",
    title: "Retail Investment",
    location: "Bournemouth",
    region: "South West",
    assetType: "Retail",
    source: "Auction",
    sourceUrl: "https://example.com/deal",
    guidePrice: 1000000,
    passingRent: 90000,
    sqft: 5000,
    grossYield: 9,
    netInitialYield: 8.5,
    reversionaryYield: 0,
    wault: 10,
    leaseLength: 10,
    tenant: "National Retailer Ltd",
    covenantStrength: "Strong",
    tenantHealthScore: 80,
    rentSustainability: "Market rent",
    rentReview: "Upward-only",
    pricePerSqft: 200,
    planningUpsideScore: 50,
    voidRiskScore: 20,
    exitYieldSensitivity: "Low",
    cashflowAfterDebt: 0,
    returnOnEquity: 0,
    redFlags: [],
    mainRiskFlag: "Verify source documents",
    score: 75,
    rating: "amber",
    dataConfidenceScore: 78,
    confidenceLevel: "high",
    scoreReasons: { positiveDrivers: [], negativeDrivers: [], missingDataWarnings: [], verifyBeforeTrusting: [] },
    scoreBreakdown: { incomeQuality: 80, tenantSecurity: 75, marketPricing: 70, upside: 55, riskExit: 70 },
    insights: { mispricing: "", couldGoWrong: "", askAgent: "", negotiation: "" },
    thumbnail: "",
    postedAt: "2026-06-12T08:00:00Z",
    enrichment: {
      status: "Enriched",
      epcRating: "B",
      extractedPayload: { leaseExpiryText: "May 2038" },
    },
    ...overrides,
  };
}
