import { describe, expect, it } from "vitest";
import type { Deal } from "@/lib/deals";
import type { ComparableEvidence } from "@/lib/comparableEvidence";
import { buildMemoFilename, buildMemoSections } from "@/lib/memoPdf";

function deal(overrides: Partial<Deal> = {}): Deal {
  return {
    id: "imp-memo",
    title: "Telecom House, 35 Holdenhurst Road",
    location: "Bournemouth, BH8 8EJ",
    region: "South West",
    assetType: "Office",
    source: "Private treaty",
    sourceUrl: "https://www.rightmove.co.uk/properties/174711599",
    importSourceName: "Rightmove Commercial",
    isImported: true,
    needsReview: true,
    guidePrice: 3500000,
    passingRent: 0,
    sqft: 30203,
    grossYield: 0,
    netInitialYield: 0,
    reversionaryYield: 0,
    wault: 0,
    leaseLength: 0,
    tenant: "Unknown",
    covenantStrength: "Moderate",
    tenantHealthScore: 50,
    rentSustainability: "Market rent",
    rentReview: "None",
    pricePerSqft: 116,
    planningUpsideScore: 40,
    voidRiskScore: 40,
    exitYieldSensitivity: "Moderate",
    cashflowAfterDebt: 0,
    returnOnEquity: 0,
    redFlags: ["Tenant covenant unknown"],
    mainRiskFlag: "Needs review",
    score: 42,
    rating: "red",
    dataConfidenceScore: 38,
    confidenceLevel: "low",
    scoreReasons: {
      positiveDrivers: ["Guide price and floor area available"],
      negativeDrivers: ["Passing rent missing"],
      missingDataWarnings: ["Tenant covenant unknown", "Lease length/WAULT missing"],
      verifyBeforeTrusting: ["Confirm source listing and tenancy schedule"],
    },
    scoreBreakdown: { incomeQuality: 10, tenantSecurity: 40, marketPricing: 45, upside: 40, riskExit: 40 },
    insights: { mispricing: "", couldGoWrong: "", askAgent: "", negotiation: "" },
    thumbnail: "",
    postedAt: "2026-05-20T00:00:00Z",
    ...overrides,
  };
}

const comparableEvidence: ComparableEvidence = {
  group: "city-asset",
  area: "Bournemouth",
  assetType: "Office",
  sampleSize: 14,
  rawSampleSize: 18,
  cleanedSampleSize: 14,
  excludedSampleSize: 4,
  yieldSampleSize: 14,
  pricePerSqftSampleSize: 14,
  dealYield: 8.1,
  averageYield: 6.7,
  medianYield: 6.5,
  yieldDifferencePercent: 21,
  yieldPercentileRank: 86,
  dealPricePerSqft: 116,
  averagePricePerSqft: 142,
  medianPricePerSqft: 140,
  pricePerSqftDifferencePercent: -18,
  pricePerSqftPercentileRank: 79,
  isLimited: false,
  statements: [
    "Yield is 21% above the local average based on 14 comparable imported opportunities.",
    "Price per sqft is 18% below the local average based on 14 comparable properties.",
  ],
  shortEvidenceLine: "+21% vs area yield",
};

