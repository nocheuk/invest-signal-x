import { describe, expect, it } from "vitest";
import type { SourceScanRun } from "@/hooks/useNationalScanStatus";
import type { Deal } from "@/lib/deals";
import { buildSourceHealth, investorSourceStatus, splitInvestorSourceRows, summarizeSourceHealth } from "@/lib/sourceHealth";

describe("source health", () => {
  it("counts inventory quality and classifies source status", () => {
    const now = new Date("2026-06-10T12:00:00Z");
    const rows = buildSourceHealth({
      now,
      sources: ["Rightmove Commercial", "Savills Commercial", "Zoopla Commercial", "Pugh Auctions"],
      deals: [
        deal({ id: "rightmove-top", source: "Rightmove Commercial", score: 82, confidence: 86, postedAt: "2026-06-10T08:00:00Z" }),
        deal({ id: "rightmove-strong", source: "Rightmove Commercial", score: 74, confidence: 78, postedAt: "2026-06-09T08:00:00Z" }),
        deal({ id: "savills-low", source: "Savills Commercial", score: 42, confidence: 40, guidePrice: 0, postedAt: "2026-06-10T08:00:00Z" }),
      ],
      scanRuns: [
        scan({ id: "rightmove-ok", sourceName: "Rightmove Commercial", status: "completed", inserted: 2, existing: 4 }),
        scan({ id: "savills-empty", sourceName: "Savills Commercial", status: "completed", inserted: 0, existing: 0 }),
        scan({ id: "zoopla-blocked", sourceName: "Zoopla Commercial", status: "failed", errorMessage: "Fetch failed: 403 Forbidden" }),
      ],
    });

    expect(rows.find((row) => row.source === "Rightmove Commercial")).toMatchObject({
      status: "Healthy",
      isDue: true,
      cooldownReason: "Runs every scan",
      totalImportedDeals: 2,
      newDealsToday: 1,
      inventoryContributionPct: 66.7,
      topOpportunityCount: 1,
      strongOpportunityCount: 1,
      lastInsertedCount: 2,
    });
    expect(rows.find((row) => row.source === "Savills Commercial")).toMatchObject({
      status: "Warning",
      warningReasons: expect.arrayContaining(["Latest scan returned 0 usable results"]),
    });
    expect(rows.find((row) => row.source === "Zoopla Commercial")).toMatchObject({
      status: "Blocked",
      isDue: false,
      scheduleGroup: "problematic",
      consecutiveFailures: 1,
      cooldownReason: "Blocked backoff",
      warningReasons: expect.arrayContaining(["Anti-bot or access block detected"]),
    });
    expect(rows.find((row) => row.source === "Pugh Auctions")).toMatchObject({
      status: "Disabled",
      warningReasons: expect.arrayContaining(["No scan run recorded", "No imported inventory"]),
    });
    expect(summarizeSourceHealth(rows)).toEqual({
      Healthy: 1,
      Warning: 1,
      Blocked: 1,
      Disabled: 1,
    });
    expect(investorSourceStatus(rows.find((row) => row.source === "Rightmove Commercial")!)).toBe("Active");
    expect(investorSourceStatus(rows.find((row) => row.source === "Savills Commercial")!)).toBe("Limited data");
    expect(investorSourceStatus(rows.find((row) => row.source === "Zoopla Commercial")!)).toBe("Updating soon");
    expect(investorSourceStatus(rows.find((row) => row.source === "Pugh Auctions")!)).toBe("Monitoring");
    expect(splitInvestorSourceRows(rows)).toMatchObject({
      visibleRows: expect.arrayContaining([expect.objectContaining({ source: "Rightmove Commercial" })]),
      monitoredRows: expect.arrayContaining([expect.objectContaining({ source: "Zoopla Commercial" }), expect.objectContaining({ source: "Pugh Auctions" })]),
    });
  });
});

function scan(overrides: Partial<SourceScanRun>): SourceScanRun {
  return {
    id: "scan",
    sourceName: "Rightmove Commercial",
    locationQuery: "England",
    status: "completed",
    startedAt: "2026-06-10T05:00:00Z",
    finishedAt: "2026-06-10T05:04:00Z",
    inserted: 0,
    existing: 0,
    failed: 0,
    skippedDuplicate: 0,
    skippedRentOnly: 0,
    skippedPoa: 0,
    errorMessage: null,
    ...overrides,
  };
}

function deal({
  id,
  source,
  score,
  confidence,
  guidePrice = 500000,
  postedAt,
}: {
  id: string;
  source: string;
  score: number;
  confidence: number;
  guidePrice?: number;
  postedAt: string;
}): Deal {
  return {
    id,
    title: `${source} deal`,
    location: "Bournemouth, BH1",
    region: "Dorset",
    assetType: "Retail",
    source: "Private treaty",
    sourceUrl: `https://example.com/${id}`,
    importSourceName: source,
    isImported: true,
    guidePrice,
    passingRent: guidePrice > 0 ? 50000 : 0,
    sqft: 2000,
    grossYield: guidePrice > 0 ? 10 : 0,
    netInitialYield: guidePrice > 0 ? 9 : 0,
    reversionaryYield: 9,
    wault: 0,
    leaseLength: 0,
    tenant: "Unknown",
    covenantStrength: "Moderate",
    tenantHealthScore: 60,
    rentSustainability: "Market rent",
    rentReview: "None",
    pricePerSqft: 250,
    planningUpsideScore: 40,
    voidRiskScore: 40,
    exitYieldSensitivity: "Moderate",
    cashflowAfterDebt: 0,
    returnOnEquity: 0,
    redFlags: [],
    mainRiskFlag: "Imported",
    score,
    rating: score >= 78 ? "green" : score >= 60 ? "amber" : "red",
    dataConfidenceScore: confidence,
    confidenceLevel: confidence >= 80 ? "high" : confidence >= 60 ? "medium" : "low",
    scoreBreakdown: {
      incomeQuality: 70,
      tenantSecurity: 60,
      marketPricing: 60,
      upside: 40,
      riskExit: 60,
    },
    insights: {
      mispricing: "",
      couldGoWrong: "",
      askAgent: "",
      negotiation: "",
    },
    thumbnail: "",
    postedAt,
  };
}
