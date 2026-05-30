import { loadEnv, parseArgs, readStringArg } from "./lib/env.mjs";
import { runNationalScan, NATIONAL_SCAN_BATCH_SIZE } from "./lib/nationalScan.mjs";

const DEFAULT_BATCH_SIZES = [4, 8, 12, 16];

export async function benchmarkNationalScan({
  batchSizes = DEFAULT_BATCH_SIZES,
  includeAcuitus = true,
  maxDurationSeconds = 60,
  logger = console.log,
} = {}) {
  const results = [];
  for (const batchSize of batchSizes) {
    if (global.gc) global.gc();
    const before = process.memoryUsage();
    const started = performance.now();
    const result = await runNationalScan({
      dryRun: true,
      batchSize,
      includeAcuitus,
      evaluateAlerts: false,
    });
    const durationMs = Math.round(performance.now() - started);
    const after = process.memoryUsage();
    const row = {
      batchSize,
      durationMs,
      durationSeconds: Number((durationMs / 1000).toFixed(2)),
      rssMb: toMb(after.rss),
      heapUsedMb: toMb(after.heapUsed),
      memoryDeltaMb: toMb(after.rss - before.rss),
      locationsScanned: result.locations.length,
      sources: result.sources.length,
      importedDeals: result.totals.processed,
      reachableRows: result.totals.total,
      insertedDryRun: result.totals.inserted,
      existingDryRun: result.totals.existing,
      failed: result.totals.failed,
      skippedDuplicate: result.totals.skippedDuplicate,
      skippedRentOnly: result.totals.skippedRentOnly,
      skippedPoa: result.totals.skippedPoa,
      estimatedFullCycleDays: Math.ceil(result.diagnostics.totalConfiguredLocations / batchSize),
    };
    results.push(row);
    logger(JSON.stringify(row));
  }
  const recommendation = recommendBatchSize(results, { maxDurationSeconds });
  const report = { results, recommendation };
  logger(JSON.stringify(report, null, 2));
  return report;
}

export function recommendBatchSize(results, { maxDurationSeconds = 60, safetyFactor = 0.6 } = {}) {
  const budgetSeconds = maxDurationSeconds * safetyFactor;
  const safe = results.filter((result) => result.durationSeconds <= budgetSeconds);
  const candidates = safe.length ? safe : results;
  return [...candidates].sort((a, b) => b.batchSize - a.batchSize)[0];
}

function toMb(bytes) {
  return Number((bytes / 1024 / 1024).toFixed(1));
}

function isDirectRun() {
  return process.argv[1]?.replace(/\\/g, "/").endsWith("/scripts/benchmark-national-scan.mjs");
}

if (isDirectRun()) {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));
  const batchSizes = (readStringArg(args, "batch-sizes") || DEFAULT_BATCH_SIZES.join(","))
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);
  const maxDurationSeconds = Number(readStringArg(args, "max-duration-seconds") || 60);
  benchmarkNationalScan({
    batchSizes: batchSizes.length ? batchSizes : [NATIONAL_SCAN_BATCH_SIZE],
    maxDurationSeconds: Number.isFinite(maxDurationSeconds) && maxDurationSeconds > 0 ? maxDurationSeconds : 60,
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
