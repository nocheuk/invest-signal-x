import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Onboarding from "@/pages/Onboarding";

const profileUpdateSpy = vi.hoisted(() => vi.fn());
const profileUpsertErrorState = vi.hoisted(() => ({ errors: [] as Array<Error & { code?: string }> }));
const profileState = vi.hoisted(() => ({
  data: { id: "user-1", full_name: "User", company: null, preferences: {}, alert_preferences: {} } as Record<string, unknown>,
}));
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
    data: profileState.data,
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
        upsert: (payload: unknown) => {
          profileUpdateSpy(payload);
          return { error: profileUpsertErrorState.errors.shift() ?? null };
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
          <Route path="/settings" element={<div>Settings page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("Investor onboarding", () => {
  beforeEach(() => {
    profileUpdateSpy.mockClear();
    profileUpsertErrorState.errors = [];
    profileState.data = { id: "user-1", full_name: "User", company: null, preferences: {}, alert_preferences: {} };
    sessionStorage.clear();
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
        onboarding_skipped: true,
        investor_onboarding: expect.objectContaining({ skippedAt: expect.any(String) }),
      },
    });
    expect(strategySaveSpy).not.toHaveBeenCalled();
    expect(saveAlertSpy).not.toHaveBeenCalled();
    expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
  });

  it("handles a missing profile row by upserting onboarding completion", async () => {
    renderOnboarding();

    fireEvent.click(screen.getByRole("button", { name: /skip for now/i }));

    await waitFor(() => expect(profileUpdateSpy).toHaveBeenCalledWith(expect.objectContaining({
      id: "user-1",
      preferences: expect.objectContaining({ onboarding_completed: true }),
    })));
    expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
  });

  it("retries profile save without alert preferences when the live column is missing", async () => {
    const missingColumnError = Object.assign(new Error("column profiles.alert_preferences does not exist"), { code: "PGRST204" });
    profileUpsertErrorState.errors = [missingColumnError];
    renderOnboarding();

    fireEvent.click(screen.getByRole("button", { name: /skip for now/i }));

    await waitFor(() => expect(profileUpdateSpy).toHaveBeenCalledTimes(2));
    expect(profileUpdateSpy.mock.calls[0][0]).toHaveProperty("alert_preferences");
    expect(profileUpdateSpy.mock.calls[1][0]).not.toHaveProperty("alert_preferences");
    expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
  });

  it("saves preferences, strategy weights, and a suggested first alert", async () => {
    renderOnboarding();

    fireEvent.click(screen.getByRole("button", { name: /developer/i }));
    goToStep("Objective");
    fireEvent.click(screen.getByRole("button", { name: /auction opportunities/i }));
    goToStep("Locations");
    fireEvent.change(screen.getByPlaceholderText("Bournemouth, Dorset, Manchester"), { target: { value: "Southampton, Hampshire" } });
    goToStep("Capital");
    fireEvent.change(screen.getAllByRole("spinbutton")[1], { target: { value: "2000000" } });
    fireEvent.click(screen.getByRole("button", { name: /bridging finance/i }));
    goToStep("Assets");
    fireEvent.click(screen.getByRole("button", { name: /warehouse\/logistics/i }));
    fireEvent.click(screen.getByRole("button", { name: /development potential/i }));
    goToStep("Returns");
    fireEvent.click(screen.getByRole("button", { name: /opportunistic/i }));
    fireEvent.click(screen.getByRole("button", { name: /capital growth is a priority/i }));
    goToStep("Blockers");
    fireEvent.click(screen.getByRole("button", { name: /poa\/missing price/i }));
    goToStep("Alerts");
    fireEvent.click(screen.getByRole("button", { name: /only strong opportunities/i }));
    goToStep("Summary");
    expect(screen.getAllByText("Your acquisition brief").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /save acquisition brief/i }));

    await waitFor(() => expect(profileUpdateSpy).toHaveBeenCalled());
    expect(profileUpdateSpy.mock.calls[0][0]).toMatchObject({
      preferences: {
        onboarding_completed: true,
        investor_onboarding: expect.objectContaining({
          investorType: "Developer",
          strategy: "Auction opportunities",
          targetLocations: ["Southampton", "Hampshire"],
          maxBudget: 2000000,
          financingPosition: "Bridging finance",
          dealPreferences: expect.arrayContaining(["Development potential"]),
          dealBlockers: expect.arrayContaining(["POA/missing price"]),
          alertPreference: "Only Strong Opportunities",
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
  }, 20000);

  it("does not block completion when strategy save fails", async () => {
    strategySaveSpy.mockRejectedValueOnce(new Error("strategy insert denied"));
    renderOnboarding();

    advanceToSummaryWithLocation("Bournemouth");
    fireEvent.click(screen.getByRole("button", { name: /save acquisition brief/i }));

    await waitFor(() => expect(profileUpdateSpy).toHaveBeenCalled());
    expect(strategySaveSpy).toHaveBeenCalled();
    expect(saveAlertSpy).toHaveBeenCalled();
    expect(sessionStorage.getItem("dealsignal:onboarding-warning")).toMatch(/Your Strategy Score could not be updated/);
    expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
  }, 10000);

  it("does not block completion when suggested alert creation fails", async () => {
    saveAlertSpy.mockRejectedValueOnce(new Error("alert insert denied"));
    renderOnboarding();

    advanceToSummaryWithLocation("Bournemouth");
    fireEvent.click(screen.getByRole("button", { name: /save acquisition brief/i }));

    await waitFor(() => expect(profileUpdateSpy).toHaveBeenCalled());
    expect(saveAlertSpy).toHaveBeenCalled();
    expect(sessionStorage.getItem("dealsignal:onboarding-warning")).toMatch(/suggested alert could not be created/);
    expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
  });

  it("loads existing answers in edit mode and saves updates back to settings", async () => {
    profileState.data = {
      id: "user-1",
      full_name: "User",
      company: null,
      alert_preferences: {},
      preferences: {
        onboarding_completed: true,
        investor_onboarding: {
          investorType: "Developer",
          strategy: "Auction opportunities",
          targetLocations: ["Manchester", "Hampshire"],
          budgetRange: "GBP 1m - GBP 2.5m",
          minBudget: 1000000,
          maxBudget: 2500000,
          cashAvailable: "GBP 400k",
          financingPosition: "Bridging finance",
          minYieldTarget: 8,
          yieldNotImportant: false,
          capitalGrowthPriority: true,
          preferredAssetTypes: ["Industrial"],
          dealPreferences: ["Auction lots"],
          dealBlockers: ["POA/missing price"],
          riskAppetite: "Opportunistic",
          alertPreference: "Only Strong Opportunities",
          experienceLevel: "Experienced",
          completedAt: "2026-06-01T09:00:00Z",
        },
      },
    };
    renderOnboarding("/onboarding?edit=1");

    expect(screen.getByText("Edit your acquisition brief")).toBeInTheDocument();
    expect(screen.getByText("Manchester")).toBeInTheDocument();

    advanceToSummaryWithLocation("Poole, Dorset");
    fireEvent.click(screen.getByRole("button", { name: /save acquisition brief/i }));

    await waitFor(() => expect(profileUpdateSpy).toHaveBeenCalled());
    expect(profileUpdateSpy.mock.calls[0][0]).toMatchObject({
      preferences: {
        onboarding_completed: true,
        investor_onboarding: expect.objectContaining({
          investorType: "Developer",
          targetLocations: ["Poole", "Dorset"],
          alertPreference: "Only Strong Opportunities",
        }),
      },
    });
    expect(await screen.findByText("Settings page")).toBeInTheDocument();
  });

  it("respects a safe edit-mode return target after saving", async () => {
    renderOnboarding("/onboarding?edit=1&returnTo=%2Fdashboard");

    advanceToSummaryWithLocation("Bournemouth");
    fireEvent.click(screen.getByRole("button", { name: /save acquisition brief/i }));

    await waitFor(() => expect(profileUpdateSpy).toHaveBeenCalled());
    expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
  });

  it("surfaces the real profile save error in development", async () => {
    profileUpsertErrorState.errors = [new Error("RLS denied profile update")];
    renderOnboarding();

    fireEvent.click(screen.getByRole("button", { name: /skip for now/i }));

    expect(await screen.findByText("Could not save your onboarding answers.")).toBeInTheDocument();
    expect(screen.getByText(/RLS denied profile update/)).toBeInTheDocument();
    expect(screen.queryByText("Dashboard page")).not.toBeInTheDocument();
  });
});

function advanceToSummaryWithLocation(location: string) {
  goToStep("Locations");
  fireEvent.change(screen.getByPlaceholderText("Bournemouth, Dorset, Manchester"), { target: { value: location } });
  goToStep("Summary");
}

function goToStep(label: string) {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(label, "i") }));
}
