import { runCustomHtmlScraperImport } from "../scrape-site.mjs";
import { runSavedAlertsForRecentDeals } from "./alerts.mjs";
import {
  ACUITUS_LISTINGS_URL,
  ACUITUS_SOURCE_NAME,
  normalizeLocationQuery,
  RIGHTMOVE_COMMERCIAL_SOURCE_NAME,
  runRightmoveLocationSearch,
} from "./rightmoveLocationSearch.mjs";
import { ENGLAND_NATIONAL_SCAN_LOCATIONS } from "./englandLocationQueue.mjs";

export const NATIONAL_SCAN_TYPE = "england_national_scan";
export const NATIONAL_SCAN_BATCH_SIZE = 4;
export const ENGLAND_PRIORITY_LOCATIONS = ENGLAND_NATIONAL_SCAN_LOCATIONS;

export function verifyCronSecret({ authorizationHeader = "", querySecret = "", env = process.env } = {}) {
  const expected = env.CRON_SECRET;
  if (!expected) return { ok: false, status: 500, error: "CRON_SECRET is not configured." };
  const bearer = String(authorizationHeader).match(/^Bearer\s+(.+)$/i)?.[1] ?? "";
  const provided = bearer || querySecret;
  if (provided !== expected) return { ok: false, status: 401, error: "Unauthorized." };
  return { ok: true };
}

export function selectNationalScanBatch({ lastNextIndex = 0, batchSize = NATIONAL_SCAN_BATCH_SIZE, locations = ENGLAND_PRIORITY_LOCATIONS } = {}) {
  if (!locations.length) return { locations: [], startIndex: 0, nextIndex: 0 };
  const startIndex = normalizeIndex(lastNextIndex, locations.length);
  const selected = [];
  for (let offset = 0; offset < Math.min(batchSize, locations.length); offset += 1) {
    selected.push(locations[(startIndex + offset) % locations.length]);
  }
  return {
    locations: selected,
    startIndex,
    nextIndex: (startIndex + selected.length) % locations.length,
  };
}

export function buildNationalScanDiagnostics({ batch, totalLocations, batchSize = NATIONAL_SCAN_BATCH_SIZE, runsPerDay = 1 } = {}) {
  const scannedCount = batch?.locations?.length ?? 0;
  const safeTotal = Math.max(Number(totalLocations) || 0, 0);
  const safeBatchSize = Math.max(Number(batchSize) || scannedCount || 1, 1);
  const runsForFullCycle = safeTotal > 0 ? Math.ceil(safeTotal / safeBatchSize) : 0;
  return {
    totalConfiguredLocations: safeTotal,
    locationsScanned: batch?.locations ?? [],
    locationsScannedCount: scannedCount,
    startIndex: batch?.startIndex ?? 0,
    nextIndex: batch?.nextIndex ?? 0,
    batchSize: safeBatchSize,
    runsForFullCycle,
    estimatedFullCycleDays: runsPerDay > 0 ? Math.ceil(runsForFullCycle / runsPerDay) : runsForFullCycle,
    scanCycleProgress: safeTotal > 0 ? Math.round(((batch?.nextIndex ?? 0) / safeTotal) * 100) : 0,
  };
}

export async function runNationalScan({
  supabase,
  dryRun = false,
  batchSize = NATIONAL_SCAN_BATCH_SIZE,
  locations = ENGLAND_PRIORITY_LOCATIONS,
  includeAcuitus = true,
  evaluateAlerts = true,
  adapters = defaultNationalAdapters(),
  now = new Date(),
} = {}) {
  if (!supabase && !dryRun) throw new Error("Supabase service client is required for live national scans.");

  const lastNextIndex = dryRun ? 0 : await loadLastNextIndex({ supabase });
  const batch = selectNationalScanBatch({ lastNextIndex, batchSize, locations });
  const diagnostics = buildNationalScanDiagnostics({ batch, totalLocations: locations.length, batchSize, runsPerDay: 1 });
  const batchId = crypto.randomUUID();
  const results = [];
  const sharedMetadata = {
    batch_start_index: batch.startIndex,
    next_index: batch.nextIndex,
    scheduled_at: now.toISOString(),
    total_configured_locations: diagnostics.totalConfiguredLocations,
    locations_scanned: diagnostics.locationsScanned,
    locations_scanned_count: diagnostics.locationsScannedCount,
    scan_batch_size: diagnostics.batchSize,
    estimated_full_cycle_days: diagnostics.estimatedFullCycleDays,
    scan_cycle_progress: diagnostics.scanCycleProgress,
  };

  for (const locationQuery of batch.locations) {
    const result = await runAndRecordScan({
      supabase,
      dryRun,
      batchId,
      scanType: NATIONAL_SCAN_TYPE,
      locationQuery,
      sourceName: RIGHTMOVE_COMMERCIAL_SOURCE_NAME,
      metadata: sharedMetadata,
      run: () => adapters.rightmove({ locationQuery, dryRun }),
    });
    results.push(result);
  }

  if (includeAcuitus) {
    const result = await runAndRecordScan({
      supabase,
      dryRun,
      batchId,
      scanType: NATIONAL_SCAN_TYPE,
      locationQuery: "England",
      sourceName: ACUITUS_SOURCE_NAME,
      metadata: { ...sharedMetadata, national_source: true },
      run: () => adapters.acuitus({ dryRun }),
    });
    results.push(result);
  }

  const alertResult = !dryRun && evaluateAlerts
    ? await runSavedAlertsForRecentDeals({ supabase, since: now, now: new Date() })
    : null;

  return {
    dryRun,
    batchId,
    scanType: NATIONAL_SCAN_TYPE,
    locations: batch.locations,
    startIndex: batch.startIndex,
    nextIndex: batch.nextIndex,
    diagnostics,
    sources: results,
    totals: aggregateNationalResults(results),
    alerts: alertResult,
  };
}