describe("investment pack PDF data", () => {
  it("builds a clean investment pack filename", () => {
    expect(buildMemoFilename("Telecom House, 35 Holdenhurst Road / Bournemouth")).toBe("dealsignal-investment-pack-telecom-house-35-holdenhurst-road-bournemouth.pdf");
  });

  it("uses real deal fields and source attribution", () => {
    const sections = buildMemoSections(deal());

    expect(sections.summary).toContainEqual(["Guide price", "\u00a33.50m"]);
    expect(sections.summary).toContainEqual(["Floor area", "30,203 sq ft"]);
    expect(sections.summary).toContainEqual(["Price per sqft", "\u00a3116 / sq ft"]);
    expect(sections.summary).toContainEqual(["Data Confidence", "38/100 (low)"]);
    expect(sections.summary).toContainEqual(["Source", "Rightmove Commercial"]);
    expect(sections.executiveSummary).toContainEqual(["Property", "Telecom House, 35 Holdenhurst Road"]);
    expect(sections.executiveSummary).toContainEqual(["Investor verdict", "Low Priority"]);
    expect(sections.investmentSummary).toContain("Telecom House, 35 Holdenhurst Road is a office opportunity in Bournemouth, BH8 8EJ");
    expect(sections.investmentThesis.summary).toContain("DealSignal Thesis:");
    expect(sections.investmentThesis.investorVerdict).toBe("Low Priority");
    expect(sections.investmentThesis.verifyNext).toEqual(expect.arrayContaining(["Confirm tenant covenant", "Confirm lease expiry and WAULT"]));
    expect(sections.tenantLeaseIncome).toEqual(expect.arrayContaining([
      "Tenant: Not available",
      "Passing rent: Not available",
      "Lease expiry: Not available",
      "Covenant note: Tenant covenant not available from imported data.",
    ]));
    expect(sections.financialAnalysis).toEqual(expect.arrayContaining([
      "60% LTV annual finance cost: \u00a3147k",
      "Annual rent: Not available",
      "60% LTV cash-on-cash return: Not available",
    ]));
    expect(sections.opportunitySignals).toEqual(expect.arrayContaining(["Guide price and floor area available"]));
    expect(sections.riskSignals).toEqual(expect.arrayContaining(["Passing rent missing", "Tenant covenant unknown"]));
    expect(sections.positiveDrivers).toEqual(expect.arrayContaining(["Guide price and floor area available"]));
    expect(sections.risks).toEqual(expect.arrayContaining(["Tenant covenant unknown", "Passing rent missing"]));
    expect(sections.missingData).toEqual(["Tenant covenant unknown", "Lease length/WAULT missing"]);
    expect(sections.sourceUrl).toBe("https://www.rightmove.co.uk/properties/174711599");
  });

  it("includes the deterministic investment thesis in investment pack content", () => {
    const sections = buildMemoSections(deal({
      title: "Asda Stores Ltd, St Nicholas Gate Retail Park",
      tenant: "ASDA Stores Ltd",
      passingRent: 771722,
      guidePrice: 4250000,
      grossYield: 18.16,
      netInitialYield: 16.89,
      leaseLength: 12,
      wault: 12,
      covenantStrength: "Strong",
      rentReview: "Fixed uplift",
      score: 77,
      dataConfidenceScore: 76,
      scoreReasons: {
        positiveDrivers: ["Gross yield above 8%"],
        negativeDrivers: [],
        missingDataWarnings: ["No comparable evidence yet"],
        verifyBeforeTrusting: [],
      },
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
    }), { comparableEvidence });

    expect(sections.investmentThesis.summary).toContain("Tenant recorded as ASDA Stores Ltd");
    expect(sections.investmentThesis.potentialUpside).toEqual(expect.arrayContaining([expect.stringContaining("Rent review uplift exists")]));
    expect(sections.investmentThesis.verifyNext).toEqual(expect.arrayContaining(["Verify rent review clauses"]));
    expect(sections.tenantLeaseIncome).toEqual(expect.arrayContaining([
      "Tenant: ASDA Stores Ltd",
      "Passing rent: \u00a3772k pa",
      "Lease expiry: May 2038",
      "WAULT: 12.0 years",
      "Rent reviews: 2028: \u00a3895k pa; 2033: \u00a31.04m pa",
    ]));
    expect(sections.financialAnalysis).toEqual(expect.arrayContaining([
      "SDLT: \u00a3202k",
      "Cash purchase cash required: \u00a34.46m",
      "50% LTV cash required: \u00a32.36m",
      "60% LTV cash required: \u00a31.94m",
      "75% LTV cash required: \u00a31.31m",
      "60% LTV estimated annual cashflow: \u00a3516k",
      "60% LTV cash-on-cash return: 26.6%",
    ]));
    expect(sections.comparableEvidence).toEqual(expect.arrayContaining([
      "Cleaned sample size: 14 usable imported comparables",
      "Raw local sample size: 18 imported peers",
      "Yield difference: +21%",
      "GBP/sqft difference: -18%",
      "Yield is 21% above the local average based on 14 comparable imported opportunities.",
    ]));
  });

  it("shows not available instead of inventing missing underwriting data", () => {
    const sections = buildMemoSections(deal({
      guidePrice: 0,
      sqft: 0,
      pricePerSqft: 0,
      dataConfidenceScore: undefined,
      confidenceLevel: undefined,
      sourceUrl: undefined,
      scoreReasons: undefined,
    }));

    expect(sections.summary).toContainEqual(["Guide price", "Not available"]);
    expect(sections.summary).toContainEqual(["Floor area", "Not available"]);
    expect(sections.summary).toContainEqual(["Price per sqft", "Not available"]);
    expect(sections.summary).toContainEqual(["Data Confidence", "Not available"]);
    expect(sections.investmentThesis.summary).toContain("no verified guide price");
    expect(sections.investmentThesis.summary).toContain("no verified yield");
    expect(sections.tenantLeaseIncome).toEqual(expect.arrayContaining([
      "Passing rent: Not available",
      "Lease expiry: Not available",
    ]));
    expect(sections.financialAnalysis).toEqual(expect.arrayContaining([
      "Guide price: Not available",
      "Cash purchase cash required: Not available",
      "Cash purchase cash-on-cash return: Not available",
    ]));
    expect(sections.verificationChecklist).toEqual(expect.arrayContaining(["Review legal pack and special conditions", "Check EPC"]));
    expect(sections.disclaimer.join(" ")).toContain("not financial");
    expect(sections.missingData).toEqual(["Needs review: key underwriting fields are missing or incomplete."]);
    expect(sections.sourceUrl).toBe("Not available");
  });
});
