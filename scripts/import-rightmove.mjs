import { getApifyConfig, runRightmoveCommercialActor, fetchDatasetItems } from "./lib/apifyClient.mjs";
import { loadEnv, parseArgs, readBooleanFlag, readStringArg } from "./lib/env.mjs";
import { runDealImport } from "./lib/importRunner.mjs";
import { mapRightmoveItemsToImportRows } from "../src/lib/imports/rightmoveImport.ts";

loadEnv();

const args = parseArgs(process.argv.slice(2));
const searchUrl = readStringArg(args, "url") || args._[0];
const sourceName = readStringArg(args, "source-name") || args._[1] || "Rightmove Commercial";
const dryRun = readBooleanFlag(args, "dry-run", process.argv);

if (!searchUrl) {
  console.error("Usage: npm run import:rightmove -- --url \"https://www.rightmove.co.uk/commercial-property-for-sale/find.html?...\" --source-name \"Rightmove Leeds\" --dry-run");
  process.exit(1);
}

try {
  console.log(`mode: ${dryRun ? "dry-run" : "live"}`);
  const { token, actorId } = getApifyConfig();
  const run = await runRightmoveCommercialActor({ token, actorId, url: searchUrl });
  const items = await fetchDatasetItems({ token, datasetId: run.defaultDatasetId });
  const rows = mapRightmoveItemsToImportRows(items);

  await runDealImport({
    rows,
    sourceName,
    sourceType: "apify_rightmove_commercial",
    dryRun,
    sourceConfig: {
      adapter: "apify-rightmove-commercial",
      actor_id: actorId,
      search_url: searchUrl,
    },
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
