import fs from "node:fs";
import path from "node:path";
import { parseDealCsv } from "../src/lib/imports/dealImport.ts";
import { loadEnv, parseArgs, readBooleanFlag, readStringArg } from "./lib/env.mjs";
import { runDealImport } from "./lib/importRunner.mjs";

loadEnv();

const args = parseArgs(process.argv.slice(2));
const filePath = readStringArg(args, "file") || args._[0];
const sourceName = readStringArg(args, "source-name") || "Manual CSV import";
const sourceType = readStringArg(args, "source-type") || "csv";
const dryRun = readBooleanFlag(args, "dry-run", process.argv);

if (!filePath) {
  console.error("Usage: npm run import:deals -- --file ./imports/deals.csv --source-name \"Agent CSV\"");
  process.exit(1);
}

const csv = fs.readFileSync(path.resolve(filePath), "utf8");
const rows = parseDealCsv(csv);

try {
  await runDealImport({
    rows,
    sourceName,
    sourceType,
    dryRun,
    sourceConfig: { adapter: "csv" },
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
