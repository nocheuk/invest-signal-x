import fs from "node:fs";
import path from "node:path";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WatchlistProvider, useWatchlist } from "@/lib/watchlist";

const watchlistDb = vi.hoisted(() => ({
  watchlist: null as null | { id: string; user_id: string; name: string },
  items: [] as Array<{ watchlist_id: string; user_id: string; deal_id: string; status: string; notes: string; next_action_date?: string | null; assigned_owner?: string; created_at?: string; updated_at?: string }>,
  stageHistory: [] as Array<{ user_id: string; deal_id: string; old_stage: string | null; new_stage: string }>,
  insertedWatchlist: null as unknown,
  itemUpserts: [] as unknown[],
  itemDeletes: [] as unknown[],
  returnEmptyItems: false,
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
                data: (watchlistDb.returnEmptyItems ? [] : watchlistDb.items)
                  .filter((item) => item.user_id === userId)
                  .map((item) => ({
                    deal_id: item.deal_id,
                    status: item.status,
                    notes: item.notes,
                    next_action_date: item.next_action_date ?? null,
                    assigned_owner: item.assigned_owner ?? "",
                    created_at: item.created_at ?? "2026-05-30T10:00:00Z",
                    updated_at: item.updated_at ?? "2026-05-30T10:00:00Z",
                  })),
                error: null,
              }),
            }),
          }),
          upsert: (
            payload: { watchlist_id: string; user_id: string; deal_id: string; status: string; notes: string; next_action_date?: string | null; assigned_owner?: string },
            options: unknown
          ) => {
            watchlistDb.itemUpserts.push({ payload, options });
            const existing = watchlistDb.items.find((item) => item.user_id === payload.user_id && item.deal_id === payload.deal_id);
            if (existing) Object.assign(existing, payload);
            else watchlistDb.items.push(payload);
            return {
              select: () => ({
                single: async () => ({
                  data: {
                    deal_id: payload.deal_id,
                    status: payload.status,
                    notes: payload.notes,
                    next_action_date: payload.next_action_date ?? null,
                    assigned_owner: payload.assigned_owner ?? "",
                    created_at: "2026-05-30T10:00:00Z",
                    updated_at: "2026-05-30T10:01:00Z",
                  },
                  error: null,
                }),
              }),
            };
          },
          delete: () => ({
            eq: (_column: string, userId: string) => ({
              eq: async (_dealColumn: string, dealId: string) => {
                watchlistDb.itemDeletes.push({ userId, dealId });
                watchlistDb.items = watchlistDb.items.filter((item) => !(item.user_id === userId && item.deal_id === dealId));
                return { data: null, error: null };
              },
            }),
          }),
        };
      }
      if (table === "watchlist_stage_history") {
        return {
          insert: async (payload: { user_id: string; deal_id: string; old_stage: string | null; new_stage: string }) => {
            watchlistDb.stageHistory.push(payload);
            return { data: payload, error: null };
          },
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
      <div>Next action: {watchlist.pipelineItems["ds-001"]?.nextActionDate || ""}</div>
      <div>Owner: {watchlist.pipelineItems["ds-001"]?.assignedOwner || ""}</div>
      <div>New count: {watchlist.pipelineCounts.New}</div>
      <button onClick={() => void watchlist.saveToPipeline("ds-001")}>Save pipeline</button>
      <button onClick={() => void watchlist.setStatus("ds-001", "Agent Contacted")}>Change status</button>
      <button onClick={() => void watchlist.setPipelineItem("ds-001", { nextActionDate: "2026-06-20", assignedOwner: "Dana" })}>Plan next step</button>
      <button onClick={() => void watchlist.setNote("ds-001", "First note")}>Create note</button>
      <button onClick={() => void watchlist.setNote("ds-001", "Updated note")}>Update note</button>
      <button onClick={() => void watchlist.remove("ds-001")}>Remove pipeline</button>
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
    watchlistDb.stageHistory = [];
    watchlistDb.insertedWatchlist = null;
    watchlistDb.itemUpserts = [];
    watchlistDb.itemDeletes = [];
    watchlistDb.returnEmptyItems = false;
  });

  it("creates one pipeline item for the real authenticated user id", async () => {
    render(<Probe />, { wrapper });
    screen.getByText("Save pipeline").click();

    await waitFor(() => expect(watchlistDb.insertedWatchlist).toMatchObject({ user_id: "real-user-id" }));
    expect(watchlistDb.itemUpserts[0]).toMatchObject({
      payload: { watchlist_id: "watchlist-1", user_id: "real-user-id", deal_id: "ds-001", status: "New", notes: "", next_action_date: null, assigned_owner: "" },
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
    expect(watchlistDb.itemDeletes).toEqual([]);
  });

  it("changes status at any time", async () => {
    render(<Probe />, { wrapper });
    screen.getByText("Change status").click();

    await waitFor(() => expect(screen.getByText("Status: Agent Contacted")).toBeInTheDocument());
    expect(watchlistDb.items[0]).toMatchObject({ status: "Agent Contacted" });
    await waitFor(() => expect(watchlistDb.stageHistory).toEqual([
      { user_id: "real-user-id", deal_id: "ds-001", old_stage: null, new_stage: "Agent Contacted" },
    ]));
    expect(watchlistDb.itemDeletes).toEqual([]);
  });

  it("saves next action date and assigned owner on the pipeline item", async () => {
    render(<Probe />, { wrapper });
    screen.getByText("Plan next step").click();

    await waitFor(() => expect(screen.getByText("Next action: 2026-06-20")).toBeInTheDocument());
    expect(screen.getByText("Owner: Dana")).toBeInTheDocument();
    expect(watchlistDb.items[0]).toMatchObject({
      status: "New",
      next_action_date: "2026-06-20",
      assigned_owner: "Dana",
    });
    expect(watchlistDb.stageHistory).toEqual([]);
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
    expect(watchlistDb.itemDeletes).toEqual([]);
  });

  it("only removes a saved item when remove is explicitly called", async () => {
    render(<Probe />, { wrapper });
    screen.getByText("Save pipeline").click();
    await waitFor(() => expect(screen.getByText("Items: ds-001")).toBeInTheDocument());

    expect(watchlistDb.items).toHaveLength(1);
    expect(watchlistDb.itemDeletes).toEqual([]);

    screen.getByText("Remove pipeline").click();

    await waitFor(() => expect(screen.getByText("Items:")).toBeInTheDocument());
    expect(watchlistDb.items).toHaveLength(0);
    expect(watchlistDb.itemDeletes).toEqual([{ userId: "real-user-id", dealId: "ds-001" }]);
  });

  it("keeps a just-saved item visible if a stale refetch briefly omits it", async () => {
    watchlistDb.returnEmptyItems = true;
    render(<Probe />, { wrapper });
    screen.getByText("Save pipeline").click();

    await waitFor(() => expect(screen.getByText("Items: ds-001")).toBeInTheDocument());
    expect(screen.getByText("Status: New")).toBeInTheDocument();
    expect(watchlistDb.itemDeletes).toEqual([]);
  });

  it("pipeline item persists after refresh from Supabase state", async () => {
    watchlistDb.watchlist = { id: "watchlist-1", user_id: "real-user-id", name: "My Pipeline" };
    watchlistDb.items = [{ watchlist_id: "watchlist-1", user_id: "real-user-id", deal_id: "ds-001", status: "Reviewing", notes: "Persisted note", next_action_date: "2026-06-21", assigned_owner: "Dana" }];

    render(<Probe />, { wrapper });

    await waitFor(() => expect(screen.getByText("Note: Persisted note")).toBeInTheDocument());
    expect(screen.getByText("Items: ds-001")).toBeInTheDocument();
    expect(screen.getByText("Status: Reviewing")).toBeInTheDocument();
    expect(screen.getByText("Next action: 2026-06-21")).toBeInTheDocument();
    expect(screen.getByText("Owner: Dana")).toBeInTheDocument();
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

  it("adds V2 pipeline fields, stages, and stage history", () => {
    const sql = fs.readFileSync(path.resolve("supabase/migrations/20260613123000_acquisition_pipeline_v2.sql"), "utf8");
    expect(sql).toContain("add column if not exists next_action_date date");
    expect(sql).toContain("add column if not exists assigned_owner text");
    expect(sql).toContain("create table if not exists public.watchlist_stage_history");
    expect(sql).toContain("'Agent Contacted'");
    expect(sql).toContain("'Brochure Requested'");
    expect(sql).toContain("'Under Offer'");
    expect(sql).toContain("Users can insert own watchlist stage history");
  });
});
