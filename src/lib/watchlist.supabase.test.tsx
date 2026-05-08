import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { WatchlistProvider, useWatchlist } from "@/lib/watchlist";

const watchlistDb = vi.hoisted(() => ({
  insertedWatchlist: null as unknown,
  upsertItem: null as unknown,
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: { id: "real-user-id" } }),
}));

vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: true,
  requireSupabase: () => ({
    from: (table: string) => {
      if (table === "watchlists") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }),
          }),
          insert: (payload: unknown) => {
            watchlistDb.insertedWatchlist = payload;
            return {
              select: () => ({
                single: async () => ({ data: { id: "watchlist-1", ...(payload as object) }, error: null }),
              }),
            };
          },
        };
      }
      if (table === "watchlist_items") {
        return {
          select: () => ({
            eq: async () => ({ data: [], error: null }),
          }),
          upsert: async (payload: unknown) => {
            watchlistDb.upsertItem = payload;
            return { data: null, error: null };
          },
        };
      }
      return {
        select: () => ({
          eq: async () => ({ data: [], error: null }),
        }),
      };
    },
  }),
}));

function Probe() {
  const watchlist = useWatchlist();
  return <button onClick={() => void watchlist.toggle("ds-001")}>Add</button>;
}

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><WatchlistProvider>{children}</WatchlistProvider></QueryClientProvider>;
}

describe("WatchlistProvider Supabase persistence", () => {
  it("creates watchlists and items for the real authenticated user id", async () => {
    render(<Probe />, { wrapper });
    screen.getByText("Add").click();

    await waitFor(() => expect(watchlistDb.insertedWatchlist).toMatchObject({ user_id: "real-user-id" }));
    expect(watchlistDb.upsertItem).toMatchObject({ watchlist_id: "watchlist-1", deal_id: "ds-001" });
  });
});
