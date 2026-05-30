import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Deal } from "@/lib/deals";
import Dashboard from "@/pages/Dashboard";

const dealsState = vi.hoisted(() => ({
  deals: [] as Deal[],
}));

const savedSearchState = vi.hoisted(() => ({
  saveSearch: vi.fn(),
}));

const nationalScanState = vi.hoisted(() => ({
  data: {
    id: "scan-1",
    sourceName: "Rightmove Commercial",
    locationQuery: "Bournemouth",
    startedAt: "2026-05-28T04:59:00Z",
    finishedAt: "2026-05-28T05:03:00Z",
  },
  isLoading: false,
  isError: false,
}));

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/DealCard", () => ({
  DealCard: () => <div>Deal card</div>,
}));

vi.mock("@/components/DealRow", () => ({
  DealRow: ({ deal }: { deal: { title: string } }) => <div>{deal.title}</div>,
}));

vi.mock("@/components/StrategyControl", () => ({
  StrategyControl: () => <div>Strategy control</div>,
}));

vi.mock("@/components/StrategyOptimiserModal", () => ({
  StrategyOptimiserModal: () => null,
}));

vi.mock("@/hooks/useDeals", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useDeals")>("@/hooks/useDeals");
  return {
    ...actual,
    useDeals: () => ({ data: dealsState.deals, isLoading: false, isError: false }),
  };
});

vi.mock("@/lib/watchlist", () => ({
  useWatchlist: () => ({ ids: [] }),
}));

vi.mock("@/lib/strategy", async () => {
  const actual = await vi.importActual<typeof import("@/lib/strategy")>("@/lib/strategy");
  return {
    ...actual,
    useStrategy: () => ({ weights: { income: 25, location: 20, tenant: 20, upside: 20, risk: 15 } }),
    personalisedScore: (deal: { score: number }) => deal.score,
  };
});

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    isConfigured: true,
    loading: false,
    session: { access_token: "user-token" },
    user: { id: "user-1", email: "user@example.com", app_metadata: { role: "member" }, user_metadata: {} },
  }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({ data: { full_name: "Admin User" } }),
}));

vi.mock("@/hooks/useSavedSearches", () => ({
  useSavedSearches: () => ({
    savedSearches: [],
    isSaving: false,
    saveSearch: savedSearchState.saveSearch,
  }),
}));

vi.mock("@/hooks/useNationalScanStatus", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useNationalScanStatus")>("@/hooks/useNationalScanStatus");
  return {
    ...actual,
    useNationalScanStatus: () => nationalScanState,
  };
});

vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: true,
}));

function dashboardDeal(overrides: Partial<Deal> = {}): Deal {
  return {
    id: "imp-live",
    title: "Rightmove Bournemouth Office",
    location: "Bournemouth, BH1",
    region: "South West",
    assetType: "Office",
    source: "Private treaty",
    guidePrice: 350000,
    passingRent: 42000,
    sqft: 30203,
    grossYield: 12,
    netInitialYield: 8,
    reversionaryYield: 0,
    wault: 0,
    leaseLength: 0,
    tenant: "Unknown",
    covenantStrength: "Moderate",
    tenantHealthScore: 50,
    rentSustainability: "Market rent",
    rentReview: "None",
    pricePerSqft: 12,
    planningUpsideScore: 40,
    voidRiskScore: 40,
    exitYieldSensitivity: "Moderate",
    cashflowAfterDebt: 0,
    returnOnEquity: 0,
    redFlags: [],
    mainRiskFlag: "Needs review",
    score: 82,
    rating: "green",
    scoreBreakdown: { incomeQuality: 80, tenantSecurity: 80, marketPricing: 80, upside: 80, riskExit: 80 },
    insights: { mispricing: "", couldGoWrong: "", askAgent: "", negotiation: "" },
    thumbnail: "",
    postedAt: "2026-05-20T00:00:00Z",
    isImported: true,
    importSourceName: "Rightmove Commercial",
    needsReview: false,
    ...overrides,
  };
}

