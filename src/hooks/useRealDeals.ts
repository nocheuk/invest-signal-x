import { useMemo } from "react";
import { useDeals } from "@/hooks/useDeals";
import { isSeedDeal } from "@/lib/dashboardFilters";
import { isSupabaseConfigured } from "@/lib/supabase/client";

const EMPTY_DEALS = [];

export function useRealDeals() {
  const dealsQuery = useDeals();
  const fetchedDeals = dealsQuery.data ?? EMPTY_DEALS;
  const deals = useMemo(
    () => (isSupabaseConfigured ? fetchedDeals.filter((deal) => !isSeedDeal(deal)) : fetchedDeals),
    [fetchedDeals]
  );

  return { dealsQuery, fetchedDeals, deals };
}
