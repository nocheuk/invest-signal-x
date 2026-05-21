import { loadEnv, parseArgs, readBooleanFlag, readStringArg } from "./lib/env.mjs";
import { runDealImport } from "./lib/importRunner.mjs";
import {
  fetchRightmoveCommercialHtml,
  RIGHTMOVE_CUSTOM_SCRAPER_VERSION,
  scrapeRightmoveCommercialHtmlToImportRows,
} from "./lib/rightmoveCommercialScraper.mjs";

loadEnv();

const args = parseArgs(process.argv.slice(2));
const searchUrl = readStringArg(args, "url") || args._[0];
const sourceName = readStringArg(args, "source-name") || args._[1] || "Rightmove Commercial Custom";
const dryRun = readBooleanFlag(args, "dry-run", process.argv);

if (!searchUrl) {
  console.error("Usage: npm run scrape:rightmove -- --url \"https://www.rightmove.co.uk/commercial-property-for-sale/Bournemouth.html\" --source-name \"Rightmove Bournemouth Commercial\" --dry-run");
  process.exit(1);
}

try {
  console.log(`mode: ${dryRun ? "dry-run" : "live"}`);
  const html = await fetchRightmoveCommercialHtml(searchUrl);
  const rows = scrapeRightmoveCommercialHtmlToImportRows({ html, pageUrl: searchUrl, sourceName });

  await runDealImport({
    rows,
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
    },
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
