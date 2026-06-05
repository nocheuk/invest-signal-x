import { describe, expect, it } from "vitest";
import type { Deal } from "@/lib/deals";
import { buildAreaStats, formatAreaDelta, getAreaIntelligence } from "@/lib/areaIntelligence";

function deal(overrides: Partial<Deal>): Deal {
  return {
    id: "imp-1",
    title: "Imported deal",
    location: "Bournemouth, BH1",
    region: "Dorset",
    assetType: "Retail",
    source: "Auction",
    guidePrice: 1000000,
    passingRent: 80000,
    sqft: 10000,
    grossYield: 8,
    netInitialYield: 7.4,
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
    score: 70,
    rating: "amber",
    scoreBreakdown: { incomeQuality: 70, tenantSecurity: 60, marketPricing: 70, upside: 40, riskExit: 60 },
    insights: { mispricing: "", couldGoWrong: "", askAgent: "", negotiation: "" },
    thumbnail: "",
    postedAt: "2026-06-01T00:00:00Z",
    isImported: true,
    ...overrides,
  };
}

describe("area intelligence", () => {
  it("builds average and median area stats from imported deals only", () => {
    const stats = buildAreaStats([
      deal({ id: "target", netInitialYield: 9, pricePerSqft: 90 }),
      deal({ id: "peer-1", netInitialYield: 6, pricePerSqft: 160 }),
      deal({ id: "peer-2", netInitialYield: 8, pricePerSqft: 120 }),
      deal({ id: "demo", isImported: false, importSourceName: undefined, netInitialYield: 20, pricePerSqft: 20 }),
    ], { excludeDealId: "target" });

    expect(stats.city.get("Bournemouth")).toMatchObject({
      dealCount: 2,
      averageYield: 7,
      medianYield: 7,
      averagePricePerSqft: 140,
      medianPricePerSqft: 140,
    });
  });

  it("compares a deal to city peers and generates deterministic insights", () => {
    const target = deal({ id: "target", netInitialYield: 9, pricePerSqft: 90 });
    const intelligence = getAreaIntelligence(target, [
      target,
      deal({ id: "peer-1", netInitialYield: 6, pricePerSqft: 160 }),
      deal({ id: "peer-2", netInitialYield: 8, pricePerSqft: 120 }),
      deal({ id: "peer-3", netInitialYield: 7, pricePerSqft: 140 }),
    ]);

    expect(intelligence.stats).toMatchObject({ group: "city", area: "Bournemouth", dealCount: 3 });
    expect(intelligence.yieldDelta).toBeCloseTo(2);
    expect(intelligence.pricePerSqftDelta).toBeCloseTo(-50);
    expect(intelligence.insights).toEqual(expect.arrayContaining(["Above average yield", "Below average £/sqft"]));
  });

  it("falls back to region and marks limited area data", () => {
    const target = deal({ id: "target", location: "Poole, BH15", region: "Dorset", netInitialYield: 0, guidePrice: 0, sqft: 0, pricePerSqft: 0 });
    const intelligence = getAreaIntelligence(target, [
      target,
      deal({ id: "peer-region", location: "Bournemouth, BH1", region: "Dorset", netInitialYield: 7, pricePerSqft: 150 }),
    ]);

    expect(intelligence.stats).toMatchObject({ group: "region", area: "Dorset", dealCount: 1 });
    expect(intelligence.insights).toEqual(expect.arrayContaining([
      "Limited area data",
      "Yield unavailable for local comparison",
      "£/sqft unavailable for local comparison",
    ]));
  });

  it("formats area deltas for cards", () => {
    expect(formatAreaDelta(1.25, "yield")).toBe("+1.3 pts vs local avg");
    expect(formatAreaDelta(-42, "price")).toBe("-£42/sqft vs local avg");
    expect(formatAreaDelta(null, "yield")).toBe("No local benchmark");
  });
});
