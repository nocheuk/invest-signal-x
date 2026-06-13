import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AssetType } from "@/lib/deals";
import { useAuth } from "@/lib/auth";
import { EMPTY_BRIEF_INPUT, normalizeBriefInput, type AcquisitionBrief, type AcquisitionBriefInput } from "@/lib/acquisitionBriefs";
import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase/client";
import { parseStrategyMode } from "@/lib/strategyModes";

const KEY = "dealsignal:acquisition-briefs";

export function useAcquisitionBriefs() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["acquisition-briefs", auth.user?.id ?? "demo"];

  const query = useQuery({
    queryKey,
    enabled: !isSupabaseConfigured || Boolean(auth.user?.id),
    queryFn: async (): Promise<AcquisitionBrief[]> => {
      if (!isSupabaseConfigured) return readLocal();
      if (!auth.user) return [];
      const { data, error } = await requireSupabase()
        .from("acquisition_briefs")
        .select("*")
        .eq("user_id", auth.user.id)
        .order("is_active", { ascending: false })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapBriefRow);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (input: AcquisitionBriefInput) => {
      const normalized = normalizeBriefInput(input);
      if (!isSupabaseConfigured) {
        const current = readLocal();
        const saved = { ...normalized, id: normalized.id ?? crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as AcquisitionBrief;
        const next = normalized.isActive
          ? current.map((brief) => ({ ...brief, isActive: false })).filter((brief) => brief.id !== saved.id)
          : current.filter((brief) => brief.id !== saved.id);
        writeLocal([saved, ...next]);
        return saved;
      }
      if (!auth.user) throw new Error("Sign in to save acquisition briefs.");
      const supabase = requireSupabase();
      if (normalized.isActive) {
        const { error: deactivateError } = await supabase
          .from("acquisition_briefs")
          .update({ is_active: false })
          .eq("user_id", auth.user.id)
          .neq("id", normalized.id ?? "00000000-0000-0000-0000-000000000000");
        if (deactivateError) throw deactivateError;
      }

      const payload = toBriefPayload(normalized, auth.user.id);
      const request = normalized.id
        ? supabase.from("acquisition_briefs").update(payload).eq("id", normalized.id).eq("user_id", auth.user.id).select("*").single()
        : supabase.from("acquisition_briefs").insert(payload).select("*").single();
      const { data, error } = await request;
      if (error) throw error;
      return mapBriefRow(data);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData<AcquisitionBrief[]>(queryKey, (current = []) => {
        const withoutSaved = current.filter((brief) => brief.id !== saved.id);
        const next = saved.isActive ? withoutSaved.map((brief) => ({ ...brief, isActive: false })) : withoutSaved;
        return [saved, ...next].sort((a, b) => Number(b.isActive) - Number(a.isActive));
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!isSupabaseConfigured) {
        writeLocal(readLocal().filter((brief) => brief.id !== id));
        return id;
      }
      if (!auth.user) throw new Error("Sign in to delete acquisition briefs.");
      const { error } = await requireSupabase()
        .from("acquisition_briefs")
        .delete()
        .eq("id", id)
        .eq("user_id", auth.user.id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<AcquisitionBrief[]>(queryKey, (current = []) => current.filter((brief) => brief.id !== id));
    },
  });

  const selectMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!isSupabaseConfigured) {
        const next = readLocal().map((brief) => ({ ...brief, isActive: brief.id === id }));
        writeLocal(next);
        return next.find((brief) => brief.id === id) ?? null;
      }
      if (!auth.user) throw new Error("Sign in to select an acquisition brief.");
      const supabase = requireSupabase();
      const { error: deactivateError } = await supabase
        .from("acquisition_briefs")
        .update({ is_active: false })
        .eq("user_id", auth.user.id);
      if (deactivateError) throw deactivateError;
      const { data, error } = await supabase
        .from("acquisition_briefs")
        .update({ is_active: true })
        .eq("id", id)
        .eq("user_id", auth.user.id)
        .select("*")
        .single();
      if (error) throw error;
      return mapBriefRow(data);
    },
    onSuccess: (selected) => {
      if (!selected) return;
      queryClient.setQueryData<AcquisitionBrief[]>(queryKey, (current = []) => current.map((brief) => ({ ...brief, isActive: brief.id === selected.id })));
    },
  });

  const briefs = query.data ?? [];
  return {
    briefs,
    activeBrief: briefs.find((brief) => brief.isActive) ?? briefs[0] ?? null,
    isLoading: query.isLoading,
    isSaving: saveMutation.isPending || deleteMutation.isPending || selectMutation.isPending,
    saveBrief: saveMutation.mutateAsync,
    deleteBrief: deleteMutation.mutateAsync,
    selectBrief: selectMutation.mutateAsync,
    error: query.error ?? saveMutation.error ?? deleteMutation.error ?? selectMutation.error,
  };
}

function mapBriefRow(row: Record<string, unknown>): AcquisitionBrief {
  return {
    id: String(row.id),
    name: String(row.name ?? EMPTY_BRIEF_INPUT.name),
    strategyMode: parseStrategyMode(String(row.strategy_mode ?? "general-investment")),
    regions: stringArray(row.regions),
    budgetMin: numberValue(row.budget_min),
    budgetMax: numberValue(row.budget_max),
    assetTypes: stringArray(row.asset_types) as AssetType[],
    yieldMin: numberValue(row.yield_min),
    floorAreaMin: numberValue(row.floor_area_min),
    floorAreaMax: numberValue(row.floor_area_max),
    keywordsPreferred: stringArray(row.keywords_preferred),
    keywordsExcluded: stringArray(row.keywords_excluded),
    isActive: Boolean(row.is_active),
    createdAt: typeof row.created_at === "string" ? row.created_at : undefined,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : undefined,
  };
}

function toBriefPayload(input: AcquisitionBriefInput, userId: string) {
  return {
    user_id: userId,
    name: input.name,
    strategy_mode: input.strategyMode,
    regions: input.regions,
    budget_min: input.budgetMin,
    budget_max: input.budgetMax,
    asset_types: input.assetTypes,
    yield_min: input.yieldMin,
    floor_area_min: input.floorAreaMin,
    floor_area_max: input.floorAreaMax,
    keywords_preferred: input.keywordsPreferred,
    keywords_excluded: input.keywordsExcluded,
    is_active: input.isActive,
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function numberValue(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function readLocal(): AcquisitionBrief[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as AcquisitionBrief[];
  } catch {
    return [];
  }
}

function writeLocal(briefs: AcquisitionBrief[]) {
  localStorage.setItem(KEY, JSON.stringify(briefs));
}
