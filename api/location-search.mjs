import {
  createServiceClient,
  finishLocationSearchRequest,
  buildRightmoveCommercialSearchUrl,
  prepareLocationSearchRequest,
  requireAuthenticatedUser,
  RIGHTMOVE_COMMERCIAL_SOURCE_NAME,
  runRightmoveLocationSearch,
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
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const locationQuery = String(body.locationQuery ?? "").trim();
    const dryRun = body.dryRun === true;
    logLocationSearch("location_query_received", { userId: auth.user.id, locationQuery, dryRun });

    const validation = validateLocationQuery(locationQuery);
    if (!validation.ok) {
      logLocationSearch("validation_failure", { userId: auth.user.id, locationQuery, reason: validation.error });
      return res.status(400).json({ error: validation.error });
    }

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
        reusedRecentSearch: prepared.code === "recent_search",
        ...(prepared.result || {}),
      });
    }

    requestId = prepared.requestId;
    const generatedUrl = buildRightmoveCommercialSearchUrl(locationQuery);
    logLocationSearch("rate_or_cooldown_result", {
      userId: auth.user.id,
      locationQuery,
      normalizedLocation: validation.normalized,
      code: "allowed",
      requestId,
    });
    logLocationSearch("generated_rightmove_url", { userId: auth.user.id, locationQuery, generatedUrl });
    const result = await runRightmoveLocationSearch({ locationQuery, dryRun });
    logLocationSearch("scraper_import_result", {
      userId: auth.user.id,
      requestId,
      locationQuery,
      total: result.total,
      unique: result.unique,
      inserted: result.inserted,
      existing: result.existing,
      failed: result.failed,
      skippedDuplicate: result.skipped_duplicate,
    });
    const response = {
      locationQuery,
      sourceName: result.source,
      dryRun: result.dryRun,
      total: result.total,
      unique: result.unique,
      imported: result.inserted,
      existing: result.existing,
      failed: result.failed,
      skippedDuplicate: result.skipped_duplicate,
      processed: result.processed,
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
