import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Deal } from "@/lib/deals";
import type { SavedAlert } from "@/hooks/useSavedAlerts";
import Dashboard from "@/pages/Dashboard";

const dealsState = vi.hoisted(() => ({
  deals: [] as Deal[],
}));

const savedSearchState = vi.hoisted(() => ({
  saveSearch: vi.fn(),
}));

const savedAlertState = vi.hoisted(() => ({
  alerts: [] as SavedAlert[],
  saveAlert: vi.fn(),
  deleteAlert: vi.fn(),
}));

const nationalScanState = vi.hoisted(() => ({
  data: {
    id: "scan-1",
    sourceName: "Rightmove Commercial",
    locationQuery: "Bournemouth",
    startedAt: "2026-05-28T04:59:00Z",
    finishedAt: "2026-05-28T05:03:00Z",
    locationsScanned: ["London", "Manchester", "Birmingham", "Leeds"],
    totalConfiguredLocations: 160,
    nextIndex: 4,
    estimatedFullCycleDays: 40,
    scanCycleProgress: 3,
    totalDeals: 42,
    totalRightmoveDeals: 30,
    totalAcuitusDeals: 12,
    totalEddisonsDeals: 5,
    totalAllsopDeals: 4,
    locationsCompletedInCurrentCycle: 4,
    lastSuccessfulScanDurationMs: 240000,
    lastScanInsertedCount: 7,
  },
  isLoading: false,
  isError: false,
}));

