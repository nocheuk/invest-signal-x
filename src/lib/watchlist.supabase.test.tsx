import fs from "node:fs";
import path from "node:path";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WatchlistProvider, useWatchlist } from "@/lib/watchlist";

const watchlistDb = vi.hoisted(() => ({
  watchlist: null as null | { id: string; user_id: string; name: string },
  items: [] as Array<{ watchlist_id: string; deal_id: string }>,
  notes: [] as Array<{ watchlist_id: string; deal_id: string; note: string }>,
  insertedWatchlist: null as unknown,
  itemUpserts: [] as unknown[],
  noteUpserts: [] as unknown[],
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
            eq: (_column: string, watchlistId: string) => ({
              data: watchlistDb.items.filter((item) => item.watchlist_id === watchlistId).map((item) => ({ deal_id: item.deal_id })),
              error: null,
            }),
          }),
          upsert: async (payload: { watchlist_id: string; deal_id: string }, options: unknown) => {
            watchlistDb.itemUpserts.push({ payload, options });
            if (!watchlistDb.items.some((item) => item.watchlist_id === payload.watchlist_id && item.deal_id === payload.deal_id)) {
              watchlistDb.items.push(payload);
            }
            return { data: null, error: null };
          },
          delete: () => ({
            eq: () => ({
              eq: async () => ({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === "watchlist_notes") {
        return {
          select: () => ({
            eq: (_column: string, watchlistId: string) => ({
              data: watchlistDb.notes.filter((note) => note.watchlist_id === watchlistId).map((note) => ({ deal_id: note.deal_id, note: note.note })),
              error: null,
            }),
          }),
          upsert: async (payload: { watchlist_id: string; deal_id: string; note: string }, options: unknown) => {
            watchlistDb.noteUpserts.push({ payload, options });
            const itemExists = watchlistDb.items.some((item) => item.watchlist_id === payload.watchlist_id && item.deal_id === payload.deal_id);
            if (!itemExists) return { data: null, error: new Error("RLS blocked note without owned watchlist item") };
            const existing = watchlistDb.notes.find((note) => note.watchlist_id === payload.watchlist_id && note.deal_id === payload.deal_id);
            if (existing) existing.note = payload.note;
            else watchlistDb.notes.push(payload);
            return { data: null, error: null };
          },
          delete: () => ({
            eq: () => ({
              eq: async () => ({ data: null, error: null }),
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
      <div>Note: {watchlist.notes["ds-001"] || ""}</div>
      <button onClick={() => void watchlist.toggle("ds-001")}>Add item</button>
      <button onClick={() => void watchlist.setNote("ds-001", "First note")}>Create note</button>
      <button onClick={() => void watchlist.setNote("ds-001", "Updated note")}>Update note</button>
    </div>
  );
}

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><WatchlistProvider>{children}</WatchlistProvider></QueryClientProvider>;
}

describe("WatchlistProvider Supabase persistence", () => {
  beforeEach(() => {
    watchlistDb.watchlist = null;
    watchlistDb.items = [];
    watchlistDb.notes = [];
    watchlistDb.insertedWatchlist = null;
    watchlistDb.itemUpserts = [];
    watchlistDb.noteUpserts = [];
  });

  it("creates watchlists and items for the real authenticated user id", async () => {
    render(<Probe />, { wrapper });
    screen.getByText("Add item").click();

    await waitFor(() => expect(watchlistDb.insertedWatchlist).toMatchObject({ user_id: "real-user-id" }));
    expect(watchlistDb.itemUpserts[0]).toMatchObject({
      payload: { watchlist_id: "watchlist-1", deal_id: "ds-001" },
      options: { onConflict: "watchlist_id,deal_id" },
    });
  });

  it("authenticated user can create a note for their own watchlist item", async () => {
    render(<Probe />, { wrapper });
    screen.getByText("Create note").click();

    await waitFor(() => expect(screen.getByText("Note: First note")).toBeInTheDocument());
    expect(watchlistDb.itemUpserts[0]).toMatchObject({ payload: { watchlist_id: "watchlist-1", deal_id: "ds-001" } });
    expect(watchlistDb.noteUpserts[0]).toMatchObject({
      payload: { watchlist_id: "watchlist-1", deal_id: "ds-001", note: "First note" },
      options: { onConflict: "watchlist_id,deal_id" },
    });
  });

  it("authenticated user can update their own note", async () => {
    render(<Probe />, { wrapper });
    screen.getByText("Create note").click();
    await waitFor(() => expect(screen.getByText("Note: First note")).toBeInTheDocument());
    screen.getByText("Update note").click();

    await waitFor(() => expect(screen.getByText("Note: Updated note")).toBeInTheDocument());
    expect(watchlistDb.notes).toEqual([{ watchlist_id: "watchlist-1", deal_id: "ds-001", note: "Updated note" }]);
  });

  it("note persists after refresh from Supabase state", async () => {
    watchlistDb.watchlist = { id: "watchlist-1", user_id: "real-user-id", name: "My Watchlist" };
    watchlistDb.items = [{ watchlist_id: "watchlist-1", deal_id: "ds-001" }];
    watchlistDb.notes = [{ watchlist_id: "watchlist-1", deal_id: "ds-001", note: "Persisted note" }];

    render(<Probe />, { wrapper });

    await waitFor(() => expect(screen.getByText("Note: Persisted note")).toBeInTheDocument());
    expect(screen.getByText("Items: ds-001")).toBeInTheDocument();
  });
});

describe("watchlist note RLS migration", () => {
  it("requires notes to belong to an authenticated user's own watchlist item", () => {
    const sql = fs.readFileSync(path.resolve("supabase/migrations/20260508100000_fix_watchlist_notes_ownership.sql"), "utf8");
    expect(sql).toContain("foreign key (watchlist_id, deal_id)");
    expect(sql).toContain("references public.watchlist_items(watchlist_id, deal_id)");
    expect(sql).toContain("w.user_id = (select auth.uid())");
    expect(sql).toContain("Users can manage own watchlist item notes");
  });
});
