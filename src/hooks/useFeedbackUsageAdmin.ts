import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

type FeedbackRow = Database["public"]["Tables"]["user_feedback"]["Row"];
type EventRow = Database["public"]["Tables"]["user_events"]["Row"];

export type EventCount = {
  eventType: string;
  count: number;
};

export type DealEventCount = {
  dealId: string;
  count: number;
};

export type FeedbackUsageAdminData = {
  latestFeedback: FeedbackRow[];
  eventCounts: EventCount[];
  mostOpenedDeals: DealEventCount[];
  mostDownloadedInvestmentPacks: DealEventCount[];
};

const EMPTY_DATA: FeedbackUsageAdminData = {
  latestFeedback: [],
  eventCounts: [],
  mostOpenedDeals: [],
  mostDownloadedInvestmentPacks: [],
};

export function useFeedbackUsageAdmin(enabled: boolean) {
  const feedbackQuery = useQuery({
    queryKey: ["admin-feedback-usage"],
    enabled: enabled && Boolean(supabase),
    queryFn: async (): Promise<FeedbackUsageAdminData> => {
      if (!supabase) return EMPTY_DATA;

      const [feedbackResult, eventsResult] = await Promise.all([
        supabase
          .from("user_feedback")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("user_events")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500),
      ]);

      if (feedbackResult.error) throw feedbackResult.error;
      if (eventsResult.error) throw eventsResult.error;

      const events = (eventsResult.data ?? []) as EventRow[];
      return {
        latestFeedback: (feedbackResult.data ?? []) as FeedbackRow[],
        eventCounts: countBy(events, (event) => event.event_type),
        mostOpenedDeals: countDealEvents(events, "opened_deal"),
        mostDownloadedInvestmentPacks: countDealEvents(events, "downloaded_investment_pack"),
      };
    },
    staleTime: 60_000,
  });

  const data = useMemo(() => feedbackQuery.data ?? EMPTY_DATA, [feedbackQuery.data]);
  return { ...feedbackQuery, data };
}

function countBy<T>(items: T[], getKey: (item: T) => string | null | undefined): EventCount[] {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    const key = getKey(item);
    if (!key) return;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([eventType, count]) => ({ eventType, count }))
    .sort((a, b) => b.count - a.count || a.eventType.localeCompare(b.eventType));
}

function countDealEvents(events: EventRow[], eventType: string): DealEventCount[] {
  const counts = new Map<string, number>();
  events.forEach((event) => {
    if (event.event_type !== eventType || !event.deal_id) return;
    counts.set(event.deal_id, (counts.get(event.deal_id) ?? 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([dealId, count]) => ({ dealId, count }))
    .sort((a, b) => b.count - a.count || a.dealId.localeCompare(b.dealId))
    .slice(0, 8);
}
