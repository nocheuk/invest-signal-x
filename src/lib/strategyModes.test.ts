import { describe, expect, it } from "vitest";
import type { Deal } from "@/lib/deals";
import { buildHighStreetConversionDiagnostics, filterDealsForStrategyMode, parseStrategyMode, scoreStrategyMode } from "@/lib/strategyModes";

function deal(overrides: Partial<Deal> = {}): Deal {
  return {
    id: "deal-1",
    title: "High Street retail investment with upper parts",
    location: "Bournemouth town centre",
    region: "South West",
    assetType: "Retail",
    source: "Auction",
    guidePrice: 450000,
    passingRent: 30000,
    sqft: 4500,
    grossYield: 7,
    netInitialYield: 6.5,
    reversionaryYield: 0,
    wault: 0,
    leaseLength: 0,
    tenant: "Unknown",
    covenantStrength: "Moderate",
    tenantHealthScore: 50,
    rentSustainability: "Market rent",
    rentReview: "None",
    pricePerSqft: 100,
    planningUpsideScore: 65,
    voidRiskScore: 35,
    exitYieldSensitivity: "Moderate",
    cashflowAfterDebt: 0,
    returnOnEquity: 0,
    redFlags: [],
    mainRiskFlag: "Verify planning",
    score: 70,
    rating: "amber",
    scoreBreakdown: { incomeQuality: 60, tenantSecurity: 50, marketPricing: 70, upside: 75, riskExit: 55 },
    insights: { mispricing: "", couldGoWrong: "", askAgent: "", negotiation: "" },
    thumbnail: "",
    postedAt: "2026-06-01T00:00:00Z",
    ...overrides,
  };
}

describe("strategy modes", () => {
  it("detects high street upper-floor conversion signals from enriched text", () => {
    const match = scoreStrategyMode(deal({
      enrichment: {
        status: "Enriched",
        investmentSummary: "Retail unit with vacant upper floors, separate rear access and residential conversion potential. Class E.",
      },
    }), "high-street-conversion");

    expect(match.matches).toBe(true);
    expect(match.score).toBeGreaterThanOrEqual(70);
    expect(match.reasons.join(" ")).toMatch(/upper|conversion|access|Class E|Retail/i);
    expect(match.missingDiligence).not.toContain("upper floor access");
    expect(match.missingDiligence).not.toContain("current use class");
  });

  it("excludes irrelevant industrial and land deals without conversion signals", () => {
    const industrial = deal({ id: "industrial", title: "Industrial warehouse estate", assetType: "Industrial", location: "Out of town logistics park" });
    const land = deal({ id: "land", title: "Agricultural land parcel", assetType: "Land", location: "Rural Hampshire" });

    expect(scoreStrategyMode(industrial, "high-street-conversion").matches).toBe(false);
    expect(scoreStrategyMode(land, "high-street-conversion").matches).toBe(false);
    expect(filterDealsForStrategyMode([industrial, land], "high-street-conversion")).toEqual([]);
  });

  it("filters and ranks high street conversion matches", () => {
    const strong = deal({
      id: "strong",
      title: "Former bank on high street with accommodation above",
      enrichment: { status: "Enriched", extractedPayload: { description: "Residential conversion potential, vacant upper floors and rear access." } },
    });
    const weak = deal({ id: "weak", title: "Retail shop", assetType: "Retail", location: "Suburban parade" });
    const ignored = deal({ id: "ignored", title: "Warehouse", assetType: "Industrial" });

    expect(filterDealsForStrategyMode([weak, ignored, strong], "high-street-conversion").map((item) => item.id)).toEqual(["strong"]);
  });

  it("includes lower-scoring discovery matches at 20+ without marking them as best tier", () => {
    const discovery = deal({
      id: "discovery",
      title: "Town centre shop with development opportunity STPP",
      assetType: "Office",
      isImported: true,
    });

    const match = scoreStrategyMode(discovery, "high-street-conversion");
    expect(match.matches).toBe(true);
    expect(match.tier).toBe("match");
    expect(match.score).toBeGreaterThanOrEqual(20);
    expect(match.score).toBeLessThan(40);
    expect(filterDealsForStrategyMode([discovery], "high-street-conversion")).toHaveLength(1);
  });

  it("detects expanded High Street Conversion vocabulary", () => {
    const match = scoreStrategyMode(deal({
      title: "Former department store mixed use opportunity",
      enrichment: {
        status: "Enriched",
        extractedPayload: {
          description: "Retail and residential redevelopment potential with storage above, self contained upper floors, vacant possession and STPP.",
        },
      },
    }), "high-street-conversion");

    expect(match.matches).toBe(true);
    expect(match.matchedSignals).toEqual(expect.arrayContaining([
      "mixed-use",
      "former bank or department store",
      "upper floors",
      "residential conversion",
      "development opportunity",
      "ancillary / storage above",
    ]));
  });

  it("builds High Street Conversion diagnostics and near-miss buckets for imported deals", () => {
    const strong = deal({
      id: "strong",
      isImported: true,
      title: "Former bank on high street with accommodation above",
      enrichment: { status: "Enriched", extractedPayload: { description: "Residential conversion potential and vacant upper floors." } },
    });
    const nearMiss = deal({ id: "near", isImported: true, title: "Town centre shop development opportunity", assetType: "Office" });
    const ignored = deal({ id: "ignored", isImported: true, title: "Suburban office suite", assetType: "Office" });
    const demo = deal({ id: "demo", isImported: false, title: "High Street retail with upper floors" });

    const diagnostics = buildHighStreetConversionDiagnostics([strong, nearMiss, ignored, demo]);

    expect(diagnostics.totalImportedDeals).toBe(3);
    expect(diagnostics.score20Plus).toBe(2);
    expect(diagnostics.score30Plus).toBe(2);
    expect(diagnostics.score40Plus).toBe(1);
    expect(diagnostics.score50Plus).toBe(1);
    expect(diagnostics.nearMisses.map((entry) => entry.deal.id)).toEqual(["near"]);
    expect(diagnostics.nearMisses[0].matchedSignals).toEqual(expect.arrayContaining(["town centre", "development opportunity"]));
  });

  it("parses unknown modes back to general investment", () => {
    expect(parseStrategyMode("high-street-conversion")).toBe("high-street-conversion");
    expect(parseStrategyMode("not-real")).toBe("general-investment");
    expect(filterDealsForStrategyMode([deal()], "general-investment")).toHaveLength(1);
  });
});
