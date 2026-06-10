import { describe, expect, it } from "vitest";
import type { Deal } from "@/lib/deals";
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

describe("memo PDF data", () => {
  it("builds a clean memo filename", () => {
    expect(buildMemoFilename("Telecom House, 35 Holdenhurst Road / Bournemouth")).toBe("dealsignal-memo-telecom-house-35-holdenhurst-road-bournemouth.pdf");
  });

  it("uses real deal fields and source attribution", () => {
    const sections = buildMemoSections(deal());

    expect(sections.summary).toContainEqual(["Guide price", "£3.50m"]);
    expect(sections.summary).toContainEqual(["Floor area", "30,203 sq ft"]);
    expect(sections.summary).toContainEqual(["Price per sqft", "£116 / sq ft"]);
    expect(sections.summary).toContainEqual(["Data Confidence", "38/100 (low)"]);
    expect(sections.summary).toContainEqual(["Source", "Rightmove Commercial"]);
    expect(sections.investmentSummary).toContain("Telecom House, 35 Holdenhurst Road is a office opportunity in Bournemouth, BH8 8EJ");
    expect(sections.investmentThesis.summary).toContain("DealSignal Thesis:");
    expect(sections.investmentThesis.investorVerdict).toBe("Low Priority");
    expect(sections.investmentThesis.verifyNext).toEqual(expect.arrayContaining(["Confirm tenant covenant", "Confirm lease expiry and WAULT"]));
    expect(sections.opportunitySignals).toEqual(expect.arrayContaining(["Guide price and floor area available"]));
    expect(sections.riskSignals).toEqual(expect.arrayContaining(["Passing rent missing", "Tenant covenant unknown"]));
    expect(sections.positiveDrivers).toEqual(expect.arrayContaining(["Guide price and floor area available"]));
    expect(sections.risks).toEqual(expect.arrayContaining(["Tenant covenant unknown", "Passing rent missing"]));
    expect(sections.missingData).toEqual(["Tenant covenant unknown", "Lease length/WAULT missing"]);
    expect(sections.sourceUrl).toBe("https://www.rightmove.co.uk/properties/174711599");
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
    expect(sections.missingData).toEqual(["Needs review: key underwriting fields are missing or incomplete."]);
    expect(sections.sourceUrl).toBe("Not available");
  });
});
