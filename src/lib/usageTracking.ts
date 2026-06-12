import { useCallback } from "react";
import { useLocation } from "react-router-dom";
import type { Json } from "@/lib/supabase/utility-types";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";

export const FEEDBACK_TYPES = [
  { value: "bug_report", label: "Bug report" },
  { value: "feature_request", label: "Feature request" },
  { value: "data_issue", label: "Data issue" },
  { value: "source_request", label: "Source request" },
  { value: "general_feedback", label: "General feedback" },
] as const;

export type FeedbackType = typeof FEEDBACK_TYPES[number]["value"];

export type UserEventType =
  | "opened_deal"
  | "opened_source_listing"
  | "saved_to_pipeline"
  | "downloaded_investment_pack"
  | "clicked_top_opportunity"
  | "clicked_strong_opportunity"
  | "created_alert"
  | "ran_location_search"
  | "changed_acquisition_brief";

export type FeedbackInput = {
  type: FeedbackType;
  message: string;
  dealId?: string | null;
  sourceUrl?: string | null;
  currentPage: string;
  metadata?: Json;
};

export type EventInput = {
  eventType: UserEventType;
  dealId?: string | null;
  sourceUrl?: string | null;
  currentPage: string;
  metadata?: Json;
};

function shouldLogTrackingWarning() {
  return import.meta.env.DEV && import.meta.env.MODE !== "test";
}

export function useUsageTracking() {
  const auth = useAuth();
  const location = useLocation();
  const currentPage = `${location.pathname}${location.search}`;
  const userId = auth.user?.id ?? null;

  const trackEvent = useCallback(async (input: Omit<EventInput, "currentPage"> & { currentPage?: string }) => {
    try {
      if (!supabase || !userId) return;
      const { error } = await supabase.from("user_events").insert({
        user_id: userId,
        event_type: input.eventType,
        deal_id: input.dealId ?? null,
        source_url: input.sourceUrl ?? null,
        current_page: input.currentPage ?? currentPage,
        metadata: input.metadata ?? {},
      });
      if (error && shouldLogTrackingWarning()) console.warn("DealSignal event tracking failed", error.message);
    } catch (error) {
      if (shouldLogTrackingWarning()) console.warn("DealSignal event tracking failed", error);
    }
  }, [currentPage, userId]);

  const submitFeedback = useCallback(async (input: Omit<FeedbackInput, "currentPage"> & { currentPage?: string }) => {
    if (!supabase || !userId) throw new Error("You need to be signed in to send feedback.");
    const { error } = await supabase.from("user_feedback").insert({
      user_id: userId,
      type: input.type,
      message: input.message.trim(),
      deal_id: input.dealId ?? null,
      source_url: input.sourceUrl ?? null,
      current_page: input.currentPage ?? currentPage,
      metadata: input.metadata ?? {},
    });
    if (error) throw error;
  }, [currentPage, userId]);

  return { currentPage, submitFeedback, trackEvent };
}

export async function trackUserEvent(userId: string | null | undefined, input: EventInput) {
  try {
    if (!supabase || !userId) return;
    const { error } = await supabase.from("user_events").insert({
      user_id: userId,
      event_type: input.eventType,
      deal_id: input.dealId ?? null,
      source_url: input.sourceUrl ?? null,
      current_page: input.currentPage,
      metadata: input.metadata ?? {},
    });
    if (error && shouldLogTrackingWarning()) console.warn("DealSignal event tracking failed", error.message);
  } catch (error) {
    if (shouldLogTrackingWarning()) console.warn("DealSignal event tracking failed", error);
  }
}
