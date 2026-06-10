import { runCustomHtmlScraperImport } from "../scrape-site.mjs";
import { runAllsopImport } from "../scrape-allsop.mjs";
import { runEddisonsImport } from "../scrape-eddisons.mjs";
import { runCommercialSourceImport } from "../scrape-commercial-source.mjs";
import { ALLSOP_COMMERCIAL_SEARCH_URL, ALLSOP_SOURCE_NAME } from "./allsopScraper.mjs";
import { SOURCE_CONFIGS } from "./commercialSourceScraper.mjs";
import { EDDISONS_SALE_LISTINGS_URL, EDDISONS_SOURCE_NAME } from "./eddisonsScraper.mjs";
import { runSavedAlertsForRecentDeals } from "./alerts.mjs";
import { runDealEnrichment } from "./dealEnrichment.mjs";
import {
  ACUITUS_LISTINGS_URL,
  ACUITUS_SOURCE_NAME,
  normalizeLocationQuery,
  RIGHTMOVE_COMMERCIAL_SOURCE_NAME,
  runRightmoveLocationSearch,
} from "./rightmoveLocationSearch.mjs";
import { ENGLAND_NATIONAL_SCAN_LOCATIONS } from "./englandLocationQueue.mjs";
import {
  buildSourceSchedulePlan,
  buildSourceScheduleState,
} from "./sourceSchedule.mjs";

export const NATIONAL_SCAN_TYPE = "england_national_scan";
export const NATIONAL_SCAN_BATCH_SIZE = 16;
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
  includeEddisons = true,
  includeAllsop = true,
  includeExpandedSources = true,
  evaluateAlerts = true,
  evaluateEnrichment = true,
  enrichmentLimit = 20,
  adapters = defaultNationalAdapters(),
  now = new Date(),
  sourceScanHistory,
  forceSources = false,
} = {}) {
  if (!supabase && !dryRun) throw new Error("Supabase service client is required for live national scans.");

  const lastNextIndex = dryRun ? 0 : await loadLastNextIndex({ supabase });
  const scanHistory = sourceScanHistory ?? (dryRun ? [] : await loadRecentSourceScanRuns({ supabase }));
  const batch = selectNationalScanBatch({ lastNextIndex, batchSize, locations });
  const diagnostics = buildNationalScanDiagnostics({ batch, totalLocations: locations.length, batchSize, runsPerDay: 1 });
  const sourcePlan = buildSourceSchedulePlan({
    sources: enabledScheduledSourceNames({ includeAcuitus, includeEddisons, includeAllsop, includeExpandedSources }),
    scanRuns: scanHistory,
    now,
    force: forceSources,
  });
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
    source_schedule: sourcePlan,
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
    const schedule = scheduleForSource(sourcePlan, ACUITUS_SOURCE_NAME);
    if (!schedule.due) results.push(skippedScheduledSource({ sourceName: ACUITUS_SOURCE_NAME, schedule }));
    else {
      const result = await runAndRecordScan({
        supabase,
        dryRun,
        batchId,
        scanType: NATIONAL_SCAN_TYPE,
        locationQuery: "England",
        sourceName: ACUITUS_SOURCE_NAME,
        metadata: { ...sharedMetadata, national_source: true, source_schedule_state: schedule },
        run: () => adapters.acuitus({ dryRun }),
      });
      results.push(result);
    }
  }

  if (includeEddisons) {
    const schedule = scheduleForSource(sourcePlan, EDDISONS_SOURCE_NAME);
    if (!schedule.due) results.push(skippedScheduledSource({ sourceName: EDDISONS_SOURCE_NAME, schedule }));
    else {
      const result = await runAndRecordScan({
        supabase,
        dryRun,
        batchId,
        scanType: NATIONAL_SCAN_TYPE,
        locationQuery: "England",
        sourceName: EDDISONS_SOURCE_NAME,
        metadata: { ...sharedMetadata, national_source: true, source_schedule_state: schedule },
        run: () => adapters.eddisons({ dryRun }),
      });
      results.push(result);
    }
  }

  if (includeAllsop) {
    const schedule = scheduleForSource(sourcePlan, ALLSOP_SOURCE_NAME);
    if (!schedule.due) results.push(skippedScheduledSource({ sourceName: ALLSOP_SOURCE_NAME, schedule }));
    else {
      const result = await runAndRecordScan({
        supabase,
        dryRun,
        batchId,
        scanType: NATIONAL_SCAN_TYPE,
        locationQuery: "England",
        sourceName: ALLSOP_SOURCE_NAME,
        metadata: { ...sharedMetadata, national_source: true, source_schedule_state: schedule },
        run: () => adapters.allsop({ dryRun }),
      });
      results.push(result);
    }
  }

  if (includeExpandedSources) {
    for (const sourceKey of EXPANDED_NATIONAL_SOURCE_KEYS) {
      const config = SOURCE_CONFIGS[sourceKey];
      const schedule = scheduleForSource(sourcePlan, config.sourceName);
      if (!schedule.due) {
        results.push(skippedScheduledSource({ sourceName: config.sourceName, schedule }));
        continue;
      }
      const result = await runAndRecordScan({
        supabase,
        dryRun,
        batchId,
        scanType: NATIONAL_SCAN_TYPE,
        locationQuery: "England",
        sourceName: config.sourceName,
        metadata: { ...sharedMetadata, national_source: true, source_schedule_state: schedule },
        run: () => adapters[sourceKey]({ dryRun }),
      });
      results.push(result);
    }
  }

  const enrichmentResult = !dryRun && evaluateEnrichment
    ? await runEnrichmentSafely({ supabase, limit: enrichmentLimit, now })
    : null;

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
    sourceSchedule: sourcePlan,
    skippedSources: results.filter((result) => result.status === "skipped"),
    sources: results,
    totals: aggregateNationalResults(results),
    enrichment: enrichmentResult,
    alerts: alertResult,
  };
}

