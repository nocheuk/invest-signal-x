import { describe, expect, it } from "vitest";
import type { Deal } from "@/lib/deals";
import { buildFreshnessMetrics, filterByFreshness, formatAddedAgo, sortNewestDeals } from "@/lib/freshness";

const now = new Date("2026-06-04T12:00:00Z");

function deal(overrides: Partial<Deal>): Deal {
  return {
    id: "deal",
    title: "Test deal",
    location: "Bournemouth, BH1",
    region: "South West",
    assetType: "Retail",
    source: "Private treaty",
    guidePrice: 300000,
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
    scoreBreakdown: { incomeQuality: 0, tenantSecurity: 0, marketPricing: 0, upside: 0, riskExit: 0 },
    insights: { mispricing: "", couldGoWrong: "", askAgent: "", negotiation: "" },
    thumbnail: "",
    postedAt: "2026-06-04T10:00:00Z",
    isImported: true,
    importSourceName: "Rightmove Commercial",
    sourceUrl: "https://example.com/listing",
    ...overrides,
  };
}

describe("freshness metrics", () => {
  const today = deal({ id: "today", postedAt: "2026-06-04T10:00:00Z" });
  const candidate = deal({
    id: "candidate",
    postedAt: "2026-06-02T10:00:00Z",
    score: 74,
    rating: "amber",
    dataConfidenceScore: 78,
    passingRent: 25000,
  });
  const old = deal({ id: "old", postedAt: "2026-05-20T10:00:00Z" });
  const demo = deal({ id: "demo", postedAt: "2026-06-04T09:00:00Z", isImported: false, importSourceName: undefined });

  it("calculates today, week, green candidate, and source-listing freshness counts", () => {
    expect(buildFreshnessMetrics([today, candidate, old, demo], now)).toEqual({
      newToday: 1,
      newThisWeek: 2,
      newGreenCandidates: 1,
      newSourcesToday: 1,
    });
  });

  it("filters deals by the clicked freshness KPI", () => {
    const deals = [today, candidate, old, demo];
    expect(filterByFreshness(deals, "today", now).map((item) => item.id)).toEqual(["today"]);
    expect(filterByFreshness(deals, "week", now).map((item) => item.id)).toEqual(["today", "candidate"]);
    expect(filterByFreshness(deals, "green-candidates-week", now).map((item) => item.id)).toEqual(["candidate"]);
    expect(filterByFreshness(deals, "sources-today", now).map((item) => item.id)).toEqual(["today"]);
  });

  it("orders recently added deals newest first and formats relative time", () => {
    expect(sortNewestDeals([candidate, today, old]).map((item) => item.id)).toEqual(["today", "candidate", "old"]);
    expect(formatAddedAgo(today.postedAt, now)).toBe("Added 2 hours ago");
  });
});
