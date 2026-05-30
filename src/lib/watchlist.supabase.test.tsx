import fs from "node:fs";
import path from "node:path";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WatchlistProvider, useWatchlist } from "@/lib/watchlist";

const watchlistDb = vi.hoisted(() => ({
  watchlist: null as null | { id: string; user_id: string; name: string },
  items: [] as Array<{ watchlist_id: string; user_id: string; deal_id: string; status: string; notes: string; created_at?: string; updated_at?: string }>,
  insertedWatchlist: null as unknown,
  itemUpserts: [] as unknown[],
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
            eq: (_column: string, userId: string) => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({
                    data: watchlistDb.watchlist?.user_id === userId ? watchlistDb.watchlist : null,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
          insert: (payload: { user_id: string; name: string }) => {
            watchlistDb.insertedWatchlist = payload;
            watchlistDb.watchlist = { id: "watchlist-1", ...payload };
            return {
              select: () => ({
                single: async () => ({ data: watchlistDb.watchlist, error: null }),
              }),
            };
          },
        };
      }
      if (table === "watchlist_items") {
        return {
          select: () => ({
            eq: (_column: string, userId: string) => ({
              order: () => ({
                data: watchlistDb.items
                  .filter((item) => item.user_id === userId)
                  .map((item) => ({
                    deal_id: item.deal_id,
                    status: item.status,
                    notes: item.notes,
                    created_at: item.created_at ?? "2026-05-30T10:00:00Z",
                    updated_at: item.updated_at ?? "2026-05-30T10:00:00Z",
                  })),
                error: null,
              }),
            }),
          }),
          upsert: async (
            payload: { watchlist_id: string; user_id: string; deal_id: string; status: string; notes: string },
            options: unknown
          ) => {
            watchlistDb.itemUpserts.push({ payload, options });
            const existing = watchlistDb.items.find((item) => item.user_id === payload.user_id && item.deal_id === payload.deal_id);
            if (existing) Object.assign(existing, payload);
            else watchlistDb.items.push(payload);
            return { data: null, error: null };
          },
          delete: () => ({
            eq: (_column: string, userId: string) => ({
              eq: async (_dealColumn: string, dealId: string) => {
                watchlistDb.items = watchlistDb.items.filter((item) => !(item.user_id === userId && item.deal_id === dealId));
                return { data: null, error: null };
              },
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  }),
}));

function Probe() {
  const watchlist = useWatchlist();
  return (
    <div>
      <div>Items: {watchlist.ids.join(",")}</div>
      <div>Status: {watchlist.getPipelineStatus("ds-001") || ""}</div>
      <div>Note: {watchlist.notes["ds-001"] || ""}</div>
      <div>Saved count: {watchlist.pipelineCounts.Saved}</div>
      <button onClick={() => void watchlist.saveToPipeline("ds-001")}>Save pipeline</button>
      <button onClick={() => void watchlist.setStatus("ds-001", "Viewing Booked")}>Change status</button>
      <button onClick={() => void watchlist.setNote("ds-001", "First note")}>Create note</button>
      <button onClick={() => void watchlist.setNote("ds-001", "Updated note")}>Update note</button>
    </div>
  );
}

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><WatchlistProvider>{children}</WatchlistProvider></QueryClientProvider>;
}

describe("WatchlistProvider Supabase pipeline persistence", () => {
  beforeEach(() => {
    watchlistDb.watchlist = null;
    watchlistDb.items = [];
    watchlistDb.insertedWatchlist = null;
    watchlistDb.itemUpserts = [];
  });

  it("creates one pipeline item for the real authenticated user id", async () => {
    render(<Probe />, { wrapper });
    screen.getByText("Save pipeline").click();

    await waitFor(() => expect(watchlistDb.insertedWatchlist).toMatchObject({ user_id: "real-user-id" }));
    expect(watchlistDb.itemUpserts[0]).toMatchObject({
      payload: { watchlist_id: "watchlist-1", user_id: "real-user-id", deal_id: "ds-001", status: "Saved", notes: "" },
      options: { onConflict: "user_id,deal_id" },
    });
  });

  it("prevents duplicate pipeline items for the same user and deal", async () => {
    render(<Probe />, { wrapper });
    screen.getByText("Save pipeline").click();
    screen.getByText("Save pipeline").click();

    await waitFor(() => expect(watchlistDb.itemUpserts.length).toBe(2));
    expect(watchlistDb.items).toHaveLength(1);
    expect(watchlistDb.items[0]).toMatchObject({ user_id: "real-user-id", deal_id: "ds-001" });
  });

  it("changes status at any time", async () => {
    render(<Probe />, { wrapper });
    screen.getByText("Change status").click();

    await waitFor(() => expect(screen.getByText("Status: Viewing Booked")).toBeInTheDocument());
    expect(watchlistDb.items[0]).toMatchObject({ status: "Viewing Booked" });
  });

  it("saves and updates private notes on the user's pipeline item", async () => {
    render(<Probe />, { wrapper });
    screen.getByText("Create note").click();
    await waitFor(() => expect(screen.getByText("Note: First note")).toBeInTheDocument());
    screen.getByText("Update note").click();

    await waitFor(() => expect(screen.getByText("Note: Updated note")).toBeInTheDocument());
    expect(watchlistDb.items).toEqual([
      expect.objectContaining({ user_id: "real-user-id", deal_id: "ds-001", notes: "Updated note" }),
    ]);
  });

  it("pipeline item persists after refresh from Supabase state", async () => {
    watchlistDb.watchlist = { id: "watchlist-1", user_id: "real-user-id", name: "My Pipeline" };
    watchlistDb.items = [{ watchlist_id: "watchlist-1", user_id: "real-user-id", deal_id: "ds-001", status: "Reviewing", notes: "Persisted note" }];

    render(<Probe />, { wrapper });

    await waitFor(() => expect(screen.getByText("Note: Persisted note")).toBeInTheDocument());
    expect(screen.getByText("Items: ds-001")).toBeInTheDocument();
    expect(screen.getByText("Status: Reviewing")).toBeInTheDocument();
  });
});

describe("watchlist pipeline migration", () => {
  it("stores user-private status and notes on one item per user/deal", () => {
    const sql = fs.readFileSync(path.resolve("supabase/migrations/20260530130000_watchlist_pipeline_v1.sql"), "utf8");
    expect(sql).toContain("add column if not exists user_id");
    expect(sql).toContain("add column if not exists status");
    expect(sql).toContain("add column if not exists notes");
    expect(sql).toContain("watchlist_items_user_deal_unique");
    expect(sql).toContain("using (user_id = (select auth.uid()))");
  });
});
