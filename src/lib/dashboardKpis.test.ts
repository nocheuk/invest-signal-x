import { describe, expect, it } from "vitest";
import type { Deal } from "@/lib/deals";
import { buildDashboardKpis } from "@/lib/dashboardKpis";

function deal(overrides: Partial<Deal>): Deal {
  return {
    id: "deal",
    title: "Test deal",
    location: "Bournemouth, BH1",
    region: "South West",
    assetType: "Retail",
    source: "Private treaty",
    guidePrice: 0,
    passingRent: 0,
    sqft: 0,
    grossYield: 0,
    netInitialYield: 0,
    reversionaryYield: 0,
    wault: 0,
    leaseLength: 0,
    tenant: "Unknown",
    covenantStrength: "Vacant",
    tenantHealthScore: 0,
    rentSustainability: "Market rent",
    rentReview: "None",
    pricePerSqft: 0,
    planningUpsideScore: 0,
    voidRiskScore: 0,
    exitYieldSensitivity: "High",
    cashflowAfterDebt: 0,
    returnOnEquity: 0,
    redFlags: [],
    mainRiskFlag: "Needs review",
    score: 50,
    rating: "red",
    scoreBreakdown: {
      incomeQuality: 0,
      tenantSecurity: 0,
      marketPricing: 0,
      upside: 0,
      riskExit: 0,
    },
    insights: {
      mispricing: "Not available",
      couldGoWrong: "Not available",
      askAgent: "Not available",
      negotiation: "Not available",
    },
    thumbnail: "from-slate-200 to-slate-300",
    postedAt: "2026-06-01T10:00:00Z",
    ...overrides,
  };
}

describe("buildDashboardKpis", () => {
  const allDeals = [
    deal({
      id: "verified",
      score: 84,
      rating: "green",
      dataConfidenceScore: 82,
      guidePrice: 500_000,
      netInitialYield: 8.1,
      isImported: true,
    }),
    deal({
      id: "candidate",
      score: 74,
      rating: "amber",
      dataConfidenceScore: 76,
      guidePrice: 350_000,
      passingRent: 32_000,
      netInitialYield: 7.2,
      importSourceName: "Eddisons",
    }),
    deal({
      id: "amber",
      score: 66,
      rating: "amber",
      dataConfidenceScore: 72,
      guidePrice: 250_000,
      netInitialYield: 0,
    }),
    deal({
      id: "red",
      score: 42,
      rating: "red",
      dataConfidenceScore: 40,
      guidePrice: 0,
      netInitialYield: 0,
    }),
  ];

  it("calculates every dashboard KPI from the supplied real deal scope", () => {
    const metrics = buildDashboardKpis({
      allDeals,
      filteredDeals: allDeals,
      watchlistIds: ["verified", "candidate"],
      pipelineCounts: {
        Saved: 1,
        Reviewing: 2,
        "Viewing Booked": 1,
        "Offer Submitted": 1,
        Passed: 4,
        Purchased: 1,
      },
      totalDatabaseDeals: 1401,
    });

    expect(metrics).toMatchObject({
      totalDatabaseDeals: 1401,
      filteredDeals: 4,
      importedDeals: 2,
      withGuidePrice: 3,
      verifiedGreens: 1,
      greenCandidates: 1,
      amber: 1,
      red: 1,
      yieldSampleSize: 2,
      watchlistedDeals: 2,
      activeWatchlistDeals: 4,
      topScore: 84,
    });
    expect(metrics.averageYield).toBeCloseTo(7.65);
  });

  it("uses the filtered deal scope for filtered KPIs but all deals for imported totals", () => {
    const metrics = buildDashboardKpis({
      allDeals,
      filteredDeals: [allDeals[1]],
      watchlistIds: [],
      pipelineCounts: {},
    });

    expect(metrics.totalDatabaseDeals).toBe(4);
    expect(metrics.filteredDeals).toBe(1);
    expect(metrics.importedDeals).toBe(2);
    expect(metrics.greenCandidates).toBe(1);
    expect(metrics.verifiedGreens).toBe(0);
    expect(metrics.yieldSampleSize).toBe(1);
  });

  it("returns zero yield and sample size when no visible deals have yield", () => {
    const metrics = buildDashboardKpis({
      allDeals,
      filteredDeals: [allDeals[2], allDeals[3]],
      watchlistIds: [],
      pipelineCounts: {},
    });

    expect(metrics.averageYield).toBe(0);
    expect(metrics.yieldSampleSize).toBe(0);
  });
});
