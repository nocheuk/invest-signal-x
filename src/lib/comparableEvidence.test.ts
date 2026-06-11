import { describe, expect, it } from "vitest";
import type { Deal } from "@/lib/deals";
import { buildComparableEvidence } from "@/lib/comparableEvidence";

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
    scoreBreakdown: { incomeQuality: 70, tenantSecurity: 60, marketPricing: 70, upside: 40, riskExit: 60 },
    insights: { mispricing: "", couldGoWrong: "", askAgent: "", negotiation: "" },
    thumbnail: "",
    postedAt: "2026-06-01T00:00:00Z",
    ...overrides,
  };
}

describe("comparable evidence", () => {
  it("calculates area average and median yield from imported peer deals", () => {
    const target = deal({ id: "target", netInitialYield: 9, pricePerSqft: 100 });
    const evidence = buildComparableEvidence(target, [
      target,
      deal({ id: "peer-1", netInitialYield: 6, pricePerSqft: 150 }),
      deal({ id: "peer-2", netInitialYield: 7, pricePerSqft: 130 }),
      deal({ id: "peer-3", netInitialYield: 8, pricePerSqft: 110 }),
    ]);

    expect(evidence.group).toBe("city-asset");
    expect(evidence.sampleSize).toBe(3);
    expect(evidence.averageYield).toBe(7);
    expect(evidence.medianYield).toBe(7);
    expect(evidence.yieldDifferencePercent).toBeCloseTo(28.57);
    expect(evidence.yieldPercentileRank).toBe(100);
  });

  it("calculates price per sqft comparison and lower-price percentile", () => {
    const target = deal({ id: "target", pricePerSqft: 100 });
    const evidence = buildComparableEvidence(target, [
      target,
      deal({ id: "peer-1", pricePerSqft: 150, netInitialYield: 6 }),
      deal({ id: "peer-2", pricePerSqft: 130, netInitialYield: 7 }),
      deal({ id: "peer-3", pricePerSqft: 110, netInitialYield: 8 }),
    ]);

    expect(evidence.averagePricePerSqft).toBe(130);
    expect(evidence.medianPricePerSqft).toBe(130);
    expect(evidence.pricePerSqftDifferencePercent).toBeCloseTo(-23.08);
    expect(evidence.pricePerSqftPercentileRank).toBe(100);
    expect(evidence.statements).toEqual(expect.arrayContaining([expect.stringContaining("Price per sqft is 23% below the local average")]));
  });

  it("warns when local comparable sample is limited", () => {
    const target = deal({ id: "target" });
    const evidence = buildComparableEvidence(target, [target, deal({ id: "peer-1" })]);

    expect(evidence.isLimited).toBe(true);
    expect(evidence.statements).toEqual(expect.arrayContaining(["Comparable evidence is limited in this area, so this should be verified manually."]));
    expect(evidence.shortEvidenceLine).toBe("Limited local comps");
  });
});
