import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { StrategyProvider, useStrategy } from "@/lib/strategy";

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: false,
}));

function Probe() {
  const strategy = useStrategy();
  return (
    <div>
      <div>{strategy.name}</div>
      <button onClick={() => void strategy.save({ name: "Yield Hunt", preset: "Cashflow", weights: { yield: 90, growth: 35, discount: 55, risk: 75, demand: 70 } })}>
        Save
      </button>
    </div>
  );
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <StrategyProvider>{children}</StrategyProvider>
    </QueryClientProvider>
  );
}

describe("StrategyProvider", () => {
  it("saves strategy state through the mutation path", async () => {
    render(<Probe />, { wrapper });
    screen.getByText("Save").click();
    await waitFor(() => expect(screen.getByText("Yield Hunt")).toBeInTheDocument());
  });
});
