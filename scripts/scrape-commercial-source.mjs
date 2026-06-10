import { loadEnv, parseArgs, readBooleanFlag, readStringArg } from "./lib/env.mjs";
import { getCommercialSourceConfig, runConfiguredCommercialSourceImport } from "./lib/commercialSourceScraper.mjs";

export async function runCommercialSourceImport({
  sourceKey,
  searchUrl,
  sourceName,
  dryRun = false,
  maxPages = 2,
  fetchImpl,
  sourceConfig = {},
} = {}) {
  if (!sourceKey) throw new Error("sourceKey is required.");
  const config = getCommercialSourceConfig(sourceKey);
  return runConfiguredCommercialSourceImport({
    sourceKey,
    searchUrl: searchUrl || config.defaultUrl,
    sourceName: sourceName || config.sourceName,
    dryRun,
    maxPages,
    fetchImpl,
    sourceConfig,
  });
}

export async function runCommercialSourceCli(defaultSourceKey) {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));
  const sourceKey = readStringArg(args, "source-key") || defaultSourceKey;
  const config = getCommercialSourceConfig(sourceKey);
  const positionalUrl = args._.find((value) => /^https?:\/\//i.test(String(value)));
  const searchUrl = readStringArg(args, "url") || positionalUrl || config.defaultUrl;
  const sourceName = readStringArg(args, "source-name") || config.sourceName;
  const dryRun = readBooleanFlag(args, "dry-run", process.argv);
  const maxPages = Number(readStringArg(args, "max-pages") || process.env[`${envKey(config.key)}_MAX_PAGES`] || 2);

  try {
    await runCommercialSourceImport({
      sourceKey,
      searchUrl,
      sourceName,
      dryRun,
      maxPages,
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function envKey(value) {
  return String(value).replace(/[^a-z0-9]+/gi, "_").toUpperCase();
}

function isDirectRun() {
  return process.argv[1]?.replace(/\\/g, "/").endsWith("/scripts/scrape-commercial-source.mjs");
}

if (isDirectRun()) {
  await runCommercialSourceCli(readStringArg(parseArgs(process.argv.slice(2)), "source-key"));
}
