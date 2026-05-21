import { requireAdminUser, runRightmoveLocationSearch } from "../scripts/lib/rightmoveLocationSearch.mjs";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const auth = await requireAdminUser({ authorizationHeader: req.headers.authorization });
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const locationQuery = String(body.locationQuery ?? "").trim();
    const dryRun = body.dryRun === true;

    if (!locationQuery) {
      return res.status(400).json({ error: "Location query is required." });
    }

    const result = await runRightmoveLocationSearch({ locationQuery, dryRun });
    return res.status(200).json({
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
    });
  } catch (error) {
    return res.status(500).json({
      error: "Couldn't search this location yet. Try a Rightmove search URL instead.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
