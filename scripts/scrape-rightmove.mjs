import { loadEnv, parseArgs, readBooleanFlag, readStringArg } from "./lib/env.mjs";
import { runDealImport } from "./lib/importRunner.mjs";
import {
  fetchRightmoveCommercialHtml,
  filterRightmoveAcquisitionRows,
  RIGHTMOVE_CUSTOM_SCRAPER_VERSION,
  scrapeRightmoveCommercialHtmlToImportRows,
} from "./lib/rightmoveCommercialScraper.mjs";

export async function runRightmoveCommercialImport({
  searchUrl,
  sourceName = "Rightmove Commercial",
  dryRun = false,
  sourceConfig = {},
}) {
  if (!searchUrl) throw new Error("Rightmove search URL is required.");

  console.log(`mode: ${dryRun ? "dry-run" : "live"}`);
  const html = await fetchRightmoveCommercialHtml(searchUrl);
  const rows = scrapeRightmoveCommercialHtmlToImportRows({ html, pageUrl: searchUrl, sourceName });
  const { importRows, skipped } = filterRightmoveAcquisitionRows(rows);
  reportRightmoveSkips(skipped);

  if (importRows.length === 0) {
    const result = {
      source: sourceName,
      dryRun,
      total: rows.length,
      unique: 0,
      inserted: 0,
      existing: 0,
      processed: 0,
      failed: skipped.failed_missing_price,
      skipped_duplicate: 0,
      ...skipped,
    };
    console.log(JSON.stringify(result, null, 2));
    return { ...result, searchUrl };
  }

  const result = await runDealImport({
    rows: importRows,
    sourceName,
    sourceType: "custom_rightmove_commercial",
    dryRun,
    sourceConfig: {
      adapter: RIGHTMOVE_CUSTOM_SCRAPER_VERSION,
      search_url: searchUrl,
      request: {
        concurrency: 1,
        timeout_ms: 15000,
      },
      ...sourceConfig,
    },
  });
  return {
    ...result,
    searchUrl,
    total: rows.length,
    failed: (result.failed ?? 0) + skipped.failed_missing_price,
    ...skipped,
  };
}

function reportRightmoveSkips(skipped) {
  if (skipped.skipped_rent_only) console.log(`skipped_rent_only: ${skipped.skipped_rent_only}`);
  if (skipped.skipped_poa) console.log(`skipped_poa: ${skipped.skipped_poa}`);
  if (skipped.failed_missing_price) console.log(`failed_missing_price: ${skipped.failed_missing_price}`);
}

function isDirectRun() {
  return process.argv[1]?.replace(/\\/g, "/").endsWith("/scripts/scrape-rightmove.mjs");
}

if (isDirectRun()) {
  loadEnv();

  const args = parseArgs(process.argv.slice(2));
  const searchUrl = readStringArg(args, "url") || args._[0];
  const sourceName = readStringArg(args, "source-name") || args._[1] || "Rightmove Commercial";
  const dryRun = readBooleanFlag(args, "dry-run", process.argv);

  if (!searchUrl) {
    console.error("Usage: npm run scrape:rightmove -- --url \"https://www.rightmove.co.uk/commercial-property-for-sale/Bournemouth.html\" --source-name \"Rightmove Commercial\" --dry-run");
    process.exit(1);
  }

  try {
    await runRightmoveCommercialImport({ searchUrl, sourceName, dryRun });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
