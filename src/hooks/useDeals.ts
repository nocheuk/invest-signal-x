import { useQuery } from "@tanstack/react-query";
import { DEALS, type Deal } from "@/lib/deals";
import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase/client";
import { mapDealRow, type DealSourceMetadata } from "@/lib/supabase/mappers";

export const dealsQueryKey = ["deals"];

export function useDeals() {
  return useQuery({
    queryKey: dealsQueryKey,
    queryFn: async (): Promise<Deal[]> => {
      if (!isSupabaseConfigured) return DEALS;
      const { data, error } = await requireSupabase()
        .from("deals")
        .select("*")
        .order("posted_at", { ascending: false });
      if (error) throw error;
      const metadata = await loadDealSourceMetadata((data ?? []).map((row) => row.id));
      return (data ?? []).map((row) => mapDealRow(row, metadata.get(row.id)));
    },
    initialData: isSupabaseConfigured ? undefined : DEALS,
  });
}

export function useDeal(id?: string) {
  const query = useDeals();
  return {
    ...query,
    deal: query.data?.find((deal) => deal.id === id),
  };
}

async function loadDealSourceMetadata(dealIds: string[]) {
  const metadata = new Map<string, DealSourceMetadata>();
  if (dealIds.length === 0) return metadata;

  const { data, error } = await requireSupabase()
    .from("deal_source_links")
    .select("deal_id,source_url,import_sources(name,source_type)")
    .in("deal_id", dealIds);

  if (error) {
    console.warn("Could not load deal source metadata", error.message);
    return metadata;
  }

  for (const link of data ?? []) {
    if (!link.deal_id || metadata.has(link.deal_id)) continue;
    const importSource = Array.isArray(link.import_sources) ? link.import_sources[0] : link.import_sources;
    metadata.set(link.deal_id, {
      sourceUrl: link.source_url,
      importSourceName: importSource?.name,
      importSourceType: importSource?.source_type,
    });
  }

  return metadata;
}
