import { createClient } from "@supabase/supabase-js";
import { runRightmoveCommercialImport } from "../scrape-rightmove.mjs";
import { runCustomHtmlScraperImport } from "../scrape-site.mjs";

export const RIGHTMOVE_COMMERCIAL_SOURCE_NAME = "Rightmove Commercial";
export const ACUITUS_SOURCE_NAME = "Acuitus";
export const ACUITUS_LISTINGS_URL = "https://www.acuitus.co.uk/find-a-property/";
export const MIN_LOCATION_QUERY_LENGTH = 3;
export const HOURLY_LOCATION_SEARCH_LIMIT = 5;
export const DAILY_LOCATION_SEARCH_LIMIT = 20;

const RIGHTMOVE_LOCATION_BASE = "https://www.rightmove.co.uk/commercial-property-for-sale";
const RATE_LIMITED_STATUSES = ["pending", "completed", "failed"];
const RIGHTMOVE_LOCATION_SLUG_OVERRIDES = {
  "burton upon trent": "Burton-On-Trent",
};

export function buildRightmoveCommercialSearchUrl(locationQuery) {
  const slug = slugifyLocation(locationQuery);
  if (!slug) throw new Error("Location query is required.");
  return `${RIGHTMOVE_LOCATION_BASE}/${slug}.html`;
}

export function slugifyLocation(locationQuery) {
  const normalized = normalizeLocationQuery(locationQuery);
  if (RIGHTMOVE_LOCATION_SLUG_OVERRIDES[normalized]) return RIGHTMOVE_LOCATION_SLUG_OVERRIDES[normalized];
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

export async function runAcuitusLocationSearch({
  locationQuery,
  dryRun = false,
  sourceName = ACUITUS_SOURCE_NAME,
}) {
  const normalizedLocation = normalizeLocationQuery(locationQuery);
  const result = await runCustomHtmlScraperImport({
    pageUrl: ACUITUS_LISTINGS_URL,
    sourceName,
    selectorConfigPath: "./scrapers/acuitus.json",
    dryRun,
    rowFilter: (row) => locationMatchesImportRow(row, normalizedLocation),
    sourceConfig: {
      generated_from_location: locationQuery,
      location_filter: normalizedLocation,
    },
  });
  return { ...result, searchUrl: ACUITUS_LISTINGS_URL };
}

export async function runLiveLocationSourceSearches({
  locationQuery,
  dryRun = false,
  adapters = [
    { key: "rightmove", sourceName: RIGHTMOVE_COMMERCIAL_SOURCE_NAME, run: runRightmoveLocationSearch },
    { key: "acuitus", sourceName: ACUITUS_SOURCE_NAME, run: runAcuitusLocationSearch },
  ],
}) {
  const sources = {};
  for (const adapter of adapters) {
    try {
      const result = await adapter.run({ locationQuery, dryRun, sourceName: adapter.sourceName });
      sources[adapter.key] = normalizeSourceResult(result);
    } catch (error) {
      sources[adapter.key] = failedSourceResult(adapter.sourceName, dryRun, error);
    }
  }
  return aggregateSourceResults({ locationQuery, dryRun, sources });
}

export function aggregateSourceResults({ locationQuery, dryRun = false, sources }) {
  const values = Object.values(sources);
  return {
    locationQuery,
    dryRun,
    sources,
    totalInserted: sum(values, "inserted"),
    totalExisting: sum(values, "existing"),
    totalFailed: sum(values, "failed"),
    totalSkippedDuplicate: sum(values, "skippedDuplicate"),
    totalSkippedRentOnly: sum(values, "skippedRentOnly"),
    totalSkippedPoa: sum(values, "skippedPoa"),
    totalFailedMissingPrice: sum(values, "failedMissingPrice"),
    totalProcessed: sum(values, "processed"),
    totalUnique: sum(values, "unique"),
    total: sum(values, "total"),
  };
}

export function locationMatchesImportRow(row, normalizedLocation) {
  if (!normalizedLocation) return true;
  const normalized = row.normalized ?? {};
  const text = normalizeLocationQuery([
    normalized.location,
    normalized.postcode,
    normalized.region,
    normalized.title,
  ].filter(Boolean).join(" "));
  return text.includes(normalizedLocation);
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

function normalizeSourceResult(result) {
  return {
    source: result.source,
    dryRun: result.dryRun,
    searchUrl: result.searchUrl,
    total: result.total ?? 0,
    unique: result.unique ?? 0,
    inserted: result.inserted ?? 0,
    existing: result.existing ?? 0,
    failed: result.failed ?? 0,
    skippedDuplicate: result.skipped_duplicate ?? result.skippedDuplicate ?? 0,
    skippedRentOnly: result.skipped_rent_only ?? result.skippedRentOnly ?? 0,
    skippedPoa: result.skipped_poa ?? result.skippedPoa ?? 0,
    failedMissingPrice: result.failed_missing_price ?? result.failedMissingPrice ?? 0,
    processed: result.processed ?? 0,
  };
}

function failedSourceResult(source, dryRun, error) {
  return {
    source,
    dryRun,
    total: 0,
    unique: 0,
    inserted: 0,
    existing: 0,
    failed: 1,
    skippedDuplicate: 0,
    skippedRentOnly: 0,
    skippedPoa: 0,
    failedMissingPrice: 0,
    processed: 0,
    error: error instanceof Error ? error.message : String(error),
  };
}

function sum(values, key) {
  return values.reduce((total, value) => total + (Number(value?.[key]) || 0), 0);
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
