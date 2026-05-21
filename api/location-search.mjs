import {
  createServiceClient,
  finishLocationSearchRequest,
  prepareLocationSearchRequest,
  requireAuthenticatedUser,
  RIGHTMOVE_COMMERCIAL_SOURCE_NAME,
  runRightmoveLocationSearch,
  validateLocationQuery,
} from "../scripts/lib/rightmoveLocationSearch.mjs";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const auth = await requireAuthenticatedUser({ authorizationHeader: req.headers.authorization });
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  let requestId = null;
  let supabase = null;
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const locationQuery = String(body.locationQuery ?? "").trim();
    const dryRun = body.dryRun === true;

    const validation = validateLocationQuery(locationQuery);
    if (!validation.ok) {
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
      return res.status(prepared.status).json({
        error: prepared.error,
        code: prepared.code,
        reusedRecentSearch: prepared.code === "recent_search",
        ...(prepared.result || {}),
      });
    }

    requestId = prepared.requestId;
    const result = await runRightmoveLocationSearch({ locationQuery, dryRun });
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
    return res.status(200).json(response);
  } catch (error) {
    if (supabase && requestId) {
      await finishLocationSearchRequest({
        supabase,
        requestId,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
      }).catch(() => {});
    }
    return res.status(500).json({
      error: "Couldn't search this location yet. Try a Rightmove search URL instead.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
