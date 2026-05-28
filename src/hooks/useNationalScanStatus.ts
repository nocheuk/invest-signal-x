import { useQuery } from "@tanstack/react-query";
import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase/client";

export type NationalScanStatus = {
  id: string;
  sourceName: string;
  locationQuery: string;
  startedAt: string;
  finishedAt: string | null;
};

export const nationalScanStatusQueryKey = ["national-scan-status"];

export function useNationalScanStatus() {
  return useQuery({
    queryKey: nationalScanStatusQueryKey,
    enabled: isSupabaseConfigured,
    queryFn: async (): Promise<NationalScanStatus | null> => {
      const { data, error } = await requireSupabase()
        .from("national_scan_runs")
        .select("id,source_name,location_query,started_at,finished_at")
        .eq("status", "completed")
        .order("finished_at", { ascending: false })
        .limit(1);

      if (error) throw error;
      const row = data?.[0];
      if (!row) return null;
      return {
        id: row.id,
        sourceName: row.source_name,
        locationQuery: row.location_query,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
      };
    },
  });
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
