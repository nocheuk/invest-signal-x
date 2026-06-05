import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DealCard } from "@/components/DealCard";
import type { Deal } from "@/lib/deals";

const watchlistMock = vi.hoisted(() => ({
  saveToPipeline: vi.fn(),
  saved: false,
}));

vi.mock("@/lib/watchlist", () => ({
  useWatchlist: () => ({
    isWatched: () => watchlistMock.saved,
    toggle: vi.fn(),
    getPipelineStatus: () => watchlistMock.saved ? "Saved" : undefined,
    saveToPipeline: watchlistMock.saveToPipeline,
  }),
}));

vi.mock("@/lib/strategy", async () => {
  const actual = await vi.importActual<typeof import("@/lib/strategy")>("@/lib/strategy");
  return {
    ...actual,
    useStrategy: () => ({
      weights: { yield: 50, growth: 50, discount: 50, risk: 50, demand: 50 },
    }),
  };
});

function deal(overrides: Partial<Deal> = {}): Deal {
  return {
    id: "imp-card",
    title: "Imported retail investment",
    location: "Bournemouth, BH1",
    region: "South West",
    assetType: "Retail",
    source: "Private treaty",
    importSourceName: "Rightmove Commercial Bournemouth",
    isImported: true,
    needsReview: true,
    guidePrice: 1000000,
    passingRent: 0,
    sqft: 0,
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
    pricePerSqft: 0,
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
    thumbnail: "from-cyan-500/30 to-blue-700/20",
    postedAt: "2026-05-20T00:00:00Z",
    ...overrides,
  };
}

function renderCard(input: Deal) {
  return render(
    <MemoryRouter>
      <DealCard deal={input} />
    </MemoryRouter>
  );
}

describe("DealCard", () => {
  beforeEach(() => {
    watchlistMock.saveToPipeline.mockReset();
    watchlistMock.saved = false;
  });

  it("renders the imported deal image when an image URL is available", () => {
    renderCard(deal({ imageUrl: "https://cdn.example.com/property.jpg" }));

    const image = screen.getByRole("img", { name: "Imported retail investment" });
    expect(image).toHaveAttribute("src", "https://cdn.example.com/property.jpg");
    expect(image).toHaveClass("object-cover");
  });

  it("uses the gradient fallback when no image URL is available or the image fails", () => {
    renderCard(deal({ imageUrl: "https://cdn.example.com/broken.jpg" }));

    fireEvent.error(screen.getByRole("img", { name: "Imported retail investment" }));
    expect(screen.queryByRole("img", { name: "Imported retail investment" })).not.toBeInTheDocument();
    expect(screen.getByTestId("deal-card-media")).toHaveClass("bg-gradient-to-br");
  });

  it("keeps the score badge fully inside the media area", () => {
    renderCard(deal());

    const badge = screen.getByTestId("deal-card-score-badge");
    expect(badge).toHaveClass("bottom-3");
    expect(badge).toHaveClass("right-3");
    expect(badge.className).not.toContain("-bottom");
    expect(badge.className).not.toContain("-right");
  });

  it("shows missing imported metrics honestly", () => {
    renderCard(deal({ guidePrice: 0, netInitialYield: 0, wault: 0, tenant: "Unknown" }));

    expect(screen.getAllByText("Not available").length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText("Tenant not available")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save to Pipeline" })).toBeInTheDocument();
  });

  it("shows when an imported deal was added", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    renderCard(deal({ postedAt: twoHoursAgo }));

    expect(screen.getByText("Added 2 hours ago")).toBeInTheDocument();
  });

  it("saves to pipeline without toggling saved deals back off", () => {
    const { rerender } = renderCard(deal());

    fireEvent.click(screen.getByRole("button", { name: "Save to Pipeline" }));
    expect(watchlistMock.saveToPipeline).toHaveBeenCalledWith("imp-card");

    watchlistMock.saved = true;
    rerender(
      <MemoryRouter>
        <DealCard deal={deal()} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Pipeline: Saved" }));
    expect(watchlistMock.saveToPipeline).toHaveBeenCalledTimes(1);
  });

  it("shows opportunity and risk signals from Deal Analysis V2", () => {
    renderCard(deal({
      passingRent: 90000,
      netInitialYield: 9,
      grossYield: 9,
      pricePerSqft: 100,
      scoreReasons: {
        positiveDrivers: ["Yield above benchmark"],
        negativeDrivers: [],
        missingDataWarnings: ["Lease information missing"],
        verifyBeforeTrusting: [],
      },
    }));

    expect(screen.getByText("Yield above benchmark")).toBeInTheDocument();
    expect(screen.getByText(/Lease information missing/)).toBeInTheDocument();
  });

  it("shows a Green Candidate badge and qualification reason", () => {
    renderCard(deal({
      score: 73,
      rating: "amber",
      dataConfidenceScore: 85,
      confidenceLevel: "high",
      guidePrice: 700000,
      passingRent: 62100,
      grossYield: 8.87,
      netInitialYield: 8.25,
    }));

    expect(screen.getByText("Green Candidate")).toBeInTheDocument();
    expect(screen.getByText(/Green Candidate: Score 73 is above/)).toBeInTheDocument();
  });
});
