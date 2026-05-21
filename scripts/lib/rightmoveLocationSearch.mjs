import { createClient } from "@supabase/supabase-js";
import { runRightmoveCommercialImport } from "../scrape-rightmove.mjs";

export const RIGHTMOVE_COMMERCIAL_SOURCE_NAME = "Rightmove Commercial";

const RIGHTMOVE_LOCATION_BASE = "https://www.rightmove.co.uk/commercial-property-for-sale";

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

export async function runRightmoveLocationSearch({
  locationQuery,
  dryRun = false,
  sourceName = RIGHTMOVE_COMMERCIAL_SOURCE_NAME,
}) {
  const searchUrl = buildRightmoveCommercialSearchUrl(locationQuery);
  return runRightmoveCommercialImport({
    searchUrl,
    sourceName,
    dryRun,
    sourceConfig: {
      generated_from_location: locationQuery,
      generated_search_url: searchUrl,
    },
  });
}

export function readBearerToken(authorizationHeader = "") {
  const match = String(authorizationHeader).match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? "";
}

export async function requireAdminUser({ authorizationHeader, env = process.env }) {
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

  const role = data.user.app_metadata?.role || data.user.app_metadata?.user_role;
  if (role !== "admin" && role !== "owner") {
    return { ok: false, status: 403, error: "Admin access is required." };
  }

  return { ok: true, user: data.user };
}
