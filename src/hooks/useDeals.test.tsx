import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const rows = vi.hoisted(() => ({
  deals: [{
    id: "ds-live",
    title: "Live deal",
    location: "Leeds",
    region: "Yorkshire",
    asset_type: "Industrial",
    source: "Private treaty",
    guide_price: 1000000,
    passing_rent: 80000,
    sqft: 10000,
    gross_yield: 8,
    net_initial_yield: 7.5,
    reversionary_yield: 8.5,
    wault: 5,
    lease_length: 6,
    tenant: "Tenant Ltd",
    covenant_strength: "Good",
    tenant_health_score: 80,
    rent_sustainability: "Market rent",
    rent_review: "Upward-only",
    price_per_sqft: 100,
    planning_upside_score: 50,
    void_risk_score: 20,
    exit_yield_sensitivity: "Moderate",
    cashflow_after_debt: 10000,
    return_on_equity: 9,
    auction_guide_risk: null,
    red_flags: [],
    main_risk_flag: "None",
    score: 82,
    rating: "green",
    score_breakdown: { incomeQuality: 80, tenantSecurity: 80, marketPricing: 80, upside: 80, riskExit: 80 },
    insights: { mispricing: "", couldGoWrong: "", askAgent: "", negotiation: "" },
    thumbnail: "",
    posted_at: "2026-05-01T00:00:00Z",
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
  }],
  links: [{
    deal_id: "ds-live",
    source_url: "https://www.rightmove.co.uk/properties/123",
    import_sources: {
      name: "Rightmove Commercial Bournemouth",
      source_type: "apify_rightmove_commercial",
    },
  }],
}));

vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: true,
  requireSupabase: () => ({
    from: (table: string) => {
      if (table === "deals") {
        return {
          select: () => ({
            order: async () => ({ data: rows.deals, error: null }),
          }),
        };
      }
      return {
        select: () => ({
          in: async () => ({ data: rows.links, error: null }),
        }),
      };
    },
  }),
}));

import { useDeals } from "@/hooks/useDeals";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useDeals", () => {
  it("loads and maps deals from Supabase", async () => {
    const { result } = renderHook(() => useDeals(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]).toMatchObject({
      id: "ds-live",
      title: "Live deal",
      assetType: "Industrial",
      netInitialYield: 7.5,
      importSourceName: "Rightmove Commercial Bournemouth",
      sourceUrl: "https://www.rightmove.co.uk/properties/123",
    });
  });
});
