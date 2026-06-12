import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase/client";
import { trackUserEvent } from "@/lib/usageTracking";

export const PIPELINE_STATUSES = ["Saved", "Reviewing", "Viewing Booked", "Offer Submitted", "Passed", "Purchased"] as const;
export type PipelineStatus = typeof PIPELINE_STATUSES[number];

export type PipelineItem = {
  dealId: string;
  status: PipelineStatus;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
};

type WatchlistState = {
  watchlistId?: string;
  ids: string[];
  notes: Record<string, string>;
  pipelineItems: Record<string, PipelineItem>;
};

type PipelinePatch = {
  status?: PipelineStatus;
  notes?: string;
};

type WatchlistContextType = WatchlistState & {
  isSaving: boolean;
  error: string | null;
  pipelineCounts: Record<PipelineStatus, number>;
  toggle: (id: string) => Promise<void>;
  isWatched: (id: string) => boolean;
  getPipelineStatus: (id: string) => PipelineStatus | undefined;
  saveToPipeline: (id: string, status?: PipelineStatus) => Promise<void>;
  setStatus: (id: string, status: PipelineStatus) => Promise<void>;
  setPipelineItem: (id: string, patch: PipelinePatch) => Promise<void>;
  setNote: (id: string, note: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

const WatchlistContext = createContext<WatchlistContextType | null>(null);

const KEY = "dealsignal:watchlist";
const NOTES_KEY = "dealsignal:notes";
const PIPELINE_KEY = "dealsignal:pipeline";
const SEEDED_KEY = "dealsignal:seeded";
const DEFAULT_IDS = ["ds-001", "ds-002", "ds-010"];

function isPipelineStatus(value: unknown): value is PipelineStatus {
  return typeof value === "string" && PIPELINE_STATUSES.includes(value as PipelineStatus);
}

function normalizePipelineItem(item: Partial<PipelineItem> & { dealId: string }): PipelineItem {
  return {
    dealId: item.dealId,
    status: isPipelineStatus(item.status) ? item.status : "Saved",
    notes: item.notes ?? "",
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function buildState(watchlistId: string | undefined, items: PipelineItem[]): WatchlistState {
  const pipelineItems = Object.fromEntries(items.map((item) => [item.dealId, normalizePipelineItem(item)]));
  return {
    watchlistId,
    ids: Object.keys(pipelineItems),
    notes: Object.fromEntries(Object.values(pipelineItems).filter((item) => item.notes).map((item) => [item.dealId, item.notes])),
    pipelineItems,
  };
}

function readLocalState(): WatchlistState {
  let ids: string[] = [];
  let notes: Record<string, string> = {};
  let storedItems: Record<string, PipelineItem> = {};
  try {
    ids = JSON.parse(localStorage.getItem(KEY) || "[]");
    notes = JSON.parse(localStorage.getItem(NOTES_KEY) || "{}");
    storedItems = JSON.parse(localStorage.getItem(PIPELINE_KEY) || "{}");
  } catch {
    ids = [];
    notes = {};
    storedItems = {};
  }
  if (ids.length === 0 && Object.keys(storedItems).length === 0 && !localStorage.getItem(SEEDED_KEY)) {
    ids = DEFAULT_IDS;
    localStorage.setItem(SEEDED_KEY, "1");
  }
  const mergedIds = Array.from(new Set([...ids, ...Object.keys(storedItems), ...Object.keys(notes)]));
  return buildState(undefined, mergedIds.map((dealId) => normalizePipelineItem({
    dealId,
    status: storedItems[dealId]?.status,
    notes: storedItems[dealId]?.notes ?? notes[dealId] ?? "",
    createdAt: storedItems[dealId]?.createdAt,
    updatedAt: storedItems[dealId]?.updatedAt,
  })));
}

async function ensureWatchlist(userId: string) {
  const db = requireSupabase();
  const { data: existing, error: existingError } = await db
    .from("watchlists")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing;

  const { data, error } = await db
    .from("watchlists")
    .insert({ user_id: userId, name: "My Pipeline" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

function nextStateFromPatch(state: WatchlistState, dealId: string, patch: PipelinePatch): WatchlistState {
  const existing = state.pipelineItems[dealId];
  const item = normalizePipelineItem({
    dealId,
    status: patch.status ?? existing?.status ?? "Saved",
    notes: patch.notes ?? existing?.notes ?? "",
    createdAt: existing?.createdAt,
    updatedAt: new Date().toISOString(),
  });
  return buildState(state.watchlistId, [...Object.values(state.pipelineItems).filter((current) => current.dealId !== dealId), item]);
}

function nextStateAfterRemove(state: WatchlistState, dealId: string): WatchlistState {
  return buildState(state.watchlistId, Object.values(state.pipelineItems).filter((item) => item.dealId !== dealId));
}

function currentPage() {
  if (typeof window === "undefined") return "unknown";
  return `${window.location.pathname}${window.location.search}`;
}

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [state, setState] = useState<WatchlistState>(() => isSupabaseConfigured ? { ids: [], notes: {}, pipelineItems: {} } : readLocalState());
  const [error, setError] = useState<string | null>(null);
  const locallyChangedItems = useRef<Record<string, PipelineItem>>({});
  const queryKey = ["watchlist", auth.user?.id];

  const watchlistQuery = useQuery({
    queryKey,
    enabled: isSupabaseConfigured && Boolean(auth.user?.id),
    queryFn: async (): Promise<WatchlistState> => {
      const watchlist = await ensureWatchlist(auth.user!.id);
      const { data: items, error: itemsError } = await requireSupabase()
        .from("watchlist_items")
        .select("deal_id,status,notes,created_at,updated_at")
        .eq("user_id", auth.user!.id)
        .order("updated_at", { ascending: false });
      if (itemsError) throw itemsError;
      return buildState(watchlist.id, (items ?? []).map((item) => normalizePipelineItem({
        dealId: item.deal_id,
        status: item.status,
        notes: item.notes ?? "",
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      })));
    },
  });

  useEffect(() => {
    if (!isSupabaseConfigured) {
      localStorage.setItem(KEY, JSON.stringify(state.ids));
      localStorage.setItem(NOTES_KEY, JSON.stringify(state.notes));
      localStorage.setItem(PIPELINE_KEY, JSON.stringify(state.pipelineItems));
    }
  }, [state]);

  const upsertMutation = useMutation({
    mutationFn: async ({ dealId, patch }: { dealId: string; patch: PipelinePatch }) => {
      if (!isSupabaseConfigured) return;
      if (!auth.user) throw new Error("Cannot update pipeline without an authenticated Supabase user.");
      const watchlist = state.watchlistId ? { id: state.watchlistId } : await ensureWatchlist(auth.user.id);
      const existing = state.pipelineItems[dealId];
      const payload = {
        watchlist_id: watchlist.id,
        user_id: auth.user.id,
        deal_id: dealId,
        status: patch.status ?? existing?.status ?? "Saved",
        notes: patch.notes ?? existing?.notes ?? "",
      };
      const { data, error: upsertError } = await requireSupabase()
        .from("watchlist_items")
        .upsert(payload, { onConflict: "user_id,deal_id" })
        .select("deal_id,status,notes,created_at,updated_at")
        .single();
      if (upsertError) throw upsertError;
      return {
        watchlistId: watchlist.id,
        item: normalizePipelineItem({
          dealId: data.deal_id,
          status: data.status,
          notes: data.notes ?? "",
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        }),
      };
    },
    onMutate: async ({ dealId, patch }) => {
      setError(null);
      await queryClient.cancelQueries({ queryKey });
      const previous = state;
      const next = nextStateFromPatch(state, dealId, patch);
      locallyChangedItems.current[dealId] = next.pipelineItems[dealId];
      setState(next);
      queryClient.setQueryData(queryKey, next);
      return { previous };
    },
    onError: (mutationError, _vars, context) => {
      if (context?.previous) setState(context.previous);
      setError(mutationError instanceof Error ? mutationError.message : "Could not update pipeline.");
    },
    onSuccess: (saved) => {
      if (saved?.item) {
        locallyChangedItems.current[saved.item.dealId] = saved.item;
        setState((current) => buildState(saved.watchlistId ?? current.watchlistId, [
          ...Object.values(current.pipelineItems).filter((item) => item.dealId !== saved.item.dealId),
          saved.item,
        ]));
      }
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async ({ dealId }: { dealId: string }) => {
      if (!isSupabaseConfigured) return;
      if (!auth.user) throw new Error("Cannot update pipeline without an authenticated Supabase user.");
      const { error: deleteError } = await requireSupabase()
        .from("watchlist_items")
        .delete()
        .eq("user_id", auth.user.id)
        .eq("deal_id", dealId);
      if (deleteError) throw deleteError;
    },
    onMutate: async ({ dealId }) => {
      setError(null);
      await queryClient.cancelQueries({ queryKey });
      const previous = state;
      const next = nextStateAfterRemove(state, dealId);
      delete locallyChangedItems.current[dealId];
      setState(next);
      queryClient.setQueryData(queryKey, next);
      return { previous };
    },
    onError: (mutationError, _vars, context) => {
      if (context?.previous) setState(context.previous);
      setError(mutationError instanceof Error ? mutationError.message : "Could not remove deal from pipeline.");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  useEffect(() => {
    if (watchlistQuery.data && !upsertMutation.isPending && !removeMutation.isPending) {
      const localItems = Object.values(locallyChangedItems.current);
      const serverDealIds = new Set(watchlistQuery.data.ids);
      const stillMissingLocallyChangedItems = localItems.filter((item) => !serverDealIds.has(item.dealId));
      locallyChangedItems.current = Object.fromEntries(stillMissingLocallyChangedItems.map((item) => [item.dealId, item]));
      setState(buildState(watchlistQuery.data.watchlistId, [
        ...Object.values(watchlistQuery.data.pipelineItems),
        ...stillMissingLocallyChangedItems,
      ]));
    }
  }, [removeMutation.isPending, upsertMutation.isPending, watchlistQuery.data]);

  const pipelineCounts = useMemo(() => {
    const counts = Object.fromEntries(PIPELINE_STATUSES.map((status) => [status, 0])) as Record<PipelineStatus, number>;
    Object.values(state.pipelineItems).forEach((item) => {
      counts[item.status] += 1;
    });
    return counts;
  }, [state.pipelineItems]);

  const value = useMemo<WatchlistContextType>(() => ({
    ...state,
    pipelineCounts,
    isSaving: upsertMutation.isPending || removeMutation.isPending,
    error,
    toggle: async (id) => {
      if (state.ids.includes(id)) await removeMutation.mutateAsync({ dealId: id });
      else await upsertMutation.mutateAsync({ dealId: id, patch: { status: "Saved" } });
    },
    isWatched: (id) => state.ids.includes(id),
    getPipelineStatus: (id) => state.pipelineItems[id]?.status,
    saveToPipeline: async (id, status = "Saved") => {
      await upsertMutation.mutateAsync({ dealId: id, patch: { status } });
      void trackUserEvent(auth.user?.id, {
        eventType: "saved_to_pipeline",
        dealId: id,
        currentPage: currentPage(),
        metadata: { status },
      });
    },
    setStatus: async (id, status) => {
      await upsertMutation.mutateAsync({ dealId: id, patch: { status } });
    },
    setPipelineItem: async (id, patch) => {
      await upsertMutation.mutateAsync({ dealId: id, patch });
    },
    setNote: async (id, note) => {
      await upsertMutation.mutateAsync({ dealId: id, patch: { notes: note } });
    },
    remove: async (id) => {
      await removeMutation.mutateAsync({ dealId: id });
    },
  }), [auth.user?.id, error, pipelineCounts, removeMutation, state, upsertMutation]);

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

export const useWatchlist = () => {
  const ctx = useContext(WatchlistContext);
  if (!ctx) throw new Error("useWatchlist must be used within WatchlistProvider");
  return ctx;
};
