import fs from "node:fs";
import path from "node:path";
import { loadEnv, parseArgs, readBooleanFlag, readStringArg } from "./lib/env.mjs";
import { fetchHtml, scrapeHtmlToImportRows, SCRAPER_ADAPTER_VERSION } from "./lib/htmlScraper.mjs";
import { runDealImport } from "./lib/importRunner.mjs";

export async function runCustomHtmlScraperImport({
  pageUrl,
  sourceName = "Custom HTML scraper",
  selectorConfigPath,
  dryRun = false,
  rowFilter,
  sourceConfig = {},
}) {
  if (!pageUrl || !selectorConfigPath) throw new Error("Page URL and selector config are required.");

  console.log(`mode: ${dryRun ? "dry-run" : "live"}`);
  const config = JSON.parse(fs.readFileSync(path.resolve(selectorConfigPath), "utf8"));
  const html = await fetchHtml(pageUrl);
  const rows = scrapeHtmlToImportRows({ html, pageUrl, config, sourceName });
  const filteredRows = typeof rowFilter === "function" ? rows.filter(rowFilter) : rows;
  if (filteredRows.length === 0) {
    const result = { source: sourceName, dryRun, total: rows.length, unique: 0, inserted: 0, existing: 0, processed: 0, failed: 0, skipped_duplicate: 0 };
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  const result = await runDealImport({
    rows: filteredRows,
    sourceName,
    sourceType: "custom_html_scraper",
    dryRun,
    sourceConfig: {
      adapter: SCRAPER_ADAPTER_VERSION,
      page_url: pageUrl,
      selector_config_path: selectorConfigPath,
      selectors: config.selectors ?? config,
      ...sourceConfig,
    },
  });
  return { ...result, total: rows.length };
}

function isDirectRun() {
  return process.argv[1]?.replace(/\\/g, "/").endsWith("/scripts/scrape-site.mjs");
}

if (isDirectRun()) {
  loadEnv();

  const args = parseArgs(process.argv.slice(2));
  const pageUrl = readStringArg(args, "url") || args._[0];
  const sourceName = readStringArg(args, "source-name") || args._[1] || "Custom HTML scraper";
  const selectorConfigPath = readStringArg(args, "selector-config") || args._[2];
  const dryRun = readBooleanFlag(args, "dry-run", process.argv);

  if (!pageUrl || !selectorConfigPath) {
    console.error("Usage: npm run scrape:site -- --url \"https://example-agent-site.com/commercial\" --source-name \"Example Agent\" --selector-config ./scrapers/example-agent.json --dry-run");
    process.exit(1);
  }

  try {
    await runCustomHtmlScraperImport({ pageUrl, sourceName, selectorConfigPath, dryRun });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
