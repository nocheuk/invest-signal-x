import { loadEnv, parseArgs, readBooleanFlag, readStringArg } from "./lib/env.mjs";
import { createServiceClient } from "./lib/rightmoveLocationSearch.mjs";
import { runNationalScan, NATIONAL_SCAN_BATCH_SIZE } from "./lib/nationalScan.mjs";

export async function runNationalScanCli({ dryRun = false, batchSize = NATIONAL_SCAN_BATCH_SIZE } = {}) {
  const supabase = dryRun ? null : await createServiceClient();
  const result = await runNationalScan({ supabase, dryRun, batchSize });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function isDirectRun() {
  return process.argv[1]?.replace(/\\/g, "/").endsWith("/scripts/scan-national.mjs");
}

if (isDirectRun()) {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));
  const dryRun = readBooleanFlag(args, "dry-run", process.argv);
  const batchSize = Number(readStringArg(args, "batch-size") || args._[0] || NATIONAL_SCAN_BATCH_SIZE);

  try {
    await runNationalScanCli({ dryRun, batchSize });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
