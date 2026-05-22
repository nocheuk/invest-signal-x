import { createClient } from "@supabase/supabase-js";
import { runRightmoveCommercialImport } from "../scrape-rightmove.mjs";

export const RIGHTMOVE_COMMERCIAL_SOURCE_NAME = "Rightmove Commercial";
export const MIN_LOCATION_QUERY_LENGTH = 3;
export const HOURLY_LOCATION_SEARCH_LIMIT = 5;
export const DAILY_LOCATION_SEARCH_LIMIT = 20;
export const LOCATION_SEARCH_COOLDOWN_MINUTES = 30;

const RIGHTMOVE_LOCATION_BASE = "https://www.rightmove.co.uk/commercial-property-for-sale";
const RATE_LIMITED_STATUSES = ["pending", "completed", "failed"];

export function buildRightmoveCommercialSearchUrl(locationQuery) {
  const slug = slugifyLocation(locationQuery);
  if (!slug) throw new Error("Location query is required.");
  return `${RIGHTMOVE_LOCATION_BASE}/${slug}.html`;
}

export function slugifyLocation(locationQuery) {
  return String(locationQuery ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function normalizeLocationQuery(locationQuery) {
  return String(locationQuery ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function validateLocationQuery(locationQuery) {
  const normalized = normalizeLocationQuery(locationQuery);
  if (normalized.length < MIN_LOCATION_QUERY_LENGTH) {
    return {
      ok: false,
      error: `Enter at least ${MIN_LOCATION_QUERY_LENGTH} characters for a location.`,
    };
  }
  return { ok: true, normalized };
}

export async function runRightmoveLocationSearch({
  locationQuery,
  dryRun = false,
  sourceName = RIGHTMOVE_COMMERCIAL_SOURCE_NAME,
}) {
  const searchUrl = buildRightmoveCommercialSearchUrl(locationQuery);
  const result = await runRightmoveCommercialImport({
    searchUrl,
    sourceName,
    dryRun,
    sourceConfig: {
      generated_from_location: locationQuery,
      generated_search_url: searchUrl,
    },
  });
  return { ...result, searchUrl };
}

export function readBearerToken(authorizationHeader = "") {
  const match = String(authorizationHeader).match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? "";
}

export async function requireAuthenticatedUser({ authorizationHeader, env = process.env }) {
  const token = readBearerToken(authorizationHeader);
  if (!token) return { ok: false, status: 401, error: "Authentication is required." };

  const url = env.VITE_SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { ok: false, status: 500, error: "Supabase auth is not configured." };

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { ok: false, status: 401, error: "Authentication is required." };

  return { ok: true, user: data.user };
}

export async function createServiceClient(env = process.env) {
  const url = env.VITE_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function prepareLocationSearchRequest({
  supabase,
  userId,
  locationQuery,
  normalizedLocation,
  sourceName = RIGHTMOVE_COMMERCIAL_SOURCE_NAME,
  now = new Date(),
}) {
  const cooldownSince = new Date(now.getTime() - LOCATION_SEARCH_COOLDOWN_MINUTES * 60 * 1000).toISOString();
  const { data: recent, error: recentError } = await supabase
    .from("location_search_requests")
    .select("id,result,created_at")
    .eq("user_id", userId)
    .eq("normalized_location", normalizedLocation)
    .eq("source_name", sourceName)
    .eq("status", "completed")
    .gte("created_at", cooldownSince)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recentError) throw recentError;
  if (recent) {
    return {
      ok: false,
      status: 200,
      code: "recent_search",
      error: `Rightmove Commercial was searched for ${locationQuery} recently. Showing the latest imported results instead.`,
      result: recent.result,
      recentRequestId: recent.id,
    };
  }

  const hourSince = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const daySince = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const [hourly, daily] = await Promise.all([
    countUserRequestsSince({ supabase, userId, since: hourSince }),
    countUserRequestsSince({ supabase, userId, since: daySince }),
  ]);

  if (hourly >= HOURLY_LOCATION_SEARCH_LIMIT) {
    return {
      ok: false,
      status: 429,
      code: "rate_limited",
      error: `You've reached the live search limit of ${HOURLY_LOCATION_SEARCH_LIMIT} searches per hour. Please try again later.`,
    };
  }
  if (daily >= DAILY_LOCATION_SEARCH_LIMIT) {
    return {
      ok: false,
      status: 429,
      code: "rate_limited",
      error: `You've reached the live search limit of ${DAILY_LOCATION_SEARCH_LIMIT} searches per day. Please try again tomorrow.`,
    };
  }

  const { data: request, error: insertError } = await supabase
    .from("location_search_requests")
    .insert({
      user_id: userId,
      location_query: locationQuery,
      normalized_location: normalizedLocation,
      source_name: sourceName,
      status: "pending",
    })
    .select("id")
    .single();
  if (insertError) throw insertError;
  return { ok: true, requestId: request.id };
}

export async function finishLocationSearchRequest({ supabase, requestId, status, result = {}, errorMessage = null }) {
  const { error } = await supabase
    .from("location_search_requests")
    .update({
      status,
      result,
      error_message: errorMessage,
      finished_at: new Date().toISOString(),
    })
    .eq("id", requestId);
  if (error) throw error;
}

async function countUserRequestsSince({ supabase, userId, since }) {
  const { count, error } = await supabase
    .from("location_search_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", RATE_LIMITED_STATUSES)
    .gte("created_at", since);
  if (error) throw error;
  return count ?? 0;
}
