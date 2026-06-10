import { describe, expect, it } from "vitest";
import type { Deal } from "@/lib/deals";
import { buildBeforeEnrichmentDeal, buildEnrichmentImpactReport } from "@/lib/enrichmentImpact";

describe("enrichment impact report", () => {
  it("counts extracted fields and classification movement", () => {
    const strongAfter = deal({
      id: "imp-strong",
      importSourceName: "Allsop",
      score: 74,
      dataConfidenceScore: 78,
      guidePrice: 1000000,
      passingRent: 85000,
      netInitialYield: 8.5,
      tenant: "National Retailer Ltd",
      wault: 6,
      leaseLength: 8,
      sqft: 4000,
    });
    const lowAfter = deal({
      id: "imp-low",
      importSourceName: "Rightmove Commercial",
      score: 45,
      dataConfidenceScore: 40,
      guidePrice: 700000,
      passingRent: 0,
      netInitialYield: 0,
      tenant: "Unknown",
    });

    const report = buildEnrichmentImpactReport([
      {
        deal: strongAfter,
        sourceName: "Allsop",
        normalizedPayload: {
          title: strongAfter.title,
          location: strongAfter.location,
          assetType: strongAfter.assetType,
          source: strongAfter.source,
          sourceUrl: strongAfter.sourceUrl,
          guidePrice: 1000000,
          passingRent: 0,
          netInitialYield: 0,
          tenant: "Unknown",
          sqft: 0,
          wault: 0,
          leaseLength: 0,
        },
        enrichment: {
          status: "enriched",
          tenantName: "National Retailer Ltd",
          passingRent: 85000,
          leaseLength: 8,
          wault: 6,
          epcRating: "B",
          sqft: 4000,
        },
      },
      {
        deal: lowAfter,
        sourceName: "Rightmove Commercial",
        normalizedPayload: {
          title: lowAfter.title,
          location: lowAfter.location,
          assetType: lowAfter.assetType,
          source: lowAfter.source,
          sourceUrl: lowAfter.sourceUrl,
          guidePrice: 700000,
        },
        enrichment: { status: "failed" },
      },
    ]);

    expect(report).toMatchObject({
      totalEnriched: 1,
      tenantFound: 1,
      rentFound: 1,
      leaseFound: 1,
      waultFound: 1,
      epcFound: 1,
      areaFound: 1,
      dealsImproved: 1,
      classificationUplift: 1,
    });
    expect(report.movementMatrix["low-priority"]["green-candidate"]).toBe(1);
    expect(report.sourceImpact.find((source) => source.source === "Allsop")).toMatchObject({
      total: 1,
      enriched: 1,
      successRate: 100,
      classificationUplift: 1,
      fieldsExtracted: {
        tenant: 1,
        rent: 1,
        lease: 1,
        wault: 1,
        epc: 1,
        area: 1,
      },
    });
    expect(report.sourceImpact.find((source) => source.source === "Rightmove Commercial")).toMatchObject({
      total: 1,
      enriched: 0,
      successRate: 0,
    });
  });

  it("rebuilds the before-enrichment classification from raw import payload", () => {
    const after = deal({
      score: 74,
      dataConfidenceScore: 78,
      guidePrice: 1000000,
      passingRent: 85000,
      netInitialYield: 8.5,
      tenant: "Tenant Ltd",
      wault: 5,
      leaseLength: 6,
    });
    const before = buildBeforeEnrichmentDeal({
      deal: after,
      sourceName: "Allsop",
      normalizedPayload: {
        title: after.title,
        location: after.location,
        assetType: after.assetType,
        source: after.source,
        sourceUrl: after.sourceUrl,
        guidePrice: 1000000,
        tenant: "Unknown",
      },
      enrichment: { status: "enriched" },
    });

    expect(before.passingRent).toBe(0);
    expect(before.tenant).toBe("Unknown");
    expect(before.score).toBeLessThan(after.score);
  });
});

function deal(overrides: Partial<Deal> = {}): Deal {
  return {
    id: "imp-deal",
    title: "Retail investment",
    location: "Bournemouth BH1",
    region: "Dorset",
    assetType: "Retail",
    source: "Auction",
    sourceUrl: "https://example.com/deal",
    importSourceName: "Allsop",
    isImported: true,
    guidePrice: 1000000,
    passingRent: 0,
    sqft: 0,
    grossYield: 0,
    netInitialYield: 0,
    reversionaryYield: 0,
    wault: 0,
    leaseLength: 0,
    tenant: "Unknown",
    covenantStrength: "Moderate",
    tenantHealthScore: 60,
    rentSustainability: "Market rent",
    rentReview: "None",
    pricePerSqft: 0,
    planningUpsideScore: 40,
    voidRiskScore: 40,
    exitYieldSensitivity: "Moderate",
    cashflowAfterDebt: 0,
    returnOnEquity: 0,
    redFlags: [],
    mainRiskFlag: "Imported",
    score: 45,
    rating: "red",
    dataConfidenceScore: 40,
    confidenceLevel: "low",
    scoreBreakdown: { incomeQuality: 10, tenantSecurity: 60, marketPricing: 45, upside: 40, riskExit: 60 },
    insights: { mispricing: "", couldGoWrong: "", askAgent: "", negotiation: "" },
    thumbnail: "",
    postedAt: "2026-06-10T08:00:00Z",
    ...overrides,
  };
}
