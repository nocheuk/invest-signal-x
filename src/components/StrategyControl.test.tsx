import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { StrategyControl } from "@/components/StrategyControl";

vi.mock("@/lib/strategy", () => ({
  useStrategy: () => ({
    name: "Balanced",
    weights: { yield: 60, risk: 60, demand: 60 },
  }),
}));

describe("StrategyControl", () => {
  it("routes strategy editing to acquisition brief edit mode", () => {
    render(
      <MemoryRouter>
        <StrategyControl />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: /edit strategy/i })).toHaveAttribute("href", "/onboarding?edit=1");
    expect(screen.getByRole("link", { name: /your strategy/i })).toHaveAttribute("href", "/onboarding?edit=1");
  });
});
