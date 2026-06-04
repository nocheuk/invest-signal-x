import { useQuery } from "@tanstack/react-query";
import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase/client";

export type NationalScanStatus = {
  id: string;
  sourceName: string;
  locationQuery: string;
  startedAt: string;
  finishedAt: string | null;
  locationsScanned: string[];
  totalConfiguredLocations: number;
  nextIndex: number;
  estimatedFullCycleDays: number;
  scanCycleProgress: number;
  totalDeals: number;
  totalRightmoveDeals: number;
  totalAcuitusDeals: number;
  totalEddisonsDeals: number;
  locationsCompletedInCurrentCycle: number;
};

export const nationalScanStatusQueryKey = ["national-scan-status"];

export function useNationalScanStatus() {
  return useQuery({
    queryKey: nationalScanStatusQueryKey,
    enabled: isSupabaseConfigured,
    queryFn: async (): Promise<NationalScanStatus | null> => {
      const supabase = requireSupabase();
      const { data, error } = await supabase
        .from("national_scan_runs")
        .select("id,source_name,location_query,started_at,finished_at,metadata")
        .eq("status", "completed")
        .order("finished_at", { ascending: false })
        .limit(1);

      if (error) throw error;
      const row = data?.[0];
      if (!row) return null;
      const metadata = (row.metadata ?? {}) as Record<string, unknown>;
      const sourceCounts = await loadSourceDealCounts(supabase);
      const totalDeals = await loadTotalDealCount(supabase);
      const totalConfiguredLocations = Number(metadata.total_configured_locations ?? 0);
      const nextIndex = Number(metadata.next_index ?? 0);
      return {
        id: row.id,
        sourceName: row.source_name,
        locationQuery: row.location_query,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        locationsScanned: Array.isArray(metadata.locations_scanned) ? metadata.locations_scanned.map(String) : [row.location_query].filter(Boolean),
        totalConfiguredLocations,
        nextIndex,
        estimatedFullCycleDays: Number(metadata.estimated_full_cycle_days ?? 0),
        scanCycleProgress: Number(metadata.scan_cycle_progress ?? 0),
        totalDeals,
        totalRightmoveDeals: sourceCounts.rightmove,
        totalAcuitusDeals: sourceCounts.acuitus,
        totalEddisonsDeals: sourceCounts.eddisons,
        locationsCompletedInCurrentCycle: totalConfiguredLocations > 0 && nextIndex === 0 ? totalConfiguredLocations : nextIndex,
      };
    },
  });
}

async function loadTotalDealCount(supabase: ReturnType<typeof requireSupabase>) {
  const { count, error } = await supabase
    .from("deals")
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

async function loadSourceDealCounts(supabase: ReturnType<typeof requireSupabase>) {
  const { data, error } = await supabase
    .from("deal_source_links")
    .select("deal_id,import_sources(name)");
  if (error) throw error;
  const rightmove = new Set<string>();
  const acuitus = new Set<string>();
  const eddisons = new Set<string>();
  for (const row of data ?? []) {
    const importSource = Array.isArray(row.import_sources) ? row.import_sources[0] : row.import_sources;
    const name = String(importSource?.name ?? "").toLowerCase();
    if (name.includes("rightmove")) rightmove.add(row.deal_id);
    if (name.includes("acuitus")) acuitus.add(row.deal_id);
    if (name.includes("eddisons")) eddisons.add(row.deal_id);
  }
  return { rightmove: rightmove.size, acuitus: acuitus.size, eddisons: eddisons.size };
}

export function formatNationalScanTime(value: string | null | undefined) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(date);
}
