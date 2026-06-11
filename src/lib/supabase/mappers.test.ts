import { describe, expect, it } from "vitest";
import { mapDealRow } from "@/lib/supabase/mappers";
import type { Database } from "@/lib/supabase/types";

type DealRow = Database["public"]["Tables"]["deals"]["Row"];

const baseRow: DealRow = {
  id: "imp-rightmove",
  title: "Rightmove listing",
  location: "Bournemouth, BH1",
  region: "All UK",
  asset_type: "Retail",
  source: "Private treaty",
  guide_price: 1000000,
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
  main_risk_flag: "Rightmove import awaiting analyst review",
  score: 39,
  rating: "red",
  score_breakdown: { incomeQuality: 0, tenantSecurity: 60, marketPricing: 45, upside: 40, riskExit: 60 },
  insights: { mispricing: "", couldGoWrong: "", askAgent: "", negotiation: "" },
  thumbnail: "",
  posted_at: "2026-05-08T00:00:00Z",
  created_at: "2026-05-08T00:00:00Z",
  updated_at: "2026-05-08T00:00:00Z",
};

describe("mapDealRow", () => {
  it("maps imported Rightmove source metadata and marks sparse listings as severe review items", () => {
    const deal = mapDealRow(baseRow, {
      sourceUrl: "https://www.rightmove.co.uk/properties/123",
      imageUrl: "https://media.rightmove.co.uk/property.jpg",
      importSourceName: "Rightmove Commercial Bournemouth",
      importSourceType: "apify_rightmove_commercial",
    });

    expect(deal).toMatchObject({
      id: "imp-rightmove",
      importSourceName: "Rightmove Commercial Bournemouth",
      sourceUrl: "https://www.rightmove.co.uk/properties/123",
      imageUrl: "https://media.rightmove.co.uk/property.jpg",
      needsReview: true,
      mainRiskFlag: "Income cannot be verified without passing rent",
      rating: "red",
      confidenceLevel: "medium",
    });
    expect(deal.scoreReasons?.missingDataWarnings).toContain("Passing rent missing");
  });

  it("overlays enriched source-detail fields before rescoring imported deals", () => {
    const deal = mapDealRow(baseRow, {
      sourceUrl: "https://www.rightmove.co.uk/properties/123",
      importSourceName: "Rightmove Commercial",
      importSourceType: "custom_rightmove_commercial",
      enrichment: {
        id: "enrich-1",
        deal_id: "imp-rightmove",
        source_url: "https://www.rightmove.co.uk/properties/123",
        status: "enriched",
        attempt_count: 1,
        last_attempted_at: "2026-06-10T08:00:00Z",
        next_attempt_at: null,
        last_error: null,
        tenant_name: "National Retailer Ltd",
        passing_rent: 85000,
        lease_length: 8,
        wault: 7,
        epc_rating: "B",
        sqft: 4000,
        guide_price: 1000000,
        auction_info: {},
        vat_info: "VAT applicable",
        investment_summary: "Investment let to National Retailer Ltd.",
        extracted_payload: {
          leaseExpiryText: "May 2038",
          rentReviews: [{ year: 2028, amount: 894657 }, { year: 2033, amount: 1037175 }],
          covenantStrength: "Strong",
          covenantVerified: true,
        },
        created_at: "2026-06-10T08:00:00Z",
        updated_at: "2026-06-10T08:00:00Z",
      },
    });

    expect(deal).toMatchObject({
      passingRent: 85000,
      tenant: "National Retailer Ltd",
      wault: 7,
      leaseLength: 8,
      sqft: 4000,
      enrichment: {
        status: "Enriched",
        epcRating: "B",
        vatInfo: "VAT applicable",
        extractedPayload: {
          leaseExpiryText: "May 2038",
        },
      },
    });
    expect(deal.score).toBeGreaterThan(0);
    expect(deal.scoreReasons?.missingDataWarnings).not.toContain("Passing rent missing");
    expect(deal.scoreReasons?.missingDataWarnings).not.toContain("Tenant covenant unknown");
    expect(deal.scoreReasons?.missingDataWarnings).not.toContain("Lease length/WAULT missing");
    expect(deal.redFlags).toEqual(expect.arrayContaining([
      "Lease expiry extracted: May 2038",
      "Rent reviews extracted: 2028: £894,657 pa; 2033: £1,037,175 pa",
    ]));
  });
});
