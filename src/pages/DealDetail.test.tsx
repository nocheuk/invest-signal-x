import { render, screen } from "@testing-library/react";
import type React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { Deal } from "@/lib/deals";
import DealDetail from "@/pages/DealDetail";

const targetDeal: Deal = {
  id: "imp-10a4m7",
  title: "Asda Stores Ltd, St Nicholas Gate Retail Park",
  location: "Asda Stores Ltd, St Nicholas Gate Retail Park, London Road, Carlisle, Cumberland",
  region: "All UK",
  assetType: "Land",
  source: "Auction",
  sourceUrl: "https://example.com/asda",
  importSourceName: "Allsop",
  isImported: true,
  guidePrice: 4250000,
  passingRent: 771722,
  sqft: 35807,
  grossYield: 18.158164705882353,
  netInitialYield: 16.88709317647059,
  reversionaryYield: 0,
  wault: 12,
  leaseLength: 12,
  tenant: "ASDA Stores Ltd",
  covenantStrength: "Strong",
  tenantHealthScore: 90,
  rentSustainability: "Market rent",
  rentReview: "Fixed uplift",
  pricePerSqft: 119,
  planningUpsideScore: 50,
  voidRiskScore: 25,
  exitYieldSensitivity: "Moderate",
  cashflowAfterDebt: 0,
  returnOnEquity: 0,
  redFlags: [],
  mainRiskFlag: "Verify source documents",
  score: 77,
  rating: "amber",
  dataConfidenceScore: 76,
  confidenceLevel: "high",
  scoreReasons: {
    positiveDrivers: ["Gross yield above 8%"],
    negativeDrivers: [],
    missingDataWarnings: ["No comparable evidence yet"],
    verifyBeforeTrusting: ["Review title/legal pack"],
  },
  scoreBreakdown: { incomeQuality: 80, tenantSecurity: 75, marketPricing: 72, upside: 58, riskExit: 66 },
  insights: { mispricing: "", couldGoWrong: "", askAgent: "", negotiation: "" },
  thumbnail: "",
  postedAt: "2026-06-10T09:00:00Z",
};

const comparablePeers: Deal[] = Array.from({ length: 5 }, (_, index) => ({
  ...targetDeal,
  id: `peer-${index}`,
  title: `Peer ${index}`,
  netInitialYield: 6 + index,
  grossYield: 6 + index,
  pricePerSqft: 150 - index * 10,
}));

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/hooks/useDeals", () => ({
  useDeal: () => ({
    deal: targetDeal,
    data: [targetDeal, ...comparablePeers],
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("@/hooks/useDealSourceLinks", () => ({
  useDealSourceLinks: () => ({
    data: [{ id: "link-1", source_url: "https://example.com/asda" }],
  }),
}));

vi.mock("@/lib/watchlist", () => ({
  PIPELINE_STATUSES: ["Saved", "Reviewing", "Viewing Booked", "Offer Submitted", "Passed", "Purchased"],
  useWatchlist: () => ({
    isWatched: () => false,
    notes: {},
    setNote: vi.fn(),
    getPipelineStatus: () => undefined,
    setStatus: vi.fn(),
    saveToPipeline: vi.fn(),
  }),
}));

describe("DealDetail", () => {
  it("renders cleaned Comparable Evidence without the old polluted Area Intelligence section", () => {
    render(
      <MemoryRouter initialEntries={["/deal/imp-10a4m7"]}>
        <Routes>
          <Route path="/deal/:id" element={<DealDetail />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Comparable Evidence" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Area Intelligence" })).not.toBeInTheDocument();
    expect(screen.queryByText(/All UK average/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/local deals/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/47\.3%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/7,292/)).not.toBeInTheDocument();
    expect(screen.queryByText(/997 local deals/i)).not.toBeInTheDocument();
  });
});
