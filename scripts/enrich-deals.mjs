import { loadEnv, parseArgs, readBooleanFlag, readStringArg } from "./lib/env.mjs";
import { runDealEnrichment } from "./lib/dealEnrichment.mjs";
import { createServiceClient } from "./lib/rightmoveLocationSearch.mjs";

export async function runDealEnrichmentCli({ dryRun = false, limit = 25 } = {}) {
  const supabase = await createServiceClient();
  const result = await runDealEnrichment({ supabase, dryRun, limit });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function isDirectRun() {
  return process.argv[1]?.replace(/\\/g, "/").endsWith("/scripts/enrich-deals.mjs");
}

if (isDirectRun()) {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));
  const dryRun = readBooleanFlag(args, "dry-run", process.argv);
  const limit = Number(readStringArg(args, "limit") || args._[0] || 25);

  try {
    await runDealEnrichmentCli({ dryRun, limit });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
