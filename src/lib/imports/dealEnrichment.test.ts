import { describe, expect, it } from "vitest";
import {
  extractDealEnrichment,
  runDealEnrichment,
} from "../../../scripts/lib/dealEnrichment.mjs";

describe("deal enrichment engine", () => {
  it("extracts investment fields from source detail HTML", () => {
    const enrichment = extractDealEnrichment({
      sourceUrl: "https://example.com/lot-12",
      sourceName: "Allsop",
      html: `
        <main>
          <h1>Freehold Retail Investment</h1>
          <p>Investment let to National Retailer Ltd producing passing rent £82,500 per annum.</p>
          <p>Guide Price £950,000. Floor area 4,250 sq ft. WAULT 5.4 years.</p>
          <p>Lease term 10 years from 2024. EPC rating B. VAT is applicable.</p>
          <p>Lot 12. Auction date: 17 June 2026.</p>
        </main>
      `,
    });

    expect(enrichment).toMatchObject({
      tenantName: "National Retailer Ltd",
      passingRent: 82500,
      guidePrice: 950000,
      sqft: 4250,
      wault: 5.4,
      leaseLength: 10,
      epcRating: "B",
      vatInfo: "VAT is applicable",
      auctionInfo: { lotNumber: "12", auctionDate: "17 June 2026" },
    });
    expect(enrichment.investmentSummary).toContain("Investment let to National Retailer Ltd");
  });

  it("stores enrichment and refreshes the linked deal without blocking imports", async () => {
    const supabase = createEnrichmentSupabaseMock();
    const result = await runDealEnrichment({
      supabase,
      limit: 1,
      now: new Date("2026-06-10T08:00:00Z"),
      fetchImpl: async () => response(`
        <p>Investment let to Tenant Ltd producing passing rent £80,000 per annum.</p>
        <p>Guide Price £1,000,000. Floor area 5,000 sq ft. WAULT 6 years.</p>
      `),
    });

    expect(result).toMatchObject({ total: 1, enriched: 1, failed: 0 });
    expect(supabase.upserts.at(-1)).toMatchObject({
      deal_id: "imp-1",
      status: "enriched",
      passing_rent: 80000,
      guide_price: 1000000,
      sqft: 5000,
      wault: 6,
    });
    expect(supabase.dealUpdates[0]).toMatchObject({
      passing_rent: 80000,
      guide_price: 1000000,
      sqft: 5000,
      tenant: "Tenant Ltd",
    });
  });

  it("marks failed enrichment for retry later", async () => {
    const supabase = createEnrichmentSupabaseMock();
    const result = await runDealEnrichment({
      supabase,
      limit: 1,
      now: new Date("2026-06-10T08:00:00Z"),
      fetchImpl: async () => response("<html><body><p>No useful facts here.</p></body></html>"),
    });

    expect(result).toMatchObject({ total: 1, enriched: 0, failed: 1 });
    expect(supabase.upserts.at(-1)).toMatchObject({
      deal_id: "imp-1",
      status: "failed",
      last_error: "No enrichment fields found on source detail page.",
      next_attempt_at: "2026-06-11T08:00:00.000Z",
    });
  });
});

function response(html: string) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => html,
  };
}

function createEnrichmentSupabaseMock() {
  const upserts: unknown[] = [];
  const dealUpdates: unknown[] = [];
  return {
    upserts,
    dealUpdates,
    from(table: string) {
      if (table === "deal_source_links") {
        return {
          select() { return this; },
          not() { return this; },
          order() { return this; },
          limit: async () => ({
            data: [{
              deal_id: "imp-1",
              source_url: "https://example.com/deal",
              import_sources: { name: "Allsop", source_type: "auction_scraper" },
              deals: dealRow(),
            }],
            error: null,
          }),
        };
      }
      if (table === "deal_enrichments") {
        return {
          select() { return this; },
          in: async () => ({ data: [], error: null }),
          upsert(payload: unknown) {
            upserts.push(payload);
            return { error: null };
          },
        };
      }
      if (table === "deals") {
        return {
          update(payload: unknown) {
            dealUpdates.push(payload);
            return {
              eq: async () => ({ error: null }),
            };
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };
}

function dealRow() {
  return {
    id: "imp-1",
    title: "Retail Investment",
    location: "Bournemouth BH1",
    region: "Dorset",
    asset_type: "Retail",
    source: "Auction",
    guide_price: 900000,
    passing_rent: 0,
    sqft: 0,
    gross_yield: 0,
    net_initial_yield: 0,
    reversionary_yield: 0,
    wault: 0,
    lease_length: 0,
    tenant: "Unknown",
    covenant_strength: "Moderate",
    tenant_health_score: 60,
    rent_sustainability: "Market rent",
    rent_review: "None",
    price_per_sqft: 0,
    planning_upside_score: 40,
    void_risk_score: 40,
    exit_yield_sensitivity: "Moderate",
    cashflow_after_debt: 0,
    return_on_equity: 0,
    auction_guide_risk: null,
    red_flags: [],
    main_risk_flag: "Imported",
    score: 50,
    rating: "red",
    score_breakdown: {},
    insights: {},
    thumbnail: "",
    posted_at: "2026-06-10T07:00:00Z",
  };
}
