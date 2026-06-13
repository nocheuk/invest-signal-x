import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Deal } from "@/lib/deals";
import SourcesScans from "@/pages/SourcesScans";

const dealsState = vi.hoisted(() => ({
  deals: [] as Deal[],
}));

const authState = vi.hoisted(() => ({
  user: { id: "user-1", email: "user@example.com", app_metadata: { role: "member" }, user_metadata: {} } as Record<string, unknown> | null,
}));

const scanStatusState = vi.hoisted(() => ({
  data: {
    id: "scan-1",
    sourceName: "Rightmove Commercial",
    locationQuery: "England",
    startedAt: "2026-06-10T05:00:00Z",
    finishedAt: "2026-06-10T05:04:00Z",
    locationsScanned: ["London", "Manchester"],
    totalConfiguredLocations: 160,
    nextIndex: 16,
    estimatedFullCycleDays: 10,
    scanCycleProgress: 10,
    totalDeals: 3,
    sourceScanRuns: [
      scan({ id: "rightmove-ok", sourceName: "Rightmove Commercial", status: "completed", inserted: 2, existing: 4 }),
      scan({ id: "zoopla-blocked", sourceName: "Zoopla Commercial", status: "failed", errorMessage: "Fetch failed: 403 Forbidden" }),
    ],
    enrichmentMetrics: { total: 0, enriched: 0, failed: 0, pending: 0, queueSize: 0, successRate: 0 },
    enrichmentImpact: undefined,
    locationsCompletedInCurrentCycle: 16,
    lastSuccessfulScanDurationMs: 240000,
    lastScanInsertedCount: 2,
  },
  isLoading: false,
  isError: false,
}));

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/hooks/useRealDeals", () => ({
  useRealDeals: () => ({
    deals: dealsState.deals,
    dealsQuery: { isLoading: false, isError: false },
  }),
}));

vi.mock("@/hooks/useNationalScanStatus", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useNationalScanStatus")>("@/hooks/useNationalScanStatus");
  return {
    ...actual,
    useNationalScanStatus: () => scanStatusState,
  };
});

vi.mock("@/hooks/useFeedbackUsageAdmin", () => ({
  useFeedbackUsageAdmin: (enabled: boolean) => ({
    data: {
      latestFeedback: enabled ? [{
        id: "feedback-1",
        user_id: "user-1",
        type: "bug_report",
        message: "The source link is stale.",
        deal_id: "deal-1",
        source_url: "https://example.com/deal-1",
        current_page: "/deal/deal-1",
        metadata: {},
        created_at: "2026-06-10T09:00:00Z",
      }] : [],
      eventCounts: enabled ? [{ eventType: "opened_deal", count: 4 }] : [],
      mostOpenedDeals: enabled ? [{ dealId: "deal-1", count: 3 }] : [],
      mostDownloadedInvestmentPacks: enabled ? [{ dealId: "deal-1", count: 2 }] : [],
    },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("@/lib/watchlist", () => ({
  useWatchlist: () => ({
    ids: [],
    pipelineCounts: {
      New: 0,
      Reviewing: 0,
      "Agent Contacted": 0,
      "Brochure Requested": 0,
      "Planning Review": 0,
      "Financial Review": 0,
      "Offer Submitted": 0,
      "Under Offer": 0,
      Acquired: 0,
      Rejected: 0,
    },
  }),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: authState.user,
  }),
}));

describe("SourcesScans", () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    authState.user = { id: "user-1", email: "user@example.com", app_metadata: { role: "member" }, user_metadata: {} };
    dealsState.deals = [
      deal({ id: "rightmove-1", source: "Rightmove Commercial", score: 80, confidence: 84, postedAt: "2026-06-10T08:00:00Z" }),
      deal({ id: "rightmove-2", source: "Rightmove Commercial", score: 73, confidence: 78, postedAt: "2026-06-09T08:00:00Z" }),
      deal({ id: "savills-1", source: "Savills Commercial", score: 50, confidence: 50, postedAt: "2026-06-10T08:00:00Z" }),
    ];
  });

  it("shows investor-friendly statuses and hides zero-inventory sources for normal users", () => {
    render(<SourcesScans />);

    expect(screen.getByText("Active sources")).toBeInTheDocument();
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    expect(screen.queryByText("Disabled")).not.toBeInTheDocument();
    expect(screen.queryByText("Blocked")).not.toBeInTheDocument();
    expect(screen.queryByText("Problematic")).not.toBeInTheDocument();
    expect(screen.queryByText("Feedback and Usage")).not.toBeInTheDocument();
    expect(screen.getAllByText("Rightmove Commercial").length).toBeGreaterThan(0);
    expect(screen.queryByText("Zoopla Commercial")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /additional sources being monitored/i }));
    expect(screen.getByText("Zoopla Commercial")).toBeInTheDocument();
    expect(screen.getAllByText("Updating soon").length).toBeGreaterThan(0);
  });

  it("shows technical diagnostics for admins", () => {
    authState.user = { id: "admin-1", email: "admin@example.com", app_metadata: { role: "admin" }, user_metadata: {} };

    render(<SourcesScans />);

    expect(screen.getAllByText("Blocked").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Disabled").length).toBeGreaterThan(0);
    expect(screen.getByText("Blocked backoff")).toBeInTheDocument();
    expect(screen.getByText("Source Opportunity Audit")).toBeInTheDocument();
    expect(screen.getByText("Feedback and Usage")).toBeInTheDocument();
    expect(screen.getByText("The source link is stale.")).toBeInTheDocument();
    expect(screen.getByText("Opened Deal")).toBeInTheDocument();
    const audit = screen.getByText("Source Opportunity Audit").closest("section")!;
    expect(within(audit).getByText("Pugh Auctions")).toBeInTheDocument();
    expect(within(audit).getByText("Build immediately")).toBeInTheDocument();
  });
});

