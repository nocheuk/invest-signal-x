import { describe, expect, it } from "vitest";
import type { Deal } from "@/lib/deals";
import { auditComparableDataset, buildComparableEvidence } from "@/lib/comparableEvidence";

function deal(overrides: Partial<Deal> = {}): Deal {
  return {
    id: "imp-target",
    title: "Retail Investment",
    location: "Bournemouth, BH1",
    region: "Dorset",
    assetType: "Retail",
    source: "Auction",
    sourceUrl: "https://example.com",
    importSourceName: "Allsop",
    isImported: true,
    guidePrice: 1000000,
    passingRent: 90000,
    sqft: 10000,
    grossYield: 9,
    netInitialYield: 9,
    reversionaryYield: 0,
    wault: 0,
    leaseLength: 0,
    tenant: "Unknown",
    covenantStrength: "Moderate",
    tenantHealthScore: 60,
    rentSustainability: "Market rent",
    rentReview: "None",
    pricePerSqft: 100,
    planningUpsideScore: 40,
    voidRiskScore: 40,
    exitYieldSensitivity: "Moderate",
    cashflowAfterDebt: 0,
    returnOnEquity: 0,
    redFlags: [],
    mainRiskFlag: "Needs review",
    score: 72,
    rating: "amber",
    dataConfidenceScore: 85,
    confidenceLevel: "high",
    scoreBreakdown: { incomeQuality: 70, tenantSecurity: 60, marketPricing: 70, upside: 40, riskExit: 60 },
    insights: { mispricing: "", couldGoWrong: "", askAgent: "", negotiation: "" },
    thumbnail: "",
    postedAt: "2026-06-01T00:00:00Z",
    ...overrides,
  };
}

function peers() {
  return [
    deal({ id: "peer-1", netInitialYield: 6, grossYield: 6, pricePerSqft: 150 }),
    deal({ id: "peer-2", netInitialYield: 7, grossYield: 7, pricePerSqft: 130 }),
    deal({ id: "peer-3", netInitialYield: 8, grossYield: 8, pricePerSqft: 110 }),
    deal({ id: "peer-4", netInitialYield: 9, grossYield: 9, pricePerSqft: 90 }),
    deal({ id: "peer-5", netInitialYield: 10, grossYield: 10, pricePerSqft: 70 }),
  ];
}

describe("comparable evidence", () => {
  it("calculates area average and median yield from cleaned imported peer deals", () => {
    const target = deal({ id: "target", netInitialYield: 9, pricePerSqft: 100 });
    const evidence = buildComparableEvidence(target, [target, ...peers()]);

    expect(evidence.group).toBe("city-asset");
    expect(evidence.rawSampleSize).toBe(5);
    expect(evidence.cleanedSampleSize).toBe(5);
    expect(evidence.sampleSize).toBe(5);
    expect(evidence.averageYield).toBe(8);
    expect(evidence.medianYield).toBe(8);
    expect(evidence.yieldDifferencePercent).toBeCloseTo(12.5);
    expect(evidence.yieldPercentileRank).toBe(80);
  });

  it("calculates price per sqft comparison and lower-price percentile", () => {
    const target = deal({ id: "target", pricePerSqft: 100 });
    const evidence = buildComparableEvidence(target, [target, ...peers()]);

    expect(evidence.averagePricePerSqft).toBe(110);
    expect(evidence.medianPricePerSqft).toBe(110);
    expect(evidence.pricePerSqftDifferencePercent).toBeCloseTo(-9.09);
    expect(evidence.pricePerSqftPercentileRank).toBe(60);
  });

  it("excludes outlier yields and price per sqft values from benchmark averages", () => {
    const target = deal({ id: "target", netInitialYield: 9, pricePerSqft: 100 });
    const evidence = buildComparableEvidence(target, [
      target,
      ...peers(),
      deal({ id: "bad-yield", netInitialYield: 2232, grossYield: 2232, pricePerSqft: 100, importSourceName: "Rightmove Commercial" }),
      deal({ id: "bad-price", netInitialYield: 8, grossYield: 8, guidePrice: 2500000, sqft: 1, pricePerSqft: 2500000, importSourceName: "Rightmove Commercial" }),
      deal({ id: "low-confidence", netInitialYield: 8, grossYield: 8, pricePerSqft: 120, dataConfidenceScore: 30, confidenceLevel: "low" }),
    ]);

    expect(evidence.rawSampleSize).toBe(8);
    expect(evidence.cleanedSampleSize).toBe(5);
    expect(evidence.excludedSampleSize).toBe(3);
    expect(evidence.averageYield).toBe(8);
    expect(evidence.averagePricePerSqft).toBe(110);
  });

  it("shows limited evidence instead of averages when cleaned sample is below five", () => {
    const target = deal({ id: "target" });
    const evidence = buildComparableEvidence(target, [
      target,
      deal({ id: "peer-1" }),
      deal({ id: "peer-2", netInitialYield: 2232, grossYield: 2232 }),
      deal({ id: "peer-3", pricePerSqft: 2500000 }),
    ]);

    expect(evidence.rawSampleSize).toBe(3);
    expect(evidence.cleanedSampleSize).toBe(1);
    expect(evidence.isLimited).toBe(true);
    expect(evidence.averageYield).toBeNull();
    expect(evidence.averagePricePerSqft).toBeNull();
    expect(evidence.statements[0]).toContain("Comparable evidence limited");
    expect(evidence.shortEvidenceLine).toBe("Limited local comps");
  });

  it("audits raw metric distributions and outlier counts by source", () => {
    const audit = auditComparableDataset([
      deal({ id: "seed", isImported: false, importSourceName: undefined }),
      ...peers(),
      deal({ id: "bad-yield", netInitialYield: 44.6, grossYield: 44.6, importSourceName: "Allsop" }),
      deal({ id: "low-yield", netInitialYield: 0.5, grossYield: 0.5, importSourceName: "Rightmove Commercial" }),
      deal({ id: "bad-price", pricePerSqft: 2500000, importSourceName: "Rightmove Commercial" }),
      deal({ id: "low-price", pricePerSqft: 5, importSourceName: "Rightmove Commercial" }),
    ]);

    expect(audit.totalDeals).toBe(10);
    expect(audit.importedDeals).toBe(9);
    expect(audit.yieldStats.min).toBe(0.5);
    expect(audit.yieldStats.max).toBe(44.6);
    expect(audit.yieldStats.median).toBe(9);
    expect(audit.yieldStats.p95).toBe(44.6);
    expect(audit.pricePerSqftStats.max).toBe(2500000);
    expect(audit.outlierCounts).toEqual({
      yieldGreaterThan25: 1,
      yieldBelow1: 1,
      pricePerSqftGreaterThan2000: 1,
      pricePerSqftBelow10: 1,
    });
    expect(audit.outliersBySource.yieldGreaterThan25).toEqual({ Allsop: 1 });
    expect(audit.outliersBySource.pricePerSqftGreaterThan2000).toEqual({ "Rightmove Commercial": 1 });
  });
});
