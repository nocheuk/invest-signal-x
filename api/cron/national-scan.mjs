import { createServiceClient } from "../../scripts/lib/rightmoveLocationSearch.mjs";
import { runNationalScan, verifyCronSecret } from "../../scripts/lib/nationalScan.mjs";

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const auth = verifyCronSecret({
    authorizationHeader: req.headers.authorization,
    querySecret: req.query?.secret,
  });
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const startedAt = Date.now();
  try {
    const dryRun = req.query?.dryRun === "true" || req.body?.dryRun === true;
    const supabase = dryRun ? null : await createServiceClient();
    const result = await runNationalScan({ supabase, dryRun });
    console.info(JSON.stringify({
      scope: "national-scan",
      event: "completed",
      at: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      locations: result.locations,
      diagnostics: result.diagnostics,
      totals: result.totals,
    }));
    return res.status(200).json(result);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({
      scope: "national-scan",
      event: "failed",
      at: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      error: detail,
    }));
    return res.status(500).json({ error: "National scan failed.", detail });
  }
}
