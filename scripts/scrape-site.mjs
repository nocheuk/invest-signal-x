import fs from "node:fs";
import path from "node:path";
import { loadEnv, parseArgs, readBooleanFlag, readStringArg } from "./lib/env.mjs";
import { fetchHtml, scrapeHtmlToImportRows, SCRAPER_ADAPTER_VERSION } from "./lib/htmlScraper.mjs";
import { runDealImport } from "./lib/importRunner.mjs";

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
  console.log(`mode: ${dryRun ? "dry-run" : "live"}`);
  const config = JSON.parse(fs.readFileSync(path.resolve(selectorConfigPath), "utf8"));
  const html = await fetchHtml(pageUrl);
  const rows = scrapeHtmlToImportRows({ html, pageUrl, config, sourceName });

  await runDealImport({
    rows,
    sourceName,
    sourceType: "custom_html_scraper",
    dryRun,
    sourceConfig: {
      adapter: SCRAPER_ADAPTER_VERSION,
      page_url: pageUrl,
      selector_config_path: selectorConfigPath,
      selectors: config.selectors ?? config,
    },
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
