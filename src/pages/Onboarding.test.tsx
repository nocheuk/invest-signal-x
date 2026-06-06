import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Onboarding from "@/pages/Onboarding";

const profileUpdateSpy = vi.hoisted(() => vi.fn());
const strategySaveSpy = vi.hoisted(() => vi.fn());
const saveAlertSpy = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    isConfigured: true,
    loading: false,
    user: { id: "user-1", email: "user@example.com", user_metadata: {} },
  }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({
    data: { id: "user-1", full_name: "User", company: null, preferences: {}, alert_preferences: {} },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("@/lib/strategy", () => {
  const PRESETS = {
    Balanced: { yield: 60, growth: 60, discount: 60, risk: 60, demand: 60 },
    Cashflow: { yield: 90, growth: 35, discount: 55, risk: 75, demand: 70 },
    Growth: { yield: 35, growth: 90, discount: 55, risk: 50, demand: 65 },
    Value: { yield: 65, growth: 55, discount: 90, risk: 60, demand: 55 },
    Opportunistic: { yield: 80, growth: 75, discount: 85, risk: 30, demand: 50 },
  };
  return {
    PRESETS,
    useStrategy: () => ({ save: strategySaveSpy }),
  };
});

vi.mock("@/hooks/useSavedAlerts", () => ({
  useSavedAlerts: () => ({ saveAlert: saveAlertSpy }),
}));

vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: true,
  requireSupabase: () => ({
    from: (table: string) => {
      if (table !== "profiles") throw new Error(`Unexpected table ${table}`);
      return {
        update: (payload: unknown) => {
          profileUpdateSpy(payload);
          return {
            eq: () => ({ error: null }),
          };
        },
      };
    },
  }),
}));

function renderOnboarding(initialPath = "/onboarding") {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/dashboard" element={<div>Dashboard page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("Investor onboarding", () => {
  beforeEach(() => {
    profileUpdateSpy.mockClear();
    strategySaveSpy.mockReset();
    strategySaveSpy.mockResolvedValue(undefined);
    saveAlertSpy.mockReset();
    saveAlertSpy.mockResolvedValue(undefined);
  });

  it("saves a skipped onboarding state", async () => {
    renderOnboarding();

    fireEvent.click(screen.getByRole("button", { name: /skip for now/i }));

    await waitFor(() => expect(profileUpdateSpy).toHaveBeenCalled());
    expect(profileUpdateSpy.mock.calls[0][0]).toMatchObject({
      preferences: {
        onboarding_completed: true,
        investor_onboarding: expect.objectContaining({ skippedAt: expect.any(String) }),
      },
    });
    expect(strategySaveSpy).not.toHaveBeenCalled();
    expect(saveAlertSpy).not.toHaveBeenCalled();
    expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
  });

  it("saves preferences, strategy weights, and a suggested first alert", async () => {
    renderOnboarding();

    fireEvent.click(screen.getByRole("button", { name: /developer/i }));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /auction opportunities/i }));
    fireEvent.click(screen.getByRole("button", { name: /opportunistic/i }));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    fireEvent.change(screen.getByPlaceholderText("Bournemouth, Poole, Dorset"), { target: { value: "Southampton, Hampshire" } });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /only green candidates/i }));
    fireEvent.click(screen.getByRole("button", { name: /save acquisition brief/i }));

    await waitFor(() => expect(profileUpdateSpy).toHaveBeenCalled());
    expect(profileUpdateSpy.mock.calls[0][0]).toMatchObject({
      preferences: {
        onboarding_completed: true,
        investor_onboarding: expect.objectContaining({
          investorType: "Developer",
          strategy: "Auction opportunities",
          targetLocations: ["Southampton", "Hampshire"],
          alertPreference: "Only Green Candidates",
        }),
      },
      alert_preferences: expect.objectContaining({ email: true, min_score: 72 }),
    });
    expect(strategySaveSpy).toHaveBeenCalledWith(expect.objectContaining({
      preset: "Opportunistic",
      weights: expect.objectContaining({ discount: expect.any(Number) }),
    }));
    expect(saveAlertSpy).toHaveBeenCalledWith(expect.objectContaining({
      locationQuery: "Southampton",
      minScore: 72,
      enabled: true,
    }));
    expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
  });
});