describe("Dashboard live location search", () => {
  beforeEach(() => {
    dealsState.deals = [];
    savedSearchState.saveSearch.mockReset();
    nationalScanState.data = {
      id: "scan-1",
      sourceName: "Rightmove Commercial",
      locationQuery: "Bournemouth",
      startedAt: "2026-05-28T04:59:00Z",
      finishedAt: "2026-05-28T05:03:00Z",
    };
    nationalScanState.isLoading = false;
    nationalScanState.isError = false;
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        locationQuery: "Bournemouth",
        sourceName: "Rightmove Commercial",
        dryRun: false,
        sources: {
          rightmove: { source: "Rightmove Commercial", inserted: 2, existing: 1, failed: 1, skippedDuplicate: 1, skippedRentOnly: 5, skippedPoa: 1, failedMissingPrice: 1, processed: 2, total: 9, unique: 3 },
          acuitus: { source: "Acuitus", inserted: 4, existing: 11, failed: 0, skippedDuplicate: 11, processed: 4, total: 15, unique: 15 },
        },
        total: 4,
        unique: 4,
        imported: 6,
        existing: 12,
        refreshed: 12,
        failed: 1,
        skippedDuplicate: 1,
        skippedRentOnly: 5,
        skippedPoa: 1,
        failedMissingPrice: 1,
        processed: 2,
      }),
    })));
  });

  it("shows an empty-location CTA and refreshes deals after import completes", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

    fireEvent.change(screen.getByLabelText("Location filter"), { target: { value: "Bournemouth" } });

    expect(screen.getByText("Search live sources for this location")).toBeInTheDocument();
    expect(screen.queryByText(/admin-only/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /refresh live sources/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/location-search", expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Bearer user-token" }),
      }));
      expect(invalidateSpy).toHaveBeenCalled();
    });
    expect(await screen.findByText(/Scanned Rightmove Commercial and Acuitus. Added 6 new deals, refreshed 12 existing deals./)).toBeInTheDocument();
    expect(screen.getByText(/Skipped 5 rent-only listings./)).toBeInTheDocument();
  });

  it("hides seeded demo deals and fake dashboard controls in Supabase mode", () => {
    dealsState.deals = [
      {
        id: "ds-demo",
        title: "Demo Tesco",
        location: "Sheffield, S10",
        region: "Yorkshire",
        assetType: "Retail",
        source: "Private treaty",
        guidePrice: 1000000,
        passingRent: 80000,
        sqft: 10000,
        grossYield: 8,
        netInitialYield: 7.4,
        reversionaryYield: 8,
        wault: 5,
        leaseLength: 5,
        tenant: "Tesco",
        covenantStrength: "Good",
        tenantHealthScore: 80,
        rentSustainability: "Market rent",
        rentReview: "None",
        pricePerSqft: 100,
        planningUpsideScore: 50,
        voidRiskScore: 20,
        exitYieldSensitivity: "Moderate",
        cashflowAfterDebt: 0,
        returnOnEquity: 0,
        redFlags: [],
        mainRiskFlag: "None",
        score: 75,
        rating: "amber",
        scoreBreakdown: { incomeQuality: 70, tenantSecurity: 80, marketPricing: 70, upside: 50, riskExit: 80 },
        insights: { mispricing: "", couldGoWrong: "", askAgent: "", negotiation: "" },
        thumbnail: "",
        postedAt: "2026-05-08T00:00:00Z",
        isSeed: true,
      },
      {
        id: "imp-live",
        title: "Rightmove Bournemouth Office",
        location: "Bournemouth, BH1",
        region: "South West",
        assetType: "Office",
        source: "Private treaty",
        guidePrice: 350000,
        passingRent: 0,
        sqft: 30203,
        grossYield: 0,
        netInitialYield: 0,
        reversionaryYield: 0,
        wault: 0,
        leaseLength: 0,
        tenant: "Unknown",
        covenantStrength: "Moderate",
        tenantHealthScore: 50,
        rentSustainability: "Market rent",
        rentReview: "None",
        pricePerSqft: 12,
        planningUpsideScore: 40,
        voidRiskScore: 40,
        exitYieldSensitivity: "Moderate",
        cashflowAfterDebt: 0,
        returnOnEquity: 0,
        redFlags: [],
        mainRiskFlag: "Needs review",
        score: 42,
        rating: "red",
        scoreBreakdown: { incomeQuality: 10, tenantSecurity: 40, marketPricing: 45, upside: 40, riskExit: 40 },
        insights: { mispricing: "", couldGoWrong: "", askAgent: "", negotiation: "" },
        thumbnail: "",
        postedAt: "2026-05-20T00:00:00Z",
        isImported: true,
        importSourceName: "Rightmove Commercial",
        needsReview: true,
      },
    ];

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText("Rightmove Bournemouth Office")).toBeInTheDocument();
    expect(screen.queryByText("Demo Tesco")).not.toBeInTheDocument();
    expect(screen.queryByText(/14,832/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Run AI sweep/i)).not.toBeInTheDocument();
    expect(screen.getByText(/AI sweep coming soon/i)).toBeDisabled();
  });

  it("saves the active location search filters", async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

    fireEvent.change(screen.getByLabelText("Location filter"), { target: { value: "Poole" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(savedSearchState.saveSearch).toHaveBeenCalledWith(expect.objectContaining({
        name: "Poole - All real deals",
        filters: expect.objectContaining({ locationQuery: "Poole", source: "All real deals" }),
      }));
    });
  });

  it("counts real green deals, filters when clicked, and clears the filter", () => {
    dealsState.deals = [
      dashboardDeal({
        id: "ds-green-demo",
        title: "Seed Green Demo",
        isSeed: true,
      }),
      dashboardDeal({
        id: "imp-green",
        title: "Green Imported Deal",
        location: "Bournemouth, BH1",
        rating: "green",
        score: 86,
      }),
      dashboardDeal({
        id: "imp-red",
        title: "Red Imported Deal",
        location: "Bournemouth, BH1",
        rating: "red",
        score: 42,
        netInitialYield: 0,
      }),
    ];

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByRole("button", { name: "Show 1 green deals from current filters" })).toBeInTheDocument();
    expect(screen.getByText("Green Imported Deal")).toBeInTheDocument();
    expect(screen.getByText("Red Imported Deal")).toBeInTheDocument();
    expect(screen.queryByText("Seed Green Demo")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show 1 green deals from current filters" }));

    expect(screen.getByText("Green Imported Deal")).toBeInTheDocument();
    expect(screen.queryByText("Red Imported Deal")).not.toBeInTheDocument();
    expect(screen.getAllByText("Green deals")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Clear green filter" }));

    expect(screen.getByText("Green Imported Deal")).toBeInTheDocument();
    expect(screen.getByText("Red Imported Deal")).toBeInTheDocument();
  });

  it("shows the latest real national scan status", () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText("National scan status")).toBeInTheDocument();
    expect(screen.getByText(/Last national scan:/)).toBeInTheDocument();
    expect(screen.getByText("Next scheduled scan: daily at 6am UK time")).toBeInTheDocument();
    expect(screen.getByText("Sources: Rightmove Commercial + Acuitus")).toBeInTheDocument();
  });

  it("shows a no-run state when no completed national scan exists", () => {
    nationalScanState.data = null;

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText("National scan has not run yet")).toBeInTheDocument();
  });
});