function defaultNationalAdapters() {
  return {
    rightmove: ({ locationQuery, dryRun }) => runRightmoveLocationSearch({ locationQuery, dryRun }),
    acuitus: ({ dryRun }) => runCustomHtmlScraperImport({
      pageUrl: ACUITUS_LISTINGS_URL,
      sourceName: ACUITUS_SOURCE_NAME,
      selectorConfigPath: "./scrapers/acuitus.json",
      dryRun,
      sourceConfig: {
        national_scan: true,
        page_url: ACUITUS_LISTINGS_URL,
      },
    }),
  };
}

async function runAndRecordScan({ supabase, dryRun, batchId, scanType, locationQuery, sourceName, metadata, run }) {
  const startedAt = new Date().toISOString();
  let rowId = null;
  if (!dryRun) {
    const { data, error } = await supabase
      .from("national_scan_runs")
      .insert({
        scan_type: scanType,
        location_query: locationQuery,
        normalized_location: normalizeLocationQuery(locationQuery),
        source_name: sourceName,
        status: "pending",
        started_at: startedAt,
        metadata: { ...metadata, batch_id: batchId },
      })
      .select("id")
      .single();
    if (error) throw error;
    rowId = data.id;
  }

  try {
    const result = normalizeNationalSourceResult(await run());
    if (!dryRun) await finishNationalScanRun({ supabase, rowId, status: "completed", result });
    return { id: rowId, locationQuery, sourceName, status: "completed", ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const result = normalizeNationalSourceResult({ source: sourceName, failed: 1, error: message });
    if (!dryRun && rowId) await finishNationalScanRun({ supabase, rowId, status: "failed", result, errorMessage: message });
    return { id: rowId, locationQuery, sourceName, status: "failed", ...result, error: message };
  }
}

async function finishNationalScanRun({ supabase, rowId, status, result, errorMessage = null }) {
  const { error } = await supabase
    .from("national_scan_runs")
    .update({
      status,
      inserted: result.inserted,
      existing: result.existing,
      failed: result.failed,
      skipped_duplicate: result.skippedDuplicate,
      skipped_rent_only: result.skippedRentOnly,
      skipped_poa: result.skippedPoa,
      result,
      error_message: errorMessage,
      finished_at: new Date().toISOString(),
    })
    .eq("id", rowId);
  if (error) throw error;
}

async function loadLastNextIndex({ supabase }) {
  const { data, error } = await supabase
    .from("national_scan_runs")
    .select("metadata")
    .eq("scan_type", NATIONAL_SCAN_TYPE)
    .order("started_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return Number(data?.[0]?.metadata?.next_index ?? 0) || 0;
}

function normalizeNationalSourceResult(result = {}) {
  return {
    source: result.source ?? result.sourceName ?? "",
    searchUrl: result.searchUrl,
    total: Number(result.total ?? 0),
    unique: Number(result.unique ?? 0),
    inserted: Number(result.inserted ?? 0),
    existing: Number(result.existing ?? 0),
    failed: Number(result.failed ?? 0),
    skippedDuplicate: Number(result.skipped_duplicate ?? result.skippedDuplicate ?? 0),
    skippedRentOnly: Number(result.skipped_rent_only ?? result.skippedRentOnly ?? 0),
    skippedPoa: Number(result.skipped_poa ?? result.skippedPoa ?? 0),
    failedMissingPrice: Number(result.failed_missing_price ?? result.failedMissingPrice ?? 0),
    processed: Number(result.processed ?? 0),
  };
}

export function aggregateNationalResults(results) {
  return {
    inserted: sum(results, "inserted"),
    existing: sum(results, "existing"),
    failed: sum(results, "failed"),
    skippedDuplicate: sum(results, "skippedDuplicate"),
    skippedRentOnly: sum(results, "skippedRentOnly"),
    skippedPoa: sum(results, "skippedPoa"),
    failedMissingPrice: sum(results, "failedMissingPrice"),
    processed: sum(results, "processed"),
    total: sum(results, "total"),
    unique: sum(results, "unique"),
  };
}

function normalizeIndex(value, length) {
  const numeric = Number(value) || 0;
  return ((numeric % length) + length) % length;
}

function sum(values, key) {
  return values.reduce((total, value) => total + (Number(value?.[key]) || 0), 0);
}
