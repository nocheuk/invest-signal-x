import { describe, expect, it } from "vitest";
import type { AreaIntelligence } from "@/lib/areaIntelligence";
import type { ComparableEvidence } from "@/lib/comparableEvidence";
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

const comparableEvidence: ComparableEvidence = {
  group: "city-asset",
  area: "Bournemouth",
  assetType: "Retail",
  sampleSize: 8,
  rawSampleSize: 10,
  cleanedSampleSize: 8,
  excludedSampleSize: 2,
  yieldSampleSize: 8,
  pricePerSqftSampleSize: 8,
  dealYield: 8.1,
  averageYield: 6.1,
  medianYield: 6,
  yieldDifferencePercent: 33,
  yieldPercentileRank: 88,
  dealPricePerSqft: 100,
  averagePricePerSqft: 150,
  medianPricePerSqft: 145,
  pricePerSqftDifferencePercent: -33,
  pricePerSqftPercentileRank: 88,
  isLimited: false,
  statements: [
    "Yield is 33% above the local average based on 8 comparable imported opportunities.",
    "Price per sqft is 33% below the local average based on 8 comparable properties.",
  ],
  shortEvidenceLine: "+33% vs area yield",
};

describe("investment thesis", () => {
  it("generates a tenant, lease, and rent-aware ASDA-style thesis", () => {
    const thesis = buildInvestmentThesis(deal({
      title: "Asda Stores Ltd, St Nicholas Gate Retail Park",
      location: "Carlisle, Cumberland",
      guidePrice: 4250000,
      passingRent: 771722,
      grossYield: 18.16,
      netInitialYield: 16.89,
      sqft: 35807,
      pricePerSqft: 119,
      tenant: "ASDA Stores Ltd",
      covenantStrength: "Strong",
      tenantHealthScore: 90,
      leaseLength: 12,
      wault: 12,
      rentReview: "Fixed uplift",
      score: 77,
      dataConfidenceScore: 76,
      confidenceLevel: "high",
      scoreReasons: {
        positiveDrivers: ["Gross yield above 8%"],
        negativeDrivers: [],
        missingDataWarnings: ["No comparable evidence yet"],
        verifyBeforeTrusting: [],
      },
      redFlags: [
        "Lease expiry extracted: May 2038",
        "Rent reviews extracted: 2028: GBP 894,657 pa; 2033: GBP 1,037,175 pa",
      ],
      enrichment: {
        status: "Enriched",
        extractedPayload: {
          leaseExpiryText: "May 2038",
          rentReviews: [
            { year: 2028, amount: 894657 },
            { year: 2033, amount: 1037175 },
          ],
        },
      },
    }), { strategyMatch: 82 });

    expect(thesis.summary).toContain("ASDA Stores Ltd");
    expect(thesis.whyInteresting).toEqual(expect.arrayContaining([
      "Tenant is identified: ASDA Stores Ltd",
      "Known tenant with 12 years income visibility",
      "Lease expiry extracted: May 2038",
    ]));
    expect(thesis.potentialUpside).toEqual(expect.arrayContaining([
      expect.stringContaining("Rent review uplift exists: 2028"),
      "Long lease / known tenant supports income profile (12 years)",
      "Matches your acquisition brief at 82%",
    ]));
    expect(thesis.verifyNext).toEqual(expect.arrayContaining(["Verify rent review clauses", "Check EPC", "Review title/legal pack", "Verify source listing accuracy"]));
    expect(thesis.keyRisks.join(" ")).not.toMatch(/tenant unknown|lease information missing|tenant covenant unknown/i);
  });

  it("generates a thesis from strong yield", () => {
    const thesis = buildInvestmentThesis(deal(), { areaIntelligence: area, comparableEvidence, strategyMatch: 82 });

    expect(thesis.summary).toContain("DealSignal Thesis:");
    expect(thesis.whyInteresting).toEqual(expect.arrayContaining(["Income yield is above 8% at 8.1%"]));
    expect(thesis.investorVerdict).toBe("Review Immediately");
  });

  it("generates defensible upside from below-area price per sqft", () => {
    const thesis = buildInvestmentThesis(deal(), { areaIntelligence: area, comparableEvidence });

    expect(thesis.potentialUpside).toEqual(expect.arrayContaining(["Price per sqft is 33% below the local comparable average"]));
  });

  it("references comparable evidence and low-sample caution", () => {
    const thesis = buildInvestmentThesis(deal(), {
      comparableEvidence: {
        ...comparableEvidence,
        sampleSize: 2,
        cleanedSampleSize: 2,
        yieldDifferencePercent: null,
        pricePerSqftDifferencePercent: null,
        isLimited: true,
      },
    });

    expect(thesis.whyInteresting).not.toEqual(expect.arrayContaining(["Yield is 33% above comparable imported deals"]));
    expect(thesis.keyRisks).toEqual(expect.arrayContaining(["Comparable evidence is limited"]));
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
    expect(`${thesis.summary} ${thesis.potentialUpside.join(" ")}`).not.toMatch(/\b(profit|roi|resale value|guaranteed)\b/i);
  });

  it("uses a cautious verdict for low confidence deals", () => {
    const thesis = buildInvestmentThesis(deal({ dataConfidenceScore: 40, confidenceLevel: "low", score: 70 }));

    expect(thesis.confidenceLevel).toBe("Low");
    expect(thesis.investorVerdict).toBe("Low Priority");
  });
});
