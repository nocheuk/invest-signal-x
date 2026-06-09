import { describe, expect, it } from "vitest";
import type { Deal } from "@/lib/deals";
import { scoreImportedDeal } from "@/lib/scoring";
import { personalisedScore, type StrategyWeights } from "@/lib/strategy";

function scoringInput(overrides: Partial<Parameters<typeof scoreImportedDeal>[0]> = {}) {
  return {
    title: "Imported commercial investment",
    location: "Bournemouth, BH1",
    assetType: "Retail" as Deal["assetType"],
    source: "Private treaty" as Deal["source"],
    sourceUrl: "https://example.com/deal",
    importSourceName: "Rightmove Commercial Bournemouth",
    importSourceType: "apify_rightmove_commercial",
    guidePrice: 1_000_000,
    passingRent: 90_000,
    sqft: 5_000,
    grossYield: 9,
    netInitialYield: 9,
    reversionaryYield: 9.5,
    tenant: "Unknown",
    wault: 0,
    leaseLength: 0,
    pricePerSqft: 200,
    planningUpsideScore: 40,
    voidRiskScore: 40,
    exitYieldSensitivity: "Moderate" as Deal["exitYieldSensitivity"],
    postedAt: "2026-05-20T00:00:00Z",
    ...overrides,
  };
}

function dealFromScore(scored: ReturnType<typeof scoreImportedDeal>): Deal {
  return {
    id: "imp-test",
    title: "Imported commercial investment",
    location: "Bournemouth, BH1",
    region: "South West",
    assetType: "Retail",
    source: "Private treaty",
    importSourceName: "Rightmove Commercial Bournemouth",
    isImported: true,
    needsReview: scored.needsReview,
    dataConfidenceScore: scored.dataConfidenceScore,
    confidenceLevel: scored.confidenceLevel,
    scoreReasons: scored.reasons,
    guidePrice: 1_000_000,
    passingRent: 90_000,
    sqft: 5_000,
    grossYield: scored.grossYield,
    netInitialYield: scored.netInitialYield,
    reversionaryYield: 9.5,
    wault: 0,
    leaseLength: 0,
    tenant: "Unknown",
    covenantStrength: "Moderate",
    tenantHealthScore: 50,
    rentSustainability: "Market rent",
    rentReview: "None",
    pricePerSqft: scored.pricePerSqft,
    planningUpsideScore: 40,
    voidRiskScore: 40,
    exitYieldSensitivity: "Moderate",
    cashflowAfterDebt: 0,
    returnOnEquity: 0,
    redFlags: [],
    mainRiskFlag: scored.mainRiskFlag,
    score: scored.dealSignalScore,
    rating: scored.rating,
    scoreBreakdown: scored.scoreBreakdown,
    insights: { mispricing: "", couldGoWrong: "", askAgent: "", negotiation: "" },
    thumbnail: "",
    postedAt: "2026-05-20T00:00:00Z",
  };
}

describe("Scoring V1", () => {
  it("keeps normal diligence warnings without automatically marking needs review", () => {
    const scored = scoreImportedDeal(scoringInput());

    expect(scored.reasons.missingDataWarnings).toContain("No comparable evidence yet");
    expect(scored.needsReview).toBe(false);
    expect(scored.mainRiskFlag).not.toBe("Needs review");
  });

  it("does not let a high-yield but low-confidence deal become green", () => {
    const scored = scoreImportedDeal(scoringInput({
      passingRent: 0,
      sqft: 0,
      pricePerSqft: 0,
      netInitialYield: 12,
      grossYield: 12,
      sourceUrl: undefined,
      location: "All UK",
      postedAt: "",
    }));

    expect(scored.confidenceLevel).toBe("low");
    expect(scored.dealSignalScore).toBeLessThanOrEqual(59);
    expect(scored.rating).not.toBe("green");
  });

  it("scores an Acuitus deal with price and yield better than a sparse Rightmove row", () => {
    const rightmove = scoreImportedDeal(scoringInput({
      passingRent: 0,
      grossYield: 0,
      netInitialYield: 0,
      sqft: 0,
      sourceUrl: undefined,
    }));
    const acuitus = scoreImportedDeal(scoringInput({
      importSourceName: "Acuitus",
      importSourceType: "auction",
      source: "Auction",
      tenant: "National retailer",
      wault: 6,
      leaseLength: 7,
    }));

    expect(acuitus.dataConfidenceScore).toBeGreaterThan(rightmove.dataConfidenceScore);
    expect(acuitus.dealSignalScore).toBeGreaterThan(rightmove.dealSignalScore);
  });

  it("marks deals without guide price as unscorable", () => {
    const scored = scoreImportedDeal(scoringInput({ guidePrice: 0 }));

    expect(scored.dealSignalScore).toBe(0);
    expect(scored.needsReview).toBe(true);
    expect(scored.reasons.missingDataWarnings).toContain("Guide price missing");
  });

  it("reduces confidence when passing rent is missing", () => {
    const withRent = scoreImportedDeal(scoringInput());
    const withoutRent = scoreImportedDeal(scoringInput({ passingRent: 0 }));

    expect(withoutRent.dataConfidenceScore).toBeLessThan(withRent.dataConfidenceScore);
    expect(withoutRent.reasons.missingDataWarnings).toContain("Passing rent missing");
  });

  it("caps the strategy score using the same confidence rules", () => {
    const scored = scoreImportedDeal(scoringInput({
      passingRent: 0,
      sqft: 0,
      pricePerSqft: 0,
      netInitialYield: 12,
      grossYield: 12,
      sourceUrl: undefined,
      location: "All UK",
      postedAt: "",
    }));
    const strategy: StrategyWeights = { yield: 100, growth: 100, discount: 100, risk: 0, demand: 0 };

    expect(personalisedScore(dealFromScore(scored), strategy)).toBeLessThanOrEqual(59);
  });
});
