import { describe, expect, it } from "vitest";
import type { Deal } from "@/lib/deals";
import { alertMatchesDeal, buildAlertEmailPayload, defaultAlertName, type SavedAlertCriteria } from "@/lib/alerts";

function alert(overrides: Partial<SavedAlertCriteria> = {}): SavedAlertCriteria {
  return {
    id: "alert-1",
    name: "Bournemouth retail",
    locationQuery: "Bournemouth",
    minYield: 7,
    maxPrice: 1_500_000,
    assetType: "Retail",
    minScore: 70,
    enabled: true,
    ...overrides,
  };
}

function deal(overrides: Partial<Deal> = {}): Deal {
  return {
    id: "imp-alert",
    title: "Bournemouth retail investment",
    location: "Bournemouth, BH1",
    region: "South West",
    assetType: "Retail",
    source: "Private treaty",
    guidePrice: 1_000_000,
    passingRent: 90_000,
    sqft: 5_000,
    grossYield: 9,
    netInitialYield: 8.5,
    reversionaryYield: 0,
    wault: 5,
    leaseLength: 5,
    tenant: "Tenant Ltd",
    covenantStrength: "Good",
    tenantHealthScore: 80,
    rentSustainability: "Market rent",
    rentReview: "None",
    pricePerSqft: 200,
    planningUpsideScore: 40,
    voidRiskScore: 25,
    exitYieldSensitivity: "Moderate",
    cashflowAfterDebt: 0,
    returnOnEquity: 0,
    redFlags: [],
    mainRiskFlag: "None",
    score: 82,
    rating: "green",
    scoreBreakdown: { incomeQuality: 80, tenantSecurity: 80, marketPricing: 80, upside: 50, riskExit: 80 },
    insights: { mispricing: "", couldGoWrong: "", askAgent: "", negotiation: "" },
    thumbnail: "",
    postedAt: "2026-05-30T08:00:00Z",
    isImported: true,
    ...overrides,
  };
}

describe("saved alerts", () => {
  it("matches deals by location, yield, price, score and asset type", () => {
    const result = alertMatchesDeal(alert(), deal());

    expect(result.matches).toBe(true);
    expect(result.reasons).toEqual(expect.arrayContaining([
      "Location matches Bournemouth",
      "Asset type matches Retail",
      "Score 82 meets minimum 70",
    ]));
  });

  it("rejects deals that miss criteria", () => {
    expect(alertMatchesDeal(alert({ locationQuery: "Poole" }), deal()).matches).toBe(false);
    expect(alertMatchesDeal(alert({ minYield: 10 }), deal()).matches).toBe(false);
    expect(alertMatchesDeal(alert({ maxPrice: 500000 }), deal()).matches).toBe(false);
    expect(alertMatchesDeal(alert({ assetType: "Office" }), deal()).matches).toBe(false);
    expect(alertMatchesDeal(alert({ minScore: 90 }), deal()).matches).toBe(false);
  });

  it("generates email payloads with top matching deals and DealSignal links", () => {
    const payload = buildAlertEmailPayload({
      alert: alert(),
      deals: [deal({ id: "imp-low", score: 72 }), deal({ id: "imp-high", title: "Top deal", score: 91 })],
      appUrl: "https://app.dealsignal.test",
    });

    expect(payload.subject).toContain("2 matching deals");
    expect(payload.topDeals[0]).toMatchObject({ id: "imp-high", title: "Top deal", url: "https://app.dealsignal.test/deal/imp-high" });
    expect(payload.text).toContain("Open DealSignal");
    expect(payload.html).toContain("<a href=\"https://app.dealsignal.test/deal/imp-high\">Open deal</a>");
  });

  it("builds clear default alert names from criteria", () => {
    expect(defaultAlertName(alert())).toContain("Bournemouth");
    expect(defaultAlertName(alert())).toContain("Retail");
    expect(defaultAlertName(alert())).toContain("score 70+");
  });
});