function scan(overrides: Record<string, unknown>) {
  return {
    id: "scan",
    sourceName: "Rightmove Commercial",
    locationQuery: "England",
    status: "completed",
    startedAt: "2026-06-10T05:00:00Z",
    finishedAt: "2026-06-10T05:04:00Z",
    inserted: 0,
    existing: 0,
    failed: 0,
    skippedDuplicate: 0,
    skippedRentOnly: 0,
    skippedPoa: 0,
    errorMessage: null,
    ...overrides,
  };
}

function deal({
  id,
  source,
  score,
  confidence,
  postedAt,
}: {
  id: string;
  source: string;
  score: number;
  confidence: number;
  postedAt: string;
}): Deal {
  return {
    id,
    title: `${source} deal`,
    location: "Bournemouth, BH1",
    region: "Dorset",
    assetType: "Retail",
    source: "Private treaty",
    sourceUrl: `https://example.com/${id}`,
    importSourceName: source,
    isImported: true,
    guidePrice: 500000,
    passingRent: 50000,
    sqft: 2000,
    grossYield: 10,
    netInitialYield: 9,
    reversionaryYield: 9,
    wault: 0,
    leaseLength: 0,
    tenant: "Unknown",
    covenantStrength: "Moderate",
    tenantHealthScore: 60,
    rentSustainability: "Market rent",
    rentReview: "None",
    pricePerSqft: 250,
    planningUpsideScore: 40,
    voidRiskScore: 40,
    exitYieldSensitivity: "Moderate",
    cashflowAfterDebt: 0,
    returnOnEquity: 0,
    redFlags: [],
    mainRiskFlag: "Imported",
    score,
    rating: score >= 78 ? "green" : score >= 60 ? "amber" : "red",
    dataConfidenceScore: confidence,
    confidenceLevel: confidence >= 80 ? "high" : confidence >= 60 ? "medium" : "low",
    scoreBreakdown: {
      incomeQuality: 70,
      tenantSecurity: 60,
      marketPricing: 60,
      upside: 40,
      riskExit: 60,
    },
    insights: {
      mispricing: "",
      couldGoWrong: "",
      askAgent: "",
      negotiation: "",
    },
    thumbnail: "",
    postedAt,
  };
}
