import { useQuery } from "@tanstack/react-query";
import { DEALS, type Deal } from "@/lib/deals";
import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase/client";
import { mapDealRow } from "@/lib/supabase/mappers";

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
      return (data ?? []).map(mapDealRow);
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
