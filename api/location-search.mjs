import {
  createServiceClient,
  finishLocationSearchRequest,
  buildRightmoveCommercialSearchUrl,
  prepareLocationSearchRequest,
  requireAuthenticatedUser,
  RIGHTMOVE_COMMERCIAL_SOURCE_NAME,
  runLiveLocationSourceSearches,
  validateLocationQuery,
} from "../scripts/lib/rightmoveLocationSearch.mjs";

export default async function handler(req, res) {
  const requestStartedAt = Date.now();
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const auth = await requireAuthenticatedUser({ authorizationHeader: req.headers.authorization });
  if (!auth.ok) {
    logLocationSearch("auth_failure", { status: auth.status, reason: auth.error });
    return res.status(auth.status).json({ error: auth.error });
  }
  logLocationSearch("auth_success", { userId: auth.user.id });

  let requestId = null;
  let supabase = null;
  let locationQuery = "";
  let generatedUrl = null;
  let validation = null;
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    locationQuery = String(body.locationQuery ?? "").trim();
    const dryRun = body.dryRun === true;
    logLocationSearch("location_query_received", { userId: auth.user.id, locationQuery, dryRun });

    validation = validateLocationQuery(locationQuery);
    if (!validation.ok) {
      logLocationSearch("validation_failure", { userId: auth.user.id, locationQuery, reason: validation.error });
      return res.status(400).json({ error: validation.error });
    }

    generatedUrl = buildRightmoveCommercialSearchUrl(locationQuery);
    logLocationSearch("runtime_diagnostics", {
      userId: auth.user.id,
      locationQuery,
      generatedUrl,
      env: envDiagnostics(),
      nodeVersion: process.version,
      vercelRegion: process.env.VERCEL_REGION || null,
      vercelEnv: process.env.VERCEL_ENV || null,
      vercelGitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
    });

    supabase = await createServiceClient();
    const prepared = await prepareLocationSearchRequest({
      supabase,
      userId: auth.user.id,
      locationQuery,
      normalizedLocation: validation.normalized,
      sourceName: RIGHTMOVE_COMMERCIAL_SOURCE_NAME,
    });

    if (!prepared.ok) {
      logLocationSearch("rate_or_cooldown_result", {
        userId: auth.user.id,
        locationQuery,
        normalizedLocation: validation.normalized,
        code: prepared.code,
        status: prepared.status,
        recentRequestId: prepared.recentRequestId,
      });
      return res.status(prepared.status).json({
        error: prepared.error,
        code: prepared.code,
        ...(prepared.result || {}),
      });
    }

    requestId = prepared.requestId;
    logLocationSearch("rate_or_cooldown_result", {
      userId: auth.user.id,
      locationQuery,
      normalizedLocation: validation.normalized,
      code: "allowed",
      requestId,
    });
    logLocationSearch("generated_rightmove_url", { userId: auth.user.id, locationQuery, generatedUrl });
    const result = await runLiveLocationSourceSearches({ locationQuery, dryRun });
    logLocationSearch("scraper_import_result", {
      userId: auth.user.id,
      requestId,
      locationQuery,
      sources: result.sources,
      total: result.total,
      unique: result.totalUnique,
      inserted: result.totalInserted,
      existing: result.totalExisting,
      failed: result.totalFailed,
      skippedDuplicate: result.totalSkippedDuplicate,
      skippedRentOnly: result.totalSkippedRentOnly,
      skippedPoa: result.totalSkippedPoa,
      failedMissingPrice: result.totalFailedMissingPrice,
    });
    const response = {
      locationQuery,
      sourceName: "Rightmove Commercial and Acuitus",
      dryRun: result.dryRun,
      sources: result.sources,
      total: result.total,
      unique: result.totalUnique,
      imported: result.totalInserted,
      existing: result.totalExisting,
      refreshed: result.totalExisting,
      failed: result.totalFailed,
      skippedDuplicate: result.totalSkippedDuplicate,
      skippedRentOnly: result.totalSkippedRentOnly,
      skippedPoa: result.totalSkippedPoa,
      failedMissingPrice: result.totalFailedMissingPrice,
      processed: result.totalProcessed,
    };
    await finishLocationSearchRequest({ supabase, requestId, status: "completed", result: response });
    logLocationSearch("request_completed", { userId: auth.user.id, requestId, durationMs: Date.now() - requestStartedAt });
    return res.status(200).json(response);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    logLocationSearch("request_failed", {
      userId: auth.user.id,
      requestId,
      durationMs: Date.now() - requestStartedAt,
      error: detail,
    });
    if (supabase && requestId) {
      await finishLocationSearchRequest({
        supabase,
        requestId,
        status: "failed",
        errorMessage: detail,
      }).catch(() => {});
    }
    return res.status(500).json({
      error: userFacingSearchError(detail),
      detail,
      diagnostics: {
        requestId,
        locationQuery,
        generatedUrl,
        normalizedLocation: validation?.normalized,
        env: envDiagnostics(),
        nodeVersion: process.version,
        vercelRegion: process.env.VERCEL_REGION || null,
        vercelEnv: process.env.VERCEL_ENV || null,
        vercelGitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
      },
    });
  }
}

function userFacingSearchError(detail) {
  if (/rightmove page could not be parsed|request timed out|fetch failed|http 403|http 429|http 503/i.test(detail)) {
    return "Live search is currently unavailable. Run manual import or try again later.";
  }
  return "Couldn't search this location yet. Try a Rightmove search URL instead.";
}

function logLocationSearch(event, fields = {}) {
  console.info(JSON.stringify({
    scope: "location-search",
    event,
    at: new Date().toISOString(),
    ...fields,
  }));
}

function envDiagnostics() {
  return {
    VITE_SUPABASE_URL: Boolean(process.env.VITE_SUPABASE_URL),
    VITE_SUPABASE_ANON_KEY: Boolean(process.env.VITE_SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };
}
