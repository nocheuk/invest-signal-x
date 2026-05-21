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
  it("maps imported Rightmove source metadata and marks sparse listings for review", () => {
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
      mainRiskFlag: "Needs review",
      rating: "red",
      confidenceLevel: "medium",
    });
    expect(deal.scoreReasons?.missingDataWarnings).toContain("Passing rent missing");
  });
});
