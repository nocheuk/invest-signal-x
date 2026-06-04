import { loadEnv, parseArgs, readBooleanFlag, readStringArg } from "./lib/env.mjs";
import { runDealImport } from "./lib/importRunner.mjs";
import {
  EDDISONS_SALE_LISTINGS_URL,
  EDDISONS_SOURCE_NAME,
  EDDISONS_SOURCE_TYPE,
  extractEddisonsPaginationUrls,
  fetchEddisonsHtml,
  filterEddisonsSaleRows,
  scrapeEddisonsHtmlToImportRows,
} from "./lib/eddisonsScraper.mjs";

export async function runEddisonsImport({
  searchUrl = EDDISONS_SALE_LISTINGS_URL,
  sourceName = EDDISONS_SOURCE_NAME,
  dryRun = false,
  maxPages = 2,
  fetchImpl,
  sourceConfig = {},
} = {}) {
  if (!searchUrl) throw new Error("Eddisons search URL is required.");

  console.log(`mode: ${dryRun ? "dry-run" : "live"}`);
  const firstHtml = await fetchEddisonsHtml(searchUrl, { fetchImpl });
  const pageUrls = [
    searchUrl,
    ...extractEddisonsPaginationUrls({ html: firstHtml, pageUrl: searchUrl, maxPages }),
  ];
  const rows = [];
  for (const [index, pageUrl] of pageUrls.entries()) {
    const html = index === 0 ? firstHtml : await fetchEddisonsHtml(pageUrl, { fetchImpl });
    const pageRows = scrapeEddisonsHtmlToImportRows({ html, pageUrl, sourceName })
      .map((row, offset) => ({ ...row, rowNumber: rows.length + offset + 1 }));
    rows.push(...pageRows);
  }

  const { importRows, skipped } = filterEddisonsSaleRows(rows);
  reportEddisonsSkips(skipped);
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
    };
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  const result = await runDealImport({
    rows: importRows,
    sourceName,
    sourceType: EDDISONS_SOURCE_TYPE,
    dryRun,
    sourceConfig: {
      adapter: "eddisons-commercial-v1",
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
  }, null, 2));
  return finalResult;
}

function reportEddisonsSkips(skipped) {
  for (const item of skipped) {
    console.log(`row ${item.row.rowNumber}: ${item.reason} - ${item.row.normalized.sourceUrl ?? item.row.normalized.title}`);
  }
}

function isDirectRun() {
  return process.argv[1]?.replace(/\\/g, "/").endsWith("/scripts/scrape-eddisons.mjs");
}

if (isDirectRun()) {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));
  const positionalUrl = args._.find((value) => /^https?:\/\//i.test(String(value)));
  const searchUrl = readStringArg(args, "url") || positionalUrl || EDDISONS_SALE_LISTINGS_URL;
  const sourceName = readStringArg(args, "source-name") || EDDISONS_SOURCE_NAME;
  const dryRun = readBooleanFlag(args, "dry-run", process.argv);
  const maxPages = Number(readStringArg(args, "max-pages") || process.env.EDDISONS_MAX_PAGES || 2);

  try {
    await runEddisonsImport({ searchUrl, sourceName, dryRun, maxPages });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
