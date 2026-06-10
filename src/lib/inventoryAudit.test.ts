import { describe, expect, it } from "vitest";
import type { Deal } from "@/lib/deals";
import { buildInventoryAudit, formatInventoryAuditReport } from "@/lib/inventoryAudit";

function deal(overrides: Partial<Deal>): Deal {
  return {
    id: "imp-1",
    title: "Imported deal",
    location: "Leeds, LS1",
    region: "Yorkshire",
    assetType: "Retail",
    source: "Private treaty",
    guidePrice: 1000000,
    passingRent: 90000,
    sqft: 10000,
    grossYield: 9,
    netInitialYield: 8.4,
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
    score: 73,
    rating: "amber",
    scoreBreakdown: { incomeQuality: 70, tenantSecurity: 60, marketPricing: 70, upside: 40, riskExit: 60 },
    insights: { mispricing: "", couldGoWrong: "", askAgent: "", negotiation: "" },
    thumbnail: "",
    postedAt: "2026-06-04T09:00:00Z",
    isImported: true,
    dataConfidenceScore: 80,
    confidenceLevel: "high",
    ...overrides,
  };
}

describe("inventory audit", () => {
  it("counts sources, classifications, recent additions, and scan progress", () => {
    const metrics = buildInventoryAudit({
      now: new Date("2026-06-04T12:00:00Z"),
      scanStatus: {
        id: "scan-1",
        sourceName: "Rightmove Commercial",
        locationQuery: "London",
        startedAt: "2026-06-04T05:00:00Z",
        finishedAt: "2026-06-04T05:05:00Z",
        locationsScanned: ["London"],
        totalConfiguredLocations: 160,
        nextIndex: 12,
        estimatedFullCycleDays: 10,
        scanCycleProgress: 8,
        totalDeals: 4,
        totalRightmoveDeals: 1,
        totalAcuitusDeals: 1,
        totalEddisonsDeals: 1,
        totalAllsopDeals: 1,
        locationsCompletedInCurrentCycle: 12,
        lastSuccessfulScanDurationMs: 300000,
        lastScanInsertedCount: 2,
      },
      deals: [
        deal({ id: "imp-rightmove", importSourceName: "Rightmove Commercial", score: 82, rating: "green", dataConfidenceScore: 86 }),
        deal({ id: "imp-acuitus", importSourceName: "Acuitus", score: 73, rating: "amber", dataConfidenceScore: 80, postedAt: "2026-06-03T09:00:00Z" }),
        deal({ id: "imp-eddisons", importSourceName: "Eddisons", score: 65, rating: "amber", dataConfidenceScore: 85, sourceUrl: "https://example.com/eddisons" }),
        deal({ id: "imp-allsop", importSourceName: "Allsop", score: 72, rating: "amber", dataConfidenceScore: 78 }),
        deal({ id: "imp-red", importSourceName: "Rightmove Commercial", score: 40, rating: "red", dataConfidenceScore: 50, postedAt: "2026-05-20T09:00:00Z" }),
      ],
    });

    expect(metrics).toMatchObject({
      totalDeals: 5,
      totalImportedDeals: 5,
      rightmoveDeals: 2,
      acuitusDeals: 1,
      eddisonsDeals: 1,
      allsopDeals: 1,
      verifiedGreens: 1,
      greenCandidates: 2,
      requiresDueDiligence: 1,
      lowPriority: 1,
      addedToday: 3,
      addedThisWeek: 4,
      locationsCompletedInCurrentCycle: 12,
      totalConfiguredLocations: 160,
    });
  });

  it("formats a one-click admin report", () => {
    const report = formatInventoryAuditReport({
      totalDeals: 10,
      totalImportedDeals: 9,
      rightmoveDeals: 4,
      acuitusDeals: 3,
      eddisonsDeals: 2,
      allsopDeals: 1,
      verifiedGreens: 1,
      greenCandidates: 2,
      requiresDueDiligence: 5,
      lowPriority: 2,
      addedToday: 3,
      addedThisWeek: 7,
      locationsCompletedInCurrentCycle: 12,
      totalConfiguredLocations: 160,
    });

    expect(report).toContain("Total deals: 10");
    expect(report).toContain("Eddisons deals: 2");
    expect(report).toContain("Allsop deals: 1");
    expect(report).toContain("Top Opportunities: 1");
    expect(report).toContain("Strong Opportunities: 2");
    expect(report).toContain("Requires Due Diligence: 5");
    expect(report).toContain("Low Priority: 2");
    expect(report).toContain("Locations completed in current scan cycle: 12/160");
  });
});
