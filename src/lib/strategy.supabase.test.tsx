import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { StrategyProvider, useStrategy } from "@/lib/strategy";

const strategyDb = vi.hoisted(() => ({
  upsertPayload: null as unknown,
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: { id: "real-user-id" } }),
}));

vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: true,
  requireSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
      update: () => ({
        eq: () => ({
          eq: async () => ({ data: null, error: null }),
        }),
      }),
      upsert: (payload: unknown) => {
        strategyDb.upsertPayload = payload;
        return {
          select: () => ({
            single: async () => ({
              data: { ...(payload as object), id: "strategy-1" },
              error: null,
            }),
          }),
        };
      },
    }),
  }),
}));

function Probe() {
  const strategy = useStrategy();
  return <button onClick={() => void strategy.save({ name: "Real Strategy", preset: "Balanced", weights: strategy.weights })}>Save</button>;
}

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><StrategyProvider>{children}</StrategyProvider></QueryClientProvider>;
}

describe("StrategyProvider Supabase persistence", () => {
  it("saves strategies against the real authenticated user id", async () => {
    render(<Probe />, { wrapper });
    screen.getByText("Save").click();

    await waitFor(() => expect(strategyDb.upsertPayload).toMatchObject({ user_id: "real-user-id", name: "Real Strategy" }));
  });
});