export const EXPANDED_NATIONAL_SOURCE_KEYS = [
  "goadsby",
  "zoopla",
  "savills",
  "sdl",
  "pugh",
  "bondWolfe",
  "fisherGerman",
  "lsh",
];

function defaultNationalAdapters() {
  const expandedAdapters = Object.fromEntries(EXPANDED_NATIONAL_SOURCE_KEYS.map((sourceKey) => {
    const config = SOURCE_CONFIGS[sourceKey];
    return [sourceKey, ({ dryRun }) => runCommercialSourceImport({
      sourceKey,
      searchUrl: config.defaultUrl,
      sourceName: config.sourceName,
      dryRun,
      maxPages: 2,
      sourceConfig: {
        national_scan: true,
        page_url: config.defaultUrl,
      },
    })];
  }));

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
    eddisons: ({ dryRun }) => runEddisonsImport({
      searchUrl: EDDISONS_SALE_LISTINGS_URL,
      sourceName: EDDISONS_SOURCE_NAME,
      dryRun,
      maxPages: 2,
      sourceConfig: {
        national_scan: true,
        page_url: EDDISONS_SALE_LISTINGS_URL,
      },
    }),
    allsop: ({ dryRun }) => runAllsopImport({
      searchUrl: ALLSOP_COMMERCIAL_SEARCH_URL,
      sourceName: ALLSOP_SOURCE_NAME,
      dryRun,
      maxPages: 2,
      sourceConfig: {
        national_scan: true,
        page_url: ALLSOP_COMMERCIAL_SEARCH_URL,
      },
    }),
    ...expandedAdapters,
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
    const status = sourceResultShouldFail(result) ? "failed" : "completed";
    const errorMessage = status === "failed" ? result.error || `${sourceName} returned no usable results.` : null;
    if (!dryRun) await finishNationalScanRun({ supabase, rowId, status, result, errorMessage });
    return { id: rowId, locationQuery, sourceName, status, ...result, error: errorMessage };
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

async function loadRecentSourceScanRuns({ supabase }) {
  const { data, error } = await supabase
    .from("national_scan_runs")
    .select("source_name,status,started_at,finished_at,error_message,result")
    .order("started_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    sourceName: String(row.source_name ?? ""),
    status: String(row.status ?? ""),
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    errorMessage: row.error_message,
    result: row.result,
  }));
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
    error: result.error ?? null,
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

function sourceResultShouldFail(result) {
  return Boolean(result.error && result.failed > 0 && result.inserted === 0 && result.existing === 0 && result.processed === 0);
}

function enabledScheduledSourceNames({ includeAcuitus, includeEddisons, includeAllsop, includeExpandedSources }) {
  const names = [RIGHTMOVE_COMMERCIAL_SOURCE_NAME];
  if (includeAcuitus) names.push(ACUITUS_SOURCE_NAME);
  if (includeEddisons) names.push(EDDISONS_SOURCE_NAME);
  if (includeAllsop) names.push(ALLSOP_SOURCE_NAME);
  if (includeExpandedSources) {
    for (const key of EXPANDED_NATIONAL_SOURCE_KEYS) names.push(SOURCE_CONFIGS[key].sourceName);
  }
  return names;
}

function scheduleForSource(sourcePlan, sourceName) {
  return sourcePlan.find((item) => item.sourceName === sourceName) ??
    buildSourceScheduleState({ sourceName, scanRuns: [], now: new Date() });
}

function skippedScheduledSource({ sourceName, schedule }) {
  return {
    id: null,
    locationQuery: "England",
    sourceName,
    source: sourceName,
    status: "skipped",
    total: 0,
    unique: 0,
    inserted: 0,
    existing: 0,
    failed: 0,
    skippedDuplicate: 0,
    skippedRentOnly: 0,
    skippedPoa: 0,
    failedMissingPrice: 0,
    processed: 0,
    error: null,
    schedule,
    skippedReason: schedule.blocked ? "blocked_backoff" : "cooldown",
    nextEligibleAt: schedule.nextEligibleAt,
  };
}

async function runEnrichmentSafely({ supabase, limit, now }) {
  try {
    return await runDealEnrichment({ supabase, limit, now });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      total: 0,
      enriched: 0,
      failed: 0,
      skipped: 0,
      queueSize: 0,
      error: message,
    };
  }
}
