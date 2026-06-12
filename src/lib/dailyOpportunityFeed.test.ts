import { describe, expect, it } from "vitest";
import type { Deal } from "@/lib/deals";
import { buildDailyOpportunityFeed, buildNationalOpportunityRankings, percentileForRank, topPercentForRank } from "@/lib/dailyOpportunityFeed";

const now = new Date("2026-06-12T10:00:00Z");

function deal(id: string, overrides: Partial<Deal> = {}): Deal {
  return {
    id,
    title: `Deal ${id}`,
    location: "Bournemouth, BH1",
    region: "South West",
    assetType: "Retail",
    source: "Auction",
    sourceUrl: `https://example.com/${id}`,
    importSourceName: "Allsop",
    isImported: true,
    guidePrice: 1000000,
    passingRent: 90000,
    sqft: 5000,
    grossYield: 9,
    netInitialYield: 8.5,
    reversionaryYield: 0,
    wault: 10,
    leaseLength: 10,
    tenant: "National Retailer Ltd",
    covenantStrength: "Good",
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
    scoreReasons: {
      positiveDrivers: ["Gross yield above 8%"],
      negativeDrivers: [],
      missingDataWarnings: [],
      verifyBeforeTrusting: [],
    },
    scoreBreakdown: { incomeQuality: 80, tenantSecurity: 75, marketPricing: 70, upside: 55, riskExit: 70 },
    insights: { mispricing: "", couldGoWrong: "", askAgent: "", negotiation: "" },
    thumbnail: "",
    postedAt: "2026-06-12T08:00:00Z",
    ...overrides,
  };
}

describe("daily opportunity feed", () => {
  it("calculates rank percentiles and top percentage", () => {
    expect(percentileForRank(1, 10)).toBe(100);
    expect(percentileForRank(10, 10)).toBe(10);
    expect(topPercentForRank(1, 10)).toBe(10);
    expect(topPercentForRank(3, 10)).toBe(30);
  });

  it("generates national ranking with why-it-made-the-list reasons", () => {
    const deals = [
      deal("best", { score: 82, dataConfidenceScore: 86, rating: "green", netInitialYield: 9.5 }),
      deal("candidate", { score: 74, dataConfidenceScore: 78, netInitialYield: 8.1 }),
      deal("weak", { score: 48, dataConfidenceScore: 50, passingRent: 0, grossYield: 0, netInitialYield: 0 }),
    ];

    const rankings = buildNationalOpportunityRankings(deals);

    expect(rankings[0].deal.id).toBe("best");
    expect(rankings[0].rank).toBe(1);
    expect(rankings[0].percentile).toBe(100);
    expect(rankings[0].topPercent).toBe(34);
    expect(rankings[0].whyMadeList.join(" ")).toMatch(/Yield|classification|tenant|lease/i);
  });

  it("generates top today, top this week, strong opportunities, and new high-ranking feeds", () => {
    const deals = [
      deal("today-top", { score: 82, dataConfidenceScore: 86, rating: "green", postedAt: "2026-06-12T08:00:00Z" }),
      deal("week-strong", { score: 74, dataConfidenceScore: 78, postedAt: "2026-06-10T08:00:00Z" }),
      deal("old-strong", { score: 76, dataConfidenceScore: 80, postedAt: "2026-05-20T08:00:00Z" }),
      deal("new-weak", { score: 45, dataConfidenceScore: 50, postedAt: "2026-06-12T08:00:00Z", passingRent: 0, grossYield: 0, netInitialYield: 0 }),
    ];

    const feed = buildDailyOpportunityFeed(deals, deals, now);

    expect(feed.top5Today.map((item) => item.deal.id)).toContain("today-top");
    expect(feed.top10ThisWeek.map((item) => item.deal.id)).toEqual(expect.arrayContaining(["today-top", "week-strong"]));
    expect(feed.strongOpportunities.map((item) => item.deal.id)).toEqual(expect.arrayContaining(["today-top", "week-strong", "old-strong"]));
    expect(feed.newHighRankingOpportunities.map((item) => item.deal.id)).toEqual(expect.arrayContaining(["today-top", "week-strong"]));
    expect(feed.newHighRankingOpportunities.map((item) => item.deal.id)).not.toContain("new-weak");
  });
});
