import { render, screen } from "@testing-library/react";
import type React from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Settings from "@/pages/Settings";

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: { email: "user@example.com", user_metadata: { full_name: "User Example" }, app_metadata: {} },
  }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({
    data: {
      full_name: "User Example",
      company: "Example Capital",
      preferences: {
        onboarding_completed: true,
        investor_onboarding: {
          investorType: "Private investor",
          strategy: "Income/yield",
          targetLocations: ["Bournemouth"],
          budgetRange: "GBP 500k - GBP 1m",
          minYieldTarget: 7,
          preferredAssetTypes: ["Retail"],
          riskAppetite: "Balanced",
          alertPreference: "Daily",
          completedAt: "2026-06-06T08:00:00Z",
        },
      },
    },
  }),
}));

describe("Settings acquisition brief", () => {
  it("shows the saved brief and edit link", () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );

    expect(screen.getByText("Your acquisition brief")).toBeInTheDocument();
    expect(screen.getByText(/Target locations: Bournemouth/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /edit acquisition brief/i })).toHaveAttribute("href", "/onboarding?edit=1&returnTo=%2Fsettings");
  });
});
