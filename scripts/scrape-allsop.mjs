import { loadEnv, parseArgs, readBooleanFlag, readStringArg } from "./lib/env.mjs";
import { runDealImport } from "./lib/importRunner.mjs";
import {
  ALLSOP_COMMERCIAL_SEARCH_URL,
  ALLSOP_SOURCE_NAME,
  ALLSOP_SOURCE_TYPE,
  allPagesFromPayload,
  fetchAllsopPayload,
  filterAllsopAcquisitionRows,
  scrapeAllsopPayloadToImportRows,
  withAllsopPage,
} from "./lib/allsopScraper.mjs";

export async function runAllsopImport({
  searchUrl = ALLSOP_COMMERCIAL_SEARCH_URL,
  sourceName = ALLSOP_SOURCE_NAME,
  dryRun = false,
  maxPages = 2,
  fetchImpl,
  sourceConfig = {},
} = {}) {
  if (!searchUrl) throw new Error("Allsop search URL is required.");

  console.log(`mode: ${dryRun ? "dry-run" : "live"}`);
  const firstUrl = withAllsopPage(searchUrl, 1);
  const firstPayload = await fetchAllsopPayload(firstUrl, { fetchImpl });
  const pages = allPagesFromPayload(firstPayload, maxPages);
  const rows = [];
  const pageUrls = [];
  for (const page of pages) {
    const pageUrl = withAllsopPage(searchUrl, page);
    pageUrls.push(pageUrl);
    const payload = page === 1 ? firstPayload : await fetchAllsopPayload(pageUrl, { fetchImpl });
    const pageRows = scrapeAllsopPayloadToImportRows({ payload, pageUrl, sourceName })
      .map((row, offset) => ({ ...row, rowNumber: rows.length + offset + 1 }));
    rows.push(...pageRows);
  }

  const { importRows, skipped } = filterAllsopAcquisitionRows(rows);
  reportAllsopSkips(skipped);
  if (importRows.length === 0) {
    const result = {
      source: sourceName,
      dryRun,
      total: rows.length,
      discovered: rows.length,
      importable: 0,
      unique: 0,
      inserted: 0,
      existing: 0,
      processed: 0,
      failed: 0,
      skipped_duplicate: 0,
      skipped_rent_only: skipped.filter((item) => item.reason === "skipped_rent_only").length,
      skipped_poa: skipped.filter((item) => item.reason === "skipped_poa").length,
      skipped_non_commercial: skipped.filter((item) => item.reason === "skipped_non_commercial").length,
    };
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  const result = await runDealImport({
    rows: importRows,
    sourceName,
    sourceType: ALLSOP_SOURCE_TYPE,
    dryRun,
    sourceConfig: {
      adapter: "allsop-commercial-auctions-v1",
      page_url: searchUrl,
      sale_only: true,
      max_pages: maxPages,
      pages_scanned: pageUrls,
      ...sourceConfig,
    },
  });
  const finalResult = {
    ...result,
    total: rows.length,
    discovered: rows.length,
    importable: importRows.length,
    skipped_rent_only: Number(result.skipped_rent_only ?? 0) + skipped.filter((item) => item.reason === "skipped_rent_only").length,
    skipped_poa: Number(result.skipped_poa ?? 0) + skipped.filter((item) => item.reason === "skipped_poa").length,
    skipped_non_commercial: skipped.filter((item) => item.reason === "skipped_non_commercial").length,
  };
  console.log(JSON.stringify({
    source: sourceName,
    dryRun,
    discovered: finalResult.discovered,
    importable: finalResult.importable,
    inserted: finalResult.inserted,
    existing: finalResult.existing,
    failed: finalResult.failed,
    skipped_duplicate: finalResult.skipped_duplicate,
    skipped_rent_only: finalResult.skipped_rent_only,
    skipped_poa: finalResult.skipped_poa,
    skipped_non_commercial: finalResult.skipped_non_commercial,
  }, null, 2));
  return finalResult;
}

function reportAllsopSkips(skipped) {
  for (const item of skipped) {
    console.log(`row ${item.row.rowNumber}: ${item.reason} - ${item.row.normalized.sourceUrl ?? item.row.normalized.title}`);
  }
}

function isDirectRun() {
  return process.argv[1]?.replace(/\\/g, "/").endsWith("/scripts/scrape-allsop.mjs");
}

if (isDirectRun()) {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));
  const positionalUrl = args._.find((value) => /^https?:\/\//i.test(String(value)));
  const searchUrl = readStringArg(args, "url") || positionalUrl || ALLSOP_COMMERCIAL_SEARCH_URL;
  const sourceName = readStringArg(args, "source-name") || ALLSOP_SOURCE_NAME;
  const dryRun = readBooleanFlag(args, "dry-run", process.argv);
  const maxPages = Number(readStringArg(args, "max-pages") || process.env.ALLSOP_MAX_PAGES || 2);

  try {
    await runAllsopImport({ searchUrl, sourceName, dryRun, maxPages });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
