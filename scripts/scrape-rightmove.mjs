import { loadEnv, parseArgs, readBooleanFlag, readStringArg } from "./lib/env.mjs";
import { runDealImport } from "./lib/importRunner.mjs";
import {
  fetchRightmoveCommercialHtml,
  filterRightmoveAcquisitionRows,
  extractRightmovePaginationUrls,
  RIGHTMOVE_CUSTOM_SCRAPER_VERSION,
  scrapeRightmoveCommercialHtmlToImportRows,
} from "./lib/rightmoveCommercialScraper.mjs";

const DEFAULT_MAX_PAGES = 2;

export async function runRightmoveCommercialImport({
  searchUrl,
  sourceName = "Rightmove Commercial",
  dryRun = false,
  sourceConfig = {},
  maxPages = DEFAULT_MAX_PAGES,
}) {
  if (!searchUrl) throw new Error("Rightmove search URL is required.");

  console.log(`mode: ${dryRun ? "dry-run" : "live"}`);
  const firstHtml = await fetchRightmoveCommercialHtml(searchUrl);
  const pageUrls = [
    searchUrl,
    ...extractRightmovePaginationUrls({ html: firstHtml, pageUrl: searchUrl, maxPages }),
  ];
  const rows = [];
  for (const [index, pageUrl] of pageUrls.entries()) {
    const html = index === 0 ? firstHtml : await fetchRightmoveCommercialHtml(pageUrl);
    rows.push(...scrapeRightmoveCommercialHtmlToImportRows({ html, pageUrl, sourceName }));
  }
  const uniqueRows = dedupeRightmoveRows(rows);
  const { importRows, skipped } = filterRightmoveAcquisitionRows(uniqueRows);
  reportRightmoveSkips(skipped);
  if (dryRun) reportRightmoveRowContext(uniqueRows);

  if (importRows.length === 0) {
    const result = {
      source: sourceName,
      dryRun,
      total: rows.length,
      unique: uniqueRows.length,
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
      paginated_search_urls: pageUrls,
      request: {
        concurrency: 1,
        timeout_ms: 15000,
        max_pages: maxPages,
      },
      ...sourceConfig,
    },
  });
  return {
    ...result,
    searchUrl,
    pageUrls,
    total: rows.length,
    failed: (result.failed ?? 0) + skipped.failed_missing_price,
    ...skipped,
  };
}

export function dedupeRightmoveRows(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = row.normalized.sourceUrl || row.normalized.externalId || row.dedupeKeys?.sourceUrl || row.dedupeKeys?.dedupeKey;
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function reportRightmoveSkips(skipped) {
  if (skipped.skipped_rent_only) console.log(`skipped_rent_only: ${skipped.skipped_rent_only}`);
  if (skipped.skipped_poa) console.log(`skipped_poa: ${skipped.skipped_poa}`);
  if (skipped.failed_missing_price) console.log(`failed_missing_price: ${skipped.failed_missing_price}`);
}

function reportRightmoveRowContext(rows) {
  console.log("Rightmove parsed row context:");
  for (const row of rows) {
    console.log(JSON.stringify({
      row: row.rowNumber,
      source_url: row.normalized.sourceUrl,
      title: row.normalized.title,
      raw_price: row.raw?.price ?? null,
      parsed_guide_price: row.normalized.guidePrice ?? null,
      parsed_sqft: row.normalized.sqft ?? null,
      listing_intent: row.raw?.listingIntent ?? null,
      skip_reason: row.raw?.skipReason ?? null,
      validation_errors: row.validationErrors,
    }));
  }
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
