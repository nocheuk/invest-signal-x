import { describe, expect, it } from "vitest";
import type { Deal } from "@/lib/deals";
import { buildFinancialAnalysis, calculateCommercialSdlt } from "@/lib/financialAnalysis";

function deal(overrides: Partial<Deal> = {}): Deal {
  return {
    id: "imp-asda",
    title: "Asda Stores Ltd, St Nicholas Gate Retail Park",
    location: "Carlisle, Cumberland",
    region: "All UK",
    assetType: "Retail",
    source: "Auction",
    importSourceName: "Allsop",
    isImported: true,
    guidePrice: 4250000,
    passingRent: 771722,
    sqft: 35807,
    grossYield: 18.16,
    netInitialYield: 16.89,
    reversionaryYield: 0,
    wault: 12,
    leaseLength: 12,
    tenant: "ASDA Stores Ltd",
    covenantStrength: "Strong",
    tenantHealthScore: 90,
    rentSustainability: "Market rent",
    rentReview: "Fixed uplift",
    pricePerSqft: 119,
    planningUpsideScore: 50,
    voidRiskScore: 25,
    exitYieldSensitivity: "Moderate",
    cashflowAfterDebt: 0,
    returnOnEquity: 0,
    redFlags: [],
    mainRiskFlag: "Verify source documents",
    score: 77,
    rating: "amber",
    dataConfidenceScore: 76,
    confidenceLevel: "high",
    scoreBreakdown: { incomeQuality: 80, tenantSecurity: 75, marketPricing: 72, upside: 58, riskExit: 66 },
    insights: { mispricing: "", couldGoWrong: "", askAgent: "", negotiation: "" },
    thumbnail: "",
    postedAt: "2026-06-10T09:00:00Z",
    ...overrides,
  };
}

describe("financial analysis", () => {
  it("calculates commercial SDLT using non-residential bands", () => {
    expect(calculateCommercialSdlt(150000)).toBe(0);
    expect(calculateCommercialSdlt(250000)).toBe(2000);
    expect(calculateCommercialSdlt(4250000)).toBe(202000);
  });

  it("calculates acquisition costs and cash purchase returns", () => {
    const analysis = buildFinancialAnalysis(deal());
    const cash = analysis.scenarios.find((scenario) => scenario.name === "Cash purchase");

    expect(analysis.acquisitionCosts).toMatchObject({
      guidePrice: 4250000,
      sdlt: 202000,
      legalFees: 7500,
      surveyFees: 3000,
      totalAcquisitionCost: 4462500,
    });
    expect(cash?.cashRequired).toBe(4462500);
    expect(cash?.annualFinanceCost).toBe(0);
    expect(cash?.annualNetCashflow).toBe(694550);
    expect(cash?.netYield).toBeCloseTo(15.56);
    expect(cash?.cashOnCashReturn).toBeCloseTo(15.56);
  });

  it("calculates leveraged purchase cash required and cash-on-cash return", () => {
    const analysis = buildFinancialAnalysis(deal(), {
      interestRatePct: 7,
      legalFees: 7500,
      surveyFees: 3000,
      arrangementFeePct: 1,
      voidAllowancePct: 5,
      managementAllowancePct: 5,
    });
    const ltv60 = analysis.scenarios.find((scenario) => scenario.name === "60% LTV");

    expect(ltv60?.loanAmount).toBe(2550000);
    expect(ltv60?.deposit).toBe(1700000);
    expect(ltv60?.arrangementFee).toBe(25500);
    expect(ltv60?.cashRequired).toBe(1938000);
    expect(ltv60?.annualFinanceCost).toBe(178500);
    expect(ltv60?.annualNetCashflow).toBe(516050);
    expect(ltv60?.cashOnCashReturn).toBeCloseTo(26.63);
  });

  it("does not invent rent when passing rent is missing", () => {
    const analysis = buildFinancialAnalysis(deal({ passingRent: 0, grossYield: 8, netInitialYield: 8 }));
    const ltv50 = analysis.scenarios.find((scenario) => scenario.name === "50% LTV");

    expect(ltv50?.annualRent).toBeNull();
    expect(ltv50?.annualNetCashflow).toBeNull();
    expect(ltv50?.netYield).toBeNull();
    expect(ltv50?.cashOnCashReturn).toBeNull();
    expect(ltv50?.missingRent).toBe(true);
  });
});
