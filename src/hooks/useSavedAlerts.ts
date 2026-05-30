import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import type { SavedAlertCriteria } from "@/lib/alerts";
import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase/client";

export type SavedAlert = SavedAlertCriteria & {
  id: string;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string | null;
  matchesFound: number;
};

export type SaveAlertInput = Omit<SavedAlertCriteria, "id"> & { id?: string };

const LOCAL_KEY = "dealsignal:saved-alerts";

export function useSavedAlerts() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["saved-alerts", auth.user?.id ?? "demo"];

  const query = useQuery({
    queryKey,
    enabled: !isSupabaseConfigured || Boolean(auth.user?.id),
    queryFn: async (): Promise<SavedAlert[]> => {
      if (!isSupabaseConfigured) return readLocal();
      if (!auth.user) return [];

      const { data, error } = await requireSupabase()
        .from("saved_alerts")
        .select("id,name,location_query,min_yield,max_price,asset_type,min_score,enabled,created_at,updated_at")
        .eq("user_id", auth.user.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;

      const alerts = (data ?? []).map(mapAlertRow);
      const matchStats = await loadMatchStats(alerts.map((alert) => alert.id));
      return alerts.map((alert) => ({
        ...alert,
        matchesFound: matchStats.get(alert.id)?.count ?? 0,
        lastRunAt: matchStats.get(alert.id)?.lastRunAt ?? null,
      }));
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (input: SaveAlertInput): Promise<SavedAlert> => {
      if (!isSupabaseConfigured) {
        const saved = localAlert(input);
        const next = [saved, ...readLocal().filter((alert) => alert.id !== saved.id)].slice(0, 20);
        localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
        return saved;
      }
      if (!auth.user) throw new Error("Sign in to create alerts.");
      const payload = {
        user_id: auth.user.id,
        name: input.name,
        location_query: input.locationQuery,
        min_yield: input.minYield,
        max_price: input.maxPrice,
        asset_type: input.assetType || "All",
        min_score: input.minScore,
        enabled: input.enabled,
      };
      const builder = input.id
        ? requireSupabase().from("saved_alerts").update(payload).eq("id", input.id).eq("user_id", auth.user.id)
        : requireSupabase().from("saved_alerts").insert(payload);
      const { data, error } = await builder.select("id,name,location_query,min_yield,max_price,asset_type,min_score,enabled,created_at,updated_at").single();
      if (error) throw error;
      return { ...mapAlertRow(data), matchesFound: 0, lastRunAt: null };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!isSupabaseConfigured) {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(readLocal().filter((alert) => alert.id !== id)));
        return id;
      }
      if (!auth.user) throw new Error("Sign in to delete alerts.");
      const { error } = await requireSupabase()
        .from("saved_alerts")
        .delete()
        .eq("id", id)
        .eq("user_id", auth.user.id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    alerts: query.data ?? [],
    isLoading: query.isLoading,
    isSaving: saveMutation.isPending,
    isDeleting: deleteMutation.isPending,
    error: query.error ?? saveMutation.error ?? deleteMutation.error,
    saveAlert: saveMutation.mutateAsync,
    deleteAlert: deleteMutation.mutateAsync,
  };
}

async function loadMatchStats(alertIds: string[]) {
  const stats = new Map<string, { count: number; lastRunAt: string | null }>();
  if (alertIds.length === 0) return stats;
  const { data, error } = await requireSupabase()
    .from("alert_matches")
    .select("alert_id,matched_at")
    .in("alert_id", alertIds);
  if (error) {
    console.warn("Could not load saved alert match stats", error.message);
    return stats;
  }
  for (const row of data ?? []) {
    const current = stats.get(row.alert_id) ?? { count: 0, lastRunAt: null };
    current.count += 1;
    if (!current.lastRunAt || row.matched_at > current.lastRunAt) current.lastRunAt = row.matched_at;
    stats.set(row.alert_id, current);
  }
  return stats;
}

function mapAlertRow(row: {
  id: string;
  name: string;
  location_query: string;
  min_yield: number;
  max_price: number;
  asset_type: string;
  min_score: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}): SavedAlert {
  return {
    id: row.id,
    name: row.name,
    locationQuery: row.location_query ?? "",
    minYield: Number(row.min_yield ?? 0),
    maxPrice: Number(row.max_price ?? 0),
    assetType: row.asset_type ?? "All",
    minScore: Number(row.min_score ?? 0),
    enabled: row.enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    matchesFound: 0,
    lastRunAt: null,
  };
}

function readLocal(): SavedAlert[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]") as SavedAlert[];
  } catch {
    return [];
  }
}

function localAlert(input: SaveAlertInput): SavedAlert {
  const now = new Date().toISOString();
  return {
    id: input.id ?? crypto.randomUUID(),
    name: input.name,
    locationQuery: input.locationQuery,
    minYield: input.minYield,
    maxPrice: input.maxPrice,
    assetType: input.assetType,
    minScore: input.minScore,
    enabled: input.enabled,
    createdAt: now,
    updatedAt: now,
    matchesFound: 0,
    lastRunAt: null,
  };
}
