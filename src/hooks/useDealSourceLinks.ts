import { useQuery } from "@tanstack/react-query";
import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase/client";

export function useDealSourceLinks(dealId?: string) {
  return useQuery({
    queryKey: ["deal-source-links", dealId],
    enabled: isSupabaseConfigured && Boolean(dealId),
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from("deal_source_links")
        .select("*")
        .eq("deal_id", dealId!);
      if (error) throw error;
      return data ?? [];
    },
    initialData: isSupabaseConfigured ? undefined : [],
  });
}
