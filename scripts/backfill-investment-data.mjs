import { loadEnv, parseArgs, readBooleanFlag, readStringArg } from "./lib/env.mjs";
import { runInvestmentDataBackfill } from "./lib/investmentDataBackfill.mjs";
import { createServiceClient } from "./lib/rightmoveLocationSearch.mjs";

export async function runInvestmentDataBackfillCli({
  dealId,
  sourceUrl,
  limit = 100,
  dryRun = false,
} = {}) {
  const supabase = await createServiceClient();
  const result = await runInvestmentDataBackfill({ supabase, dealId, sourceUrl, limit, dryRun });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function isDirectRun() {
  return process.argv[1]?.replace(/\\/g, "/").endsWith("/scripts/backfill-investment-data.mjs");
}

if (isDirectRun()) {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));
  const positionalTarget = typeof args._[0] === "string" && !/^\d+$/.test(args._[0]) ? args._[0] : undefined;
  const dealId = readStringArg(args, "deal-id") || (positionalTarget && !/^https?:\/\//i.test(positionalTarget) ? positionalTarget : undefined);
  const sourceUrl = readStringArg(args, "source-url") || (positionalTarget && /^https?:\/\//i.test(positionalTarget) ? positionalTarget : undefined);
  const positionalLimit = typeof args._[0] === "string" && /^\d+$/.test(args._[0]) ? args._[0] : undefined;
  const limit = Number(readStringArg(args, "limit") || positionalLimit || 100);
  const dryRun = readBooleanFlag(args, "dry-run", process.argv);

  try {
    await runInvestmentDataBackfillCli({ dealId, sourceUrl, limit, dryRun });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
