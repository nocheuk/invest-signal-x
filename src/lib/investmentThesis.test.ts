import { describe, expect, it } from "vitest";
import type { AreaIntelligence } from "@/lib/areaIntelligence";
import type { Deal } from "@/lib/deals";
import { buildInvestmentThesis } from "@/lib/investmentThesis";

function deal(overrides: Partial<Deal> = {}): Deal {
  return {
    id: "imp-thesis",
    title: "High Street Retail Investment",
    location: "Bournemouth, BH1",
    region: "Dorset",
    assetType: "Retail",
    source: "Auction",
    sourceUrl: "https://example.com/listing",
    importSourceName: "Allsop",
    isImported: true,
    guidePrice: 1000000,
    passingRent: 85000,
    sqft: 10000,
    grossYield: 8.5,
    netInitialYield: 8.1,
    reversionaryYield: 9.2,
    wault: 0,
    leaseLength: 0,
    tenant: "Unknown",
    covenantStrength: "Moderate",
    tenantHealthScore: 55,
    rentSustainability: "Market rent",
    rentReview: "None",
    pricePerSqft: 100,
    planningUpsideScore: 50,
    voidRiskScore: 35,
    exitYieldSensitivity: "Moderate",
    cashflowAfterDebt: 0,
    returnOnEquity: 0,
    redFlags: [],
    mainRiskFlag: "Lease information unavailable",
    score: 74,
    rating: "amber",
    dataConfidenceScore: 78,
    confidenceLevel: "medium",
    scoreReasons: {
      positiveDrivers: [],
      negativeDrivers: [],
      missingDataWarnings: ["Tenant covenant unknown", "Lease length/WAULT missing", "No comparable evidence yet"],
      verifyBeforeTrusting: [],
    },
    scoreBreakdown: { incomeQuality: 76, tenantSecurity: 45, marketPricing: 72, upside: 62, riskExit: 60 },
    insights: { mispricing: "", couldGoWrong: "", askAgent: "", negotiation: "" },
    thumbnail: "",
    postedAt: "2026-06-10T09:00:00Z",
    ...overrides,
  };
}

const area: AreaIntelligence = {
  stats: {
    group: "city",
    area: "Bournemouth",
    dealCount: 8,
    averageYield: 6.1,
    medianYield: 6,
    averagePricePerSqft: 150,
    medianPricePerSqft: 145,
  },
  yieldDelta: 2,
  pricePerSqftDelta: -50,
  insights: ["Above average yield", "Below average £/sqft"],
};

describe("investment thesis", () => {
  it("generates a thesis from strong yield", () => {
    const thesis = buildInvestmentThesis(deal(), { areaIntelligence: area, strategyMatch: 82 });

    expect(thesis.summary).toContain("DealSignal Thesis:");
    expect(thesis.whyInteresting).toEqual(expect.arrayContaining(["Income yield is above 8% at 8.1%"]));
    expect(thesis.investorVerdict).toBe("Review Immediately");
  });

  it("generates defensible upside from below-area price per sqft", () => {
    const thesis = buildInvestmentThesis(deal(), { areaIntelligence: area });

    expect(thesis.potentialUpside.some((item) => item.includes("Price per sqft is 33% below the local average") && item.includes("/sq ft lower"))).toBe(true);
  });

  it("does not invent missing financial facts", () => {
    const thesis = buildInvestmentThesis(deal({
      guidePrice: 0,
      passingRent: 0,
      grossYield: 0,
      netInitialYield: 0,
      sqft: 0,
      pricePerSqft: 0,
      score: 38,
      dataConfidenceScore: 30,
      confidenceLevel: "low",
      scoreReasons: {
        positiveDrivers: [],
        negativeDrivers: [],
        missingDataWarnings: ["Guide price missing", "Passing rent missing", "Floor area missing"],
        verifyBeforeTrusting: [],
      },
    }));

    expect(thesis.summary).toContain("no verified guide price");
    expect(thesis.summary).toContain("no verified yield");
    expect(thesis.potentialUpside).toEqual(["No calculated upside signal is available from the imported data yet."]);
    expect(thesis.verifyNext).toEqual(expect.arrayContaining(["Confirm guide price", "Confirm passing rent", "Confirm floor area"]));
  });

  it("uses a cautious verdict for low confidence deals", () => {
    const thesis = buildInvestmentThesis(deal({ dataConfidenceScore: 40, confidenceLevel: "low", score: 70 }));

    expect(thesis.confidenceLevel).toBe("Low");
    expect(thesis.investorVerdict).toBe("Low Priority");
  });
});
