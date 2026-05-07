import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase/client";

type WatchlistState = {
  watchlistId?: string;
  ids: string[];
  notes: Record<string, string>;
};

type WatchlistContextType = WatchlistState & {
  isSaving: boolean;
  error: string | null;
  toggle: (id: string) => Promise<void>;
  isWatched: (id: string) => boolean;
  setNote: (id: string, note: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

const WatchlistContext = createContext<WatchlistContextType | null>(null);

const KEY = "dealsignal:watchlist";
const NOTES_KEY = "dealsignal:notes";
const SEEDED_KEY = "dealsignal:seeded";
const DEFAULT_IDS = ["ds-001", "ds-002", "ds-010"];

function readLocalState(): WatchlistState {
  let ids: string[] = [];
  let notes: Record<string, string> = {};
  try {
    ids = JSON.parse(localStorage.getItem(KEY) || "[]");
    notes = JSON.parse(localStorage.getItem(NOTES_KEY) || "{}");
  } catch {
    ids = [];
    notes = {};
  }
  if (ids.length === 0 && !localStorage.getItem(SEEDED_KEY)) {
    ids = DEFAULT_IDS;
    localStorage.setItem(SEEDED_KEY, "1");
  }
  return { ids, notes };
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
    .insert({ user_id: userId, name: "My Watchlist" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [state, setState] = useState<WatchlistState>(readLocalState);
  const [error, setError] = useState<string | null>(null);
  const queryKey = ["watchlist", auth.user?.id];

  const watchlistQuery = useQuery({
    queryKey,
    enabled: isSupabaseConfigured && Boolean(auth.user?.id),
    queryFn: async (): Promise<WatchlistState> => {
      const watchlist = await ensureWatchlist(auth.user!.id);
      const db = requireSupabase();
      const [{ data: items, error: itemsError }, { data: notes, error: notesError }] = await Promise.all([
        db.from("watchlist_items").select("deal_id").eq("watchlist_id", watchlist.id),
        db.from("watchlist_notes").select("deal_id,note").eq("watchlist_id", watchlist.id),
      ]);
      if (itemsError) throw itemsError;
      if (notesError) throw notesError;
      return {
        watchlistId: watchlist.id,
        ids: (items ?? []).map((item) => item.deal_id),
        notes: Object.fromEntries((notes ?? []).map((note) => [note.deal_id, note.note])),
      };
    },
  });

  useEffect(() => {
    if (watchlistQuery.data) setState(watchlistQuery.data);
  }, [watchlistQuery.data]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      localStorage.setItem(KEY, JSON.stringify(state.ids));
      localStorage.setItem(NOTES_KEY, JSON.stringify(state.notes));
    }
  }, [state]);

  const itemMutation = useMutation({
    mutationFn: async ({ dealId, nextIds }: { dealId: string; nextIds: string[] }) => {
      if (!isSupabaseConfigured || !auth.user) return;
      const watchlist = state.watchlistId ? { id: state.watchlistId } : await ensureWatchlist(auth.user.id);
      const db = requireSupabase();
      if (nextIds.includes(dealId)) {
        const { error: insertError } = await db
          .from("watchlist_items")
          .upsert({ watchlist_id: watchlist.id, deal_id: dealId });
        if (insertError) throw insertError;
      } else {
        const { error: deleteError } = await db
          .from("watchlist_items")
          .delete()
          .eq("watchlist_id", watchlist.id)
          .eq("deal_id", dealId);
        if (deleteError) throw deleteError;
      }
    },
    onMutate: async ({ nextIds }) => {
      setError(null);
      await queryClient.cancelQueries({ queryKey });
      const previous = state;
      const next = { ...state, ids: nextIds };
      setState(next);
      queryClient.setQueryData(queryKey, next);
      return { previous };
    },
    onError: (mutationError, _vars, context) => {
      if (context?.previous) setState(context.previous);
      setError(mutationError instanceof Error ? mutationError.message : "Could not update watchlist.");
    },
  });

  const noteMutation = useMutation({
    mutationFn: async ({ dealId, note }: { dealId: string; note: string }) => {
      if (!isSupabaseConfigured || !auth.user) return;
      const watchlist = state.watchlistId ? { id: state.watchlistId } : await ensureWatchlist(auth.user.id);
      const db = requireSupabase();
      if (note.trim()) {
        const { error: upsertError } = await db
          .from("watchlist_notes")
          .upsert({ watchlist_id: watchlist.id, deal_id: dealId, note });
        if (upsertError) throw upsertError;
      } else {
        const { error: deleteError } = await db
          .from("watchlist_notes")
          .delete()
          .eq("watchlist_id", watchlist.id)
          .eq("deal_id", dealId);
        if (deleteError) throw deleteError;
      }
    },
    onMutate: async ({ dealId, note }) => {
      setError(null);
      await queryClient.cancelQueries({ queryKey });
      const previous = state;
      const next = { ...state, notes: { ...state.notes, [dealId]: note } };
      if (!note.trim()) delete next.notes[dealId];
      setState(next);
      queryClient.setQueryData(queryKey, next);
      return { previous };
    },
    onError: (mutationError, _vars, context) => {
      if (context?.previous) setState(context.previous);
      setError(mutationError instanceof Error ? mutationError.message : "Could not save note.");
    },
  });

  const value = useMemo<WatchlistContextType>(() => ({
    ...state,
    isSaving: itemMutation.isPending || noteMutation.isPending,
    error,
    toggle: async (id) => {
      const nextIds = state.ids.includes(id) ? state.ids.filter((item) => item !== id) : [...state.ids, id];
      await itemMutation.mutateAsync({ dealId: id, nextIds });
    },
    isWatched: (id) => state.ids.includes(id),
    setNote: async (id, note) => {
      await noteMutation.mutateAsync({ dealId: id, note });
    },
    remove: async (id) => {
      await itemMutation.mutateAsync({ dealId: id, nextIds: state.ids.filter((item) => item !== id) });
    },
  }), [error, itemMutation, noteMutation, state]);

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

export const useWatchlist = () => {
  const ctx = useContext(WatchlistContext);
  if (!ctx) throw new Error("useWatchlist must be used within WatchlistProvider");
  return ctx;
};
