import { describe, expect, it } from "vitest";
import {
  DEFAULT_ONBOARDING,
  alertFromOnboarding,
  buildProfilePreferences,
  dashboardDefaultsFromPreferences,
  getInvestorPreferences,
  isOnboardingComplete,
  strategyFromOnboarding,
} from "@/lib/onboarding";

describe("investor onboarding helpers", () => {
  it("detects incomplete and completed profile preferences", () => {
    expect(isOnboardingComplete({ preferences: {} })).toBe(false);
    expect(isOnboardingComplete({ preferences: { onboarding_completed: true } })).toBe(true);
  });

  it("builds persisted preferences and dashboard defaults", () => {
    const preferences = buildProfilePreferences({}, {
      ...DEFAULT_ONBOARDING,
      targetLocations: [" Bournemouth ", "Poole"],
      preferredAssetTypes: ["Retail"],
      minYieldTarget: 7,
    }, "completed");

    const investorPreferences = getInvestorPreferences({ preferences });
    expect(investorPreferences.onboardingCompleted).toBe(true);
    expect(investorPreferences.targetLocations).toEqual(["Bournemouth", "Poole"]);
    expect(dashboardDefaultsFromPreferences(investorPreferences)).toEqual({
      locationQuery: "Bournemouth",
      assetType: "Retail",
      minYield: 7,
    });
  });

  it("maps acquisition answers to strategy weights and a suggested alert", () => {
    const answers = {
      ...DEFAULT_ONBOARDING,
      strategy: "Auction opportunities",
      riskAppetite: "Opportunistic",
      targetLocations: ["Southampton"],
      budgetRange: "GBP 250k - GBP 500k",
      alertPreference: "Only Green Candidates",
    };

    expect(strategyFromOnboarding(answers).preset).toBe("Opportunistic");
    expect(strategyFromOnboarding(answers).weights.discount).toBeGreaterThanOrEqual(90);
    expect(alertFromOnboarding(answers)).toMatchObject({
      locationQuery: "Southampton",
      maxPrice: 500000,
      minScore: 72,
      enabled: true,
    });
  });

  it("does not suggest an alert when the user chooses no alerts yet", () => {
    expect(alertFromOnboarding({ ...DEFAULT_ONBOARDING, alertPreference: "No alerts yet" })).toBeNull();
  });
});
