import { describe, expect, it } from "vitest";
import type { Deal } from "@/lib/deals";
import { buildInvestorShortlist, top10ThisWeek, top25Opportunities } from "@/lib/investorShortlist";

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
    netInitialYield: 7.5,
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
    postedAt: "2026-06-04T09:00:00Z",
    isImported: true,
    dataConfidenceScore: 75,
    confidenceLevel: "medium",
    ...overrides,
  };
}

describe("investor shortlist", () => {
  it("ranks opportunities using score, candidate status, yield, area intelligence and confidence", () => {
    const candidate = deal({ id: "candidate", score: 73, dataConfidenceScore: 82, netInitialYield: 8.5, passingRent: 85000, pricePerSqft: 90 });
    const sparseHighYield = deal({ id: "sparse", score: 62, dataConfidenceScore: 35, netInitialYield: 10.5, passingRent: 105000, pricePerSqft: 100 });
    const peer = deal({ id: "peer", score: 65, dataConfidenceScore: 70, netInitialYield: 6.5, pricePerSqft: 160 });

    const result = buildInvestorShortlist([sparseHighYield, candidate, peer], { allDeals: [sparseHighYield, candidate, peer] });

    expect(result[0].deal.id).toBe("candidate");
    expect(result[0].reasons).toEqual(expect.arrayContaining([
      "Green Candidate classification",
      "Confidence 82",
      "NIY 8.50%",
    ]));
  });

  it("returns Top 10 This Week and excludes older imported deals", () => {
    const now = new Date("2026-06-05T12:00:00Z");
    const fresh = deal({ id: "fresh", postedAt: "2026-06-04T09:00:00Z" });
    const old = deal({ id: "old", postedAt: "2026-05-20T09:00:00Z", score: 95 });

    expect(top10ThisWeek([fresh, old], [fresh, old], now).map((item) => item.deal.id)).toEqual(["fresh"]);
  });

  it("returns Top 25 Opportunities and supports ranking modes", () => {
    const highYield = deal({ id: "yield", score: 65, netInitialYield: 12, dataConfidenceScore: 70, pricePerSqft: 130 });
    const undervalued = deal({ id: "undervalued", score: 65, netInitialYield: 7, dataConfidenceScore: 70, pricePerSqft: 50 });
    const confident = deal({ id: "confidence", score: 65, netInitialYield: 7, dataConfidenceScore: 95, pricePerSqft: 130 });
    const peer = deal({ id: "peer", score: 65, netInitialYield: 7, dataConfidenceScore: 70, pricePerSqft: 180 });
    const deals = [highYield, undervalued, confident, peer];

    expect(top25Opportunities(deals, deals, "top-yield")[0].deal.id).toBe("yield");
    expect(top25Opportunities(deals, deals, "most-undervalued")[0].deal.id).toBe("undervalued");
    expect(top25Opportunities(deals, deals, "highest-confidence")[0].deal.id).toBe("confidence");
  });

  it("ignores non-imported demo deals", () => {
    const imported = deal({ id: "imported" });
    const demo = deal({ id: "demo", isImported: false, importSourceName: undefined, score: 100 });

    expect(buildInvestorShortlist([demo, imported]).map((item) => item.deal.id)).toEqual(["imported"]);
  });
});
