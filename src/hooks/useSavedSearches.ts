import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase/client";

export type SavedSearchFilters = {
  locationQuery: string;
  source: string;
  asset: string;
  minYield: number;
  maxPrice: number;
};

export type SavedSearch = {
  id: string;
  name: string;
  filters: SavedSearchFilters;
};

const KEY = "dealsignal:saved-searches";

export function useSavedSearches() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["saved-searches", auth.user?.id ?? "demo"];

  const query = useQuery({
    queryKey,
    enabled: !isSupabaseConfigured || Boolean(auth.user?.id),
    queryFn: async (): Promise<SavedSearch[]> => {
      if (!isSupabaseConfigured) return readLocal();
      if (!auth.user) return [];
      const { data, error } = await requireSupabase()
        .from("saved_searches")
        .select("id,name,filters")
        .eq("user_id", auth.user.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        filters: normalizeFilters(row.filters),
      }));
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ name, filters }: { name: string; filters: SavedSearchFilters }) => {
      const saved: SavedSearch = { id: crypto.randomUUID(), name, filters };
      if (!isSupabaseConfigured) {
        const next = [saved, ...readLocal().filter((item) => item.name !== name)].slice(0, 8);
        localStorage.setItem(KEY, JSON.stringify(next));
        return saved;
      }
      if (!auth.user) throw new Error("Sign in to save location searches.");
      const { data, error } = await requireSupabase()
        .from("saved_searches")
        .insert({
          user_id: auth.user.id,
          name,
          filters,
          alert_enabled: false,
          alert_frequency: "daily",
        })
        .select("id,name,filters")
        .single();
      if (error) throw error;
      return { id: data.id, name: data.name, filters: normalizeFilters(data.filters) };
    },
    onSuccess: (saved) => {
      queryClient.setQueryData<SavedSearch[]>(queryKey, (current = []) => [saved, ...current.filter((item) => item.id !== saved.id)].slice(0, 8));
    },
  });

  return {
    savedSearches: query.data ?? [],
    isLoading: query.isLoading,
    isSaving: saveMutation.isPending,
    saveSearch: saveMutation.mutateAsync,
    error: query.error ?? saveMutation.error,
  };
}

function readLocal(): SavedSearch[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as SavedSearch[];
  } catch {
    return [];
  }
}

function normalizeFilters(value: unknown): SavedSearchFilters {
  const filters = (value && typeof value === "object" ? value : {}) as Partial<SavedSearchFilters>;
  return {
    locationQuery: String(filters.locationQuery ?? ""),
    source: String(filters.source ?? "All"),
    asset: String(filters.asset ?? "All"),
    minYield: Number(filters.minYield ?? 0),
    maxPrice: Number(filters.maxPrice ?? 0),
  };
}
