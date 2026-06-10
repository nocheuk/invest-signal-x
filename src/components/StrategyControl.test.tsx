import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
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
      <MemoryRouter initialEntries={["/deals?classification=green-candidate"]}>
        <Routes>
          <Route path="/deals" element={<StrategyControl />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: /edit strategy/i })).toHaveAttribute("href", "/onboarding?edit=1&returnTo=%2Fdeals%3Fclassification%3Dgreen-candidate");
    expect(screen.getByRole("link", { name: /your strategy/i })).toHaveAttribute("href", "/onboarding?edit=1&returnTo=%2Fdeals%3Fclassification%3Dgreen-candidate");
  });
});
