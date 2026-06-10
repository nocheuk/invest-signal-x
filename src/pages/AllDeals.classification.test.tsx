import { render, screen, within } from "@testing-library/react";
import type React from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Deal } from "@/lib/deals";
import AllDeals from "@/pages/AllDeals";

const dealsState: { deals: Deal[] } = { deals: [] };

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/DealCard", () => ({
  DealCard: ({ deal }: { deal: Deal }) => <div data-testid="feature-deal">{deal.title}</div>,
}));

vi.mock("@/components/DealRow", () => ({
  DealRow: ({ deal }: { deal: Deal }) => <div data-testid="deal-row">{deal.title}</div>,
}));

vi.mock("@/components/StrategyControl", () => ({
  StrategyControl: () => <button type="button">Strategy</button>,
}));

vi.mock("@/components/StrategyOptimiserModal", () => ({
  StrategyOptimiserModal: () => null,
}));

vi.mock("@/hooks/useRealDeals", () => ({
  useRealDeals: () => ({
    deals: dealsState.deals,
    dealsQuery: { isError: false, isLoading: false },
  }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({ data: { preferences: { onboarding_completed: true } } }),
}));

vi.mock("@/lib/watchlist", async () => {
  const actual = await vi.importActual<typeof import("@/lib/watchlist")>("@/lib/watchlist");
  return {
    ...actual,
    useWatchlist: () => ({ ids: [], pipelineItems: {}, pipelineCounts: {} }),
  };
});

vi.mock("@/lib/strategy", async () => {
  const actual = await vi.importActual<typeof import("@/lib/strategy")>("@/lib/strategy");
  return {
    ...actual,
    useStrategy: () => ({ weights: { yield: 70, discount: 70, growth: 70, risk: 70, demand: 70 } }),
  };
});

vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: true,
}));

function deal(overrides: Partial<Deal> = {}): Deal {
  return {
    id: "imp-base",
    title: "Base Deal",
    location: "Bournemouth, BH1",
    region: "South West",
    assetType: "Retail",
    source: "Auction",
    guidePrice: 700000,
    passingRent: 62000,
    sqft: 3500,
    grossYield: 8.8,
    netInitialYield: 8.2,
    reversionaryYield: 8.2,
    wault: 0,
    leaseLength: 0,
    tenant: "Unknown",
    covenantStrength: "Moderate",
    tenantHealthScore: 0,
    rentSustainability: "Market rent",
    rentReview: "None",
    pricePerSqft: 200,
    planningUpsideScore: 35,
    voidRiskScore: 40,
    exitYieldSensitivity: "Moderate",
    cashflowAfterDebt: 0,
    returnOnEquity: 0,
    redFlags: [],
    mainRiskFlag: "Requires due diligence",
    score: 65,
    rating: "amber",
    dataConfidenceScore: 85,
    confidenceLevel: "high",
    scoreBreakdown: { incomeQuality: 70, tenantSecurity: 65, marketPricing: 65, upside: 35, riskExit: 80 },
    insights: { mispricing: "", couldGoWrong: "", askAgent: "", negotiation: "" },
    thumbnail: "",
    postedAt: "2026-06-01T09:00:00Z",
    isImported: true,
    importSourceName: "Rightmove Commercial",
    sourceUrl: "https://example.com/listing",
    ...overrides,
  };
}

function renderAllDeals(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AllDeals />
    </MemoryRouter>
  );
}

describe("AllDeals classification filters", () => {
  beforeEach(() => {
    dealsState.deals = [
      deal({ id: "top", title: "Top Opportunity Deal", score: 82, rating: "green", dataConfidenceScore: 86 }),
      deal({ id: "strong", title: "Strong Opportunity Deal", score: 73, rating: "amber", dataConfidenceScore: 85 }),
      deal({ id: "diligence", title: "Diligence Deal", score: 65, rating: "amber", dataConfidenceScore: 85 }),
      deal({ id: "low", title: "Low Priority Deal", score: 30, rating: "red", dataConfidenceScore: 30, confidenceLevel: "low", guidePrice: 0 }),
    ];
  });

  it.each([
    ["/deals?classification=verified-green", "Top Opportunity", "Top Opportunity Deal"],
    ["/deals?classification=green-candidate", "Strong Opportunity", "Strong Opportunity Deal"],
    ["/deals?classification=requires-due-diligence", "Requires Due Diligence", "Diligence Deal"],
    ["/deals?classification=low-priority", "Low Priority", "Low Priority Deal"],
  ])("matches KPI/filter/displayed counts for %s", (path, chipLabel, expectedTitle) => {
    renderAllDeals(path);

    expect(screen.getAllByText(chipLabel).length).toBeGreaterThanOrEqual(1);
    const rows = screen.getAllByTestId("deal-row");
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByText(expectedTitle)).toBeInTheDocument();
    expect(within(screen.getByTestId("metric-filtered-deals")).getByText("1")).toBeInTheDocument();
  });
});
