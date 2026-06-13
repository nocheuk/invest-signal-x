import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Deal } from "@/lib/deals";
import Watchlist from "@/pages/Watchlist";

const pipelineState = vi.hoisted(() => ({
  deals: [] as Deal[],
  setStatus: vi.fn(),
  setNote: vi.fn(),
  setPipelineItem: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/hooks/useRealDeals", () => ({
  useRealDeals: () => ({
    deals: pipelineState.deals,
    dealsQuery: { isLoading: false, isError: false },
  }),
}));

vi.mock("@/lib/watchlist", () => ({
  PIPELINE_STATUSES: ["New", "Reviewing", "Agent Contacted", "Brochure Requested", "Planning Review", "Financial Review", "Offer Submitted", "Under Offer", "Acquired", "Rejected"],
  useWatchlist: () => ({
    ids: ["deal-new", "deal-finance", "deal-offer", "deal-acquired"],
    notes: {
      "deal-new": "Call agent",
      "deal-finance": "Check debt sizing",
    },
    pipelineItems: {
      "deal-new": { dealId: "deal-new", status: "New", notes: "Call agent", nextActionDate: "2026-06-20", assignedOwner: "Dana" },
      "deal-finance": { dealId: "deal-finance", status: "Financial Review", notes: "Check debt sizing", nextActionDate: "2026-06-21", assignedOwner: "Alex" },
      "deal-offer": { dealId: "deal-offer", status: "Under Offer", notes: "", nextActionDate: "", assignedOwner: "" },
      "deal-acquired": { dealId: "deal-acquired", status: "Acquired", notes: "", nextActionDate: "", assignedOwner: "" },
    },
    pipelineCounts: {
      New: 1,
      Reviewing: 0,
      "Agent Contacted": 0,
      "Brochure Requested": 0,
      "Planning Review": 0,
      "Financial Review": 1,
      "Offer Submitted": 0,
      "Under Offer": 1,
      Acquired: 1,
      Rejected: 0,
    },
    error: null,
    getPipelineStatus: (id: string) => ({
      "deal-new": "New",
      "deal-finance": "Financial Review",
      "deal-offer": "Under Offer",
      "deal-acquired": "Acquired",
    }[id]),
    setStatus: pipelineState.setStatus,
    setNote: pipelineState.setNote,
    setPipelineItem: pipelineState.setPipelineItem,
    remove: pipelineState.remove,
  }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <Watchlist />
    </MemoryRouter>,
  );
}

describe("Watchlist pipeline board", () => {
  beforeEach(() => {
    pipelineState.setStatus.mockReset();
    pipelineState.setNote.mockReset();
    pipelineState.setPipelineItem.mockReset();
    pipelineState.remove.mockReset();
    pipelineState.deals = [
      deal({ id: "deal-new", title: "New retail opportunity" }),
      deal({ id: "deal-finance", title: "Financial review office" }),
      deal({ id: "deal-offer", title: "Under offer industrial" }),
      deal({ id: "deal-acquired", title: "Acquired mixed-use" }),
    ];
  });

  it("renders the V2 stage board and summary counts", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "My Pipeline" })).toBeInTheDocument();
    expect(screen.getByText("Total saved")).toBeInTheDocument();
    expect(screen.getByText("Active opportunities")).toBeInTheDocument();
    expect(screen.getByText("Offers / under offer")).toBeInTheDocument();
    expect(screen.getAllByText("Acquired").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "New" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Agent Contacted" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Brochure Requested" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Planning Review" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Financial Review" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Under Offer" })).toBeInTheDocument();
    expect(screen.getByText("New retail opportunity")).toBeInTheDocument();
    expect(screen.getByText("Financial review office")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Call agent")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-06-20")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Dana")).toBeInTheDocument();
  });

  it("updates stage, notes, next action date, and owner from the board", () => {
    renderPage();

    fireEvent.change(screen.getByDisplayValue("Call agent"), { target: { value: "Request brochure" } });
    expect(pipelineState.setNote).toHaveBeenCalledWith("deal-new", "Request brochure");

    fireEvent.change(screen.getByDisplayValue("2026-06-20"), { target: { value: "2026-06-25" } });
    expect(pipelineState.setPipelineItem).toHaveBeenCalledWith("deal-new", { nextActionDate: "2026-06-25" });

    fireEvent.change(screen.getByDisplayValue("Dana"), { target: { value: "Sam" } });
    expect(pipelineState.setPipelineItem).toHaveBeenCalledWith("deal-new", { assignedOwner: "Sam" });
  });
});

function deal(overrides: Partial<Deal>): Deal {
  return {
    id: "deal",
    title: "Pipeline deal",
    location: "Bournemouth",
    region: "Dorset",
    assetType: "Retail",
    source: "Private treaty",
    guidePrice: 500000,
    passingRent: 50000,
    sqft: 2000,
    grossYield: 10,
    netInitialYield: 9,
    reversionaryYield: 0,
    wault: 0,
    leaseLength: 0,
    tenant: "Unknown",
    covenantStrength: "Moderate",
    tenantHealthScore: 50,
    rentSustainability: "Market rent",
    rentReview: "None",
    pricePerSqft: 250,
    planningUpsideScore: 40,
    voidRiskScore: 40,
    exitYieldSensitivity: "Moderate",
    cashflowAfterDebt: 0,
    returnOnEquity: 0,
    redFlags: [],
    mainRiskFlag: "Verify data",
    score: 72,
    rating: "amber",
    scoreBreakdown: { incomeQuality: 60, tenantSecurity: 50, marketPricing: 60, upside: 50, riskExit: 50 },
    insights: { mispricing: "", couldGoWrong: "", askAgent: "", negotiation: "" },
    thumbnail: "",
    postedAt: "2026-06-10T10:00:00Z",
    ...overrides,
  };
}
