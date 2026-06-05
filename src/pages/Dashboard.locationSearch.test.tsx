import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Deal } from "@/lib/deals";
import Dashboard from "@/pages/Dashboard";

const dealsState = vi.hoisted(() => ({
  deals: [] as Deal[],
}));

const locationImportState = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  error: null as Error | null,
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

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/DealCard", () => ({
  DealCard: ({ deal }: { deal: { title: string } }) => <div>{deal.title}</div>,
}));

vi.mock("@/hooks/useDeals", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useDeals")>("@/hooks/useDeals");
  return {
    ...actual,
    useDeals: () => ({ data: dealsState.deals, isLoading: false, isError: false }),
  };
});

vi.mock("@/lib/watchlist", () => ({
  useWatchlist: () => ({
    ids: [],
    pipelineCounts: {
      Saved: 0,
      Reviewing: 0,
      "Viewing Booked": 0,
      "Offer Submitted": 0,
      Passed: 0,
      Purchased: 0,
    },
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

vi.mock("@/hooks/useNationalScanStatus", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useNationalScanStatus")>("@/hooks/useNationalScanStatus");
  return {
    ...actual,
    useNationalScanStatus: () => nationalScanState,
  };
});

vi.mock("@/hooks/useLocationImport", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useLocationImport")>("@/hooks/useLocationImport");
  return {
    ...actual,
    useLocationImport: () => locationImportState,
  };
});

vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: true,
}));

function renderDashboard() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

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
    postedAt: "2026-06-04T10:00:00Z",
    isImported: true,
    importSourceName: "Rightmove Commercial",
    needsReview: false,
    ...overrides,
  };
}

describe("Dashboard focused overview", () => {
  beforeEach(() => {
    dealsState.deals = [];
    locationImportState.mutateAsync.mockReset();
    locationImportState.mutateAsync.mockResolvedValue({ imported: 2, existing: 1, refreshed: 1, failed: 0 });
    locationImportState.isPending = false;
    locationImportState.isError = false;
    locationImportState.error = null;
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
  });

  it("keeps the dashboard focused on overview sections", () => {
    dealsState.deals = [
      dashboardDeal({ id: "candidate", title: "Green Candidate Deal", score: 73, rating: "amber", dataConfidenceScore: 80, confidenceLevel: "high" }),
      dashboardDeal({ id: "review", title: "Needs Review Deal", score: 42, rating: "red", needsReview: true }),
    ];

    renderDashboard();

    expect(screen.getByText("Top Opportunities This Week")).toBeInTheDocument();
    expect(screen.getAllByText("Green Candidates").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("New Today").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("New This Week").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Quick location search")).toBeInTheDocument();
    expect(screen.getByText("Last scan status")).toBeInTheDocument();
    expect(screen.queryByText("All live opportunities")).not.toBeInTheDocument();
    expect(screen.queryByText("My Alerts")).not.toBeInTheDocument();
    expect(screen.queryByText("Inventory audit")).not.toBeInTheDocument();
  });

  it("excludes seeded demo deals in Supabase mode", () => {
    dealsState.deals = [
      dashboardDeal({ id: "ds-demo", title: "Seed Demo Deal", isSeed: true }),
      dashboardDeal({ id: "imp-real", title: "Real Imported Deal", location: "Bournemouth, BH1" }),
    ];

    renderDashboard();

    expect(screen.queryByText("Seed Demo Deal")).not.toBeInTheDocument();
    expect(screen.getAllByText("Real Imported Deal").length).toBeGreaterThanOrEqual(1);
  });

  it("runs live location search from the dashboard CTA", async () => {
    dealsState.deals = [dashboardDeal({ id: "poole", title: "Poole Deal", location: "Poole" })];

    renderDashboard();
    fireEvent.change(screen.getByLabelText("Location filter"), { target: { value: "Southampton" } });
    fireEvent.click(screen.getByRole("button", { name: /search live sources/i }));

    await waitFor(() => expect(locationImportState.mutateAsync).toHaveBeenCalledWith({ locationQuery: "Southampton" }));
    expect(await screen.findByText(/Added 2 new deals/)).toBeInTheDocument();
  });

  it("shows real national scan status and no-run state", () => {
    renderDashboard();

    expect(screen.getByText(/Last national scan:/)).toBeInTheDocument();
    expect(screen.getByText(/Next scheduled scan:/)).toBeInTheDocument();
    expect(screen.getByText(/daily at 6am UK time/)).toBeInTheDocument();
    expect(screen.getByText(/Sources:/)).toBeInTheDocument();
    expect(screen.getByText(/Rightmove Commercial \+ Acuitus \+ Eddisons \+ Allsop/)).toBeInTheDocument();
    expect(screen.getByText(/Last run locations: London, Manchester, Birmingham, Leeds/)).toBeInTheDocument();

    cleanup();
    nationalScanState.data = null;
    renderDashboard();

    expect(screen.getByText("National scan has not run yet.")).toBeInTheDocument();
  });

  it("keeps the dashboard usable when national scan status fails", () => {
    nationalScanState.data = null;
    nationalScanState.isError = true;
    dealsState.deals = [dashboardDeal({ id: "live", title: "Live Deal Still Visible" })];

    renderDashboard();

    expect(screen.getByText("Could not load national scan status.")).toBeInTheDocument();
    expect(screen.getAllByText("Live Deal Still Visible").length).toBeGreaterThanOrEqual(1);
  });
});
