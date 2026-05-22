import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "@/pages/Dashboard";

const dealsState = vi.hoisted(() => ({
  deals: [],
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
    saveSearch: vi.fn(),
  }),
}));

vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: true,
}));

describe("Dashboard live location search", () => {
  beforeEach(() => {
    dealsState.deals = [];
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
});