const watchlistState = vi.hoisted(() => ({
  ids: [] as string[],
  pipelineItems: {} as Record<string, { dealId: string; status: string; notes: string }>,
  pipelineCounts: {
    Saved: 0,
    Reviewing: 0,
    "Viewing Booked": 0,
    "Offer Submitted": 0,
    Passed: 0,
    Purchased: 0,
  },
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
  PIPELINE_STATUSES: ["Saved", "Reviewing", "Viewing Booked", "Offer Submitted", "Passed", "Purchased"],
  useWatchlist: () => ({
    ids: watchlistState.ids,
    pipelineItems: watchlistState.pipelineItems,
    pipelineCounts: watchlistState.pipelineCounts,
  }),
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

vi.mock("@/hooks/useSavedAlerts", () => ({
  useSavedAlerts: () => ({
    alerts: savedAlertState.alerts,
    isLoading: false,
    isSaving: false,
    isDeleting: false,
    saveAlert: savedAlertState.saveAlert,
    deleteAlert: savedAlertState.deleteAlert,
    error: null,
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
    savedAlertState.alerts = [];
    savedAlertState.saveAlert.mockReset();
    savedAlertState.deleteAlert.mockReset();
    nationalScanState.data = {
      id: "scan-1",
      sourceName: "Rightmove Commercial",
      locationQuery: "Bournemouth",
      startedAt: "2026-05-28T04:59:00Z",
      finishedAt: "2026-05-28T05:03:00Z",
      locationsScanned: ["London", "Manchester", "Birmingham", "Leeds"],
      totalConfiguredLocations: 160,
      nextIndex: 4,
      estimatedFullCycleDays: 40,
      scanCycleProgress: 3,
      totalDeals: 42,
      totalRightmoveDeals: 30,
      totalAcuitusDeals: 12,
      totalEddisonsDeals: 5,
      totalAllsopDeals: 4,
      locationsCompletedInCurrentCycle: 4,
      lastSuccessfulScanDurationMs: 240000,
      lastScanInsertedCount: 7,
    };
    nationalScanState.isLoading = false;
    nationalScanState.isError = false;
    watchlistState.ids = [];
    watchlistState.pipelineItems = {};
    watchlistState.pipelineCounts = {
      Saved: 0,
      Reviewing: 0,
      "Viewing Booked": 0,
      "Offer Submitted": 0,
      Passed: 0,
      Purchased: 0,
    };
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

  it("shows KPI totals with database context, imported context, yield sample size, and real watchlist activity", () => {
    dealsState.deals = [
      dashboardDeal({ id: "imp-yield-1", title: "Yield Deal One", netInitialYield: 8, guidePrice: 350000 }),
      dashboardDeal({ id: "imp-yield-2", title: "Yield Deal Two", netInitialYield: 6, guidePrice: 450000, importSourceName: "Eddisons" }),
      dashboardDeal({ id: "imp-no-yield", title: "Sparse Deal", netInitialYield: 0, guidePrice: 0, importSourceName: "Acuitus" }),
    ];
    watchlistState.ids = ["imp-yield-1"];
    watchlistState.pipelineCounts = {
      Saved: 1,
      Reviewing: 1,
      "Viewing Booked": 0,
      "Offer Submitted": 1,
      Passed: 0,
      Purchased: 0,
    };

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText("Filtered deals")).toBeInTheDocument();
    expect(screen.getByText(/42 total DB.*3 imported.*2 priced/)).toBeInTheDocument();
    expect(screen.getByText("Average yield (NIY)")).toBeInTheDocument();
    expect(screen.getByText("NIY from 2 deals")).toBeInTheDocument();
    expect(screen.getByText("Watchlisted deals")).toBeInTheDocument();
    expect(screen.getByText("2 active opportunities")).toBeInTheDocument();
    expect(screen.queryByText(/need review/)).not.toBeInTheDocument();
  });

  it("shows freshness KPIs, filters by new deals, and orders recently added newest first", () => {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
    dealsState.deals = [
      dashboardDeal({ id: "fresh-today", title: "Fresh Today Deal", postedAt: twoHoursAgo, sourceUrl: "https://rightmove.co.uk/fresh-today" }),
      dashboardDeal({
        id: "fresh-candidate",
        title: "Fresh Candidate Deal",
        postedAt: threeDaysAgo,
        score: 74,
        rating: "amber",
        dataConfidenceScore: 78,
        passingRent: 32000,
        sourceUrl: "https://eddisons.com/fresh-candidate",
        importSourceName: "Eddisons",
      }),
      dashboardDeal({ id: "older-deal", title: "Older Deal", postedAt: tenDaysAgo }),
    ];

    const { container } = render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getAllByText("New Today").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: "Show 1 deals imported today" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show 2 deals imported this week" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show 1 new green candidate deals" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show 1 source listings imported today" })).toBeInTheDocument();
    expect(screen.getByText("Recently Added")).toBeInTheDocument();
    expect(container.textContent?.indexOf("Fresh Today Deal")).toBeLessThan(container.textContent?.indexOf("Fresh Candidate Deal") ?? 0);

    fireEvent.click(screen.getByRole("button", { name: "Show 1 deals imported today" }));

    expect(screen.getAllByText("Fresh Today Deal").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Fresh Candidate Deal")).not.toBeInTheDocument();
    expect(screen.queryByText("Older Deal")).not.toBeInTheDocument();
    expect(screen.getAllByText("New Today").length).toBeGreaterThanOrEqual(1);
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

    expect(screen.getAllByText("Rightmove Bournemouth Office").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Demo Tesco")).not.toBeInTheDocument();
    expect(screen.queryByText(/14,832/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Run AI sweep/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/AI sweep coming soon/i)).not.toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(savedSearchState.saveSearch).toHaveBeenCalledWith(expect.objectContaining({
        name: "Poole - All real deals",
        filters: expect.objectContaining({ locationQuery: "Poole", source: "All real deals" }),
      }));
    });
  });

  it("creates an alert from the active dashboard filters", async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

    fireEvent.change(screen.getByLabelText("Location filter"), { target: { value: "Poole" } });
    fireEvent.click(screen.getByRole("button", { name: /create alert/i }));

    await waitFor(() => {
      expect(savedAlertState.saveAlert).toHaveBeenCalledWith(expect.objectContaining({
        name: expect.stringContaining("Poole"),
        locationQuery: "Poole",
        assetType: "All",
        enabled: true,
      }));
    });
  });

  it("edits, toggles, and deletes saved alerts", async () => {
    savedAlertState.alerts = [{
      id: "alert-1",
      name: "Bournemouth retail alert",
      locationQuery: "Bournemouth",
      minYield: 7,
      maxPrice: 1000000,
      assetType: "Retail",
      minScore: 70,
      enabled: true,
      createdAt: "2026-05-30T09:00:00Z",
      updatedAt: "2026-05-30T09:00:00Z",
      lastRunAt: "2026-05-30T10:00:00Z",
      matchesFound: 2,
    }];

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText("Bournemouth retail alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Disable" }));
    await waitFor(() => expect(savedAlertState.saveAlert).toHaveBeenCalledWith(expect.objectContaining({ id: "alert-1", enabled: false })));

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    fireEvent.change(screen.getByLabelText("Alert name"), { target: { value: "Updated alert" } });
    fireEvent.click(screen.getByRole("button", { name: "Save alert" }));
    await waitFor(() => expect(savedAlertState.saveAlert).toHaveBeenCalledWith(expect.objectContaining({ id: "alert-1", name: "Updated alert" })));

    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    await waitFor(() => expect(savedAlertState.deleteAlert).toHaveBeenCalledWith("alert-1"));
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

    expect(screen.getByRole("button", { name: "Show 1 verified green deals from current filters" })).toBeInTheDocument();
    expect(screen.getAllByText("Green Imported Deal").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Red Imported Deal").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Seed Green Demo")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show 1 verified green deals from current filters" }));

    expect(screen.getAllByText("Green Imported Deal").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Red Imported Deal")).not.toBeInTheDocument();
    expect(screen.getAllByText("Verified Green").length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByRole("button", { name: "Clear green filter" }));

    expect(screen.getAllByText("Green Imported Deal").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Red Imported Deal").length).toBeGreaterThanOrEqual(1);
  });

  it("counts and filters Green Candidates separately from Verified Green", () => {
    dealsState.deals = [
      dashboardDeal({
        id: "imp-candidate",
        title: "Candidate Imported Deal",
        score: 73,
        rating: "amber",
        dataConfidenceScore: 85,
        confidenceLevel: "high",
        guidePrice: 700000,
        passingRent: 62100,
        netInitialYield: 8.25,
      }),
      dashboardDeal({
        id: "imp-verified",
        title: "Verified Imported Deal",
        score: 82,
        rating: "green",
        dataConfidenceScore: 85,
        confidenceLevel: "high",
      }),
      dashboardDeal({
        id: "imp-red",
        title: "Red Imported Deal",
        score: 42,
        rating: "red",
        dataConfidenceScore: 61,
        confidenceLevel: "medium",
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

    expect(screen.getByRole("button", { name: "Show 1 green candidate deals from current filters" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show 1 green candidate deals from current filters" }));

    expect(screen.getAllByText("Candidate Imported Deal").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Verified Imported Deal")).not.toBeInTheDocument();
    expect(screen.queryByText("Red Imported Deal")).not.toBeInTheDocument();
    expect(screen.getAllByText("Green Candidates").length).toBeGreaterThanOrEqual(1);
  });

  it("shows pipeline counts and filters dashboard deals by pipeline status", () => {
    dealsState.deals = [
      dashboardDeal({ id: "imp-reviewing", title: "Reviewing Pipeline Deal", rating: "amber", score: 70 }),
      dashboardDeal({ id: "imp-offer", title: "Offer Pipeline Deal", rating: "green", score: 88 }),
      dashboardDeal({ id: "imp-unsaved", title: "Unsaved Deal", rating: "red", score: 41 }),
    ];
    watchlistState.ids = ["imp-reviewing", "imp-offer"];
    watchlistState.pipelineItems = {
      "imp-reviewing": { dealId: "imp-reviewing", status: "Reviewing", notes: "" },
      "imp-offer": { dealId: "imp-offer", status: "Offer Submitted", notes: "" },
    };
    watchlistState.pipelineCounts = {
      Saved: 0,
      Reviewing: 1,
      "Viewing Booked": 0,
      "Offer Submitted": 1,
      Passed: 0,
      Purchased: 0,
    };

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText("My Pipeline")).toBeInTheDocument();
    expect(screen.getByText("Reviewing: 1")).toBeInTheDocument();
    expect(screen.getByText("Offer Submitted: 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reviewing: 1" }));

    expect(screen.getAllByText("Reviewing Pipeline Deal").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Offer Pipeline Deal")).not.toBeInTheDocument();
    expect(screen.queryByText("Unsaved Deal")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear pipeline filter" }));

    expect(screen.getAllByText("Offer Pipeline Deal").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Unsaved Deal").length).toBeGreaterThanOrEqual(1);
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
    expect(screen.getByText("Sources: Rightmove Commercial + Acuitus + Eddisons + Allsop")).toBeInTheDocument();
    expect(screen.getByText("Last run locations: London, Manchester, Birmingham, Leeds")).toBeInTheDocument();
    expect(screen.getByText(/Queue: 160 locations/)).toBeInTheDocument();
    expect(screen.getByText(/Cycle progress: 3%/)).toBeInTheDocument();
    expect(screen.getByText("Locations completed this cycle: 4/160")).toBeInTheDocument();
    expect(screen.getByText("Database: 42 deals · Rightmove 30 · Acuitus 12 · Eddisons 5 · Allsop 4")).toBeInTheDocument();
    expect(screen.getByText(/Loaded ratings: Verified Greens/)).toBeInTheDocument();
  });

  it("shows inventory audit metrics and outputs an admin report", () => {
    dealsState.deals = [
      dashboardDeal({
        id: "imp-rightmove-audit",
        title: "Rightmove Audit Deal",
        importSourceName: "Rightmove Commercial",
        score: 82,
        rating: "green",
        dataConfidenceScore: 86,
        postedAt: "2026-06-04T09:00:00Z",
      }),
      dashboardDeal({
        id: "imp-acuitus-audit",
        title: "Acuitus Audit Deal",
        importSourceName: "Acuitus",
        score: 73,
        rating: "amber",
        dataConfidenceScore: 80,
        postedAt: "2026-06-03T09:00:00Z",
      }),
      dashboardDeal({
        id: "imp-eddisons-audit",
        title: "Eddisons Audit Deal",
        importSourceName: "Eddisons",
        score: 42,
        rating: "red",
        dataConfidenceScore: 50,
        postedAt: "2026-05-20T09:00:00Z",
      }),
      dashboardDeal({
        id: "imp-allsop-audit",
        title: "Allsop Audit Deal",
        importSourceName: "Allsop",
        score: 72,
        rating: "amber",
        dataConfidenceScore: 78,
        postedAt: "2026-06-04T10:00:00Z",
      }),
    ];

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText("Inventory audit")).toBeInTheDocument();
    expect(screen.getByText("Admin diagnostics")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /generate inventory report/i }));

    expect(screen.getByText(/Total deals: 4/)).toBeInTheDocument();
    expect(screen.getByText(/Total imported deals: 4/)).toBeInTheDocument();
    expect(screen.getByText(/Rightmove deals: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Acuitus deals: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Eddisons deals: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Allsop deals: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Locations completed in current scan cycle: 4\/160/)).toBeInTheDocument();
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
