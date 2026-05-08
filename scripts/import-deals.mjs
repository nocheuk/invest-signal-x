import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  findDuplicate,
  mapImportToDealInsert,
  parseDealCsv,
} from "../src/lib/imports/dealImport.ts";

loadEnv();

const args = parseArgs(process.argv.slice(2));
const filePath = args.file || args._[0];
const sourceName = args["source-name"] || "Manual CSV import";
const sourceType = args["source-type"] || "csv";
const dryRun = Boolean(args["dry-run"]);

if (!filePath) {
  console.error("Usage: npm run import:deals -- --file ./imports/deals.csv --source-name \"Agent CSV\"");
  process.exit(1);
}

const url = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!dryRun && (!url || !serviceRoleKey)) {
  console.error("VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const csv = fs.readFileSync(path.resolve(filePath), "utf8");
const rows = parseDealCsv(csv);

if (rows.length === 0) {
  console.error("No import rows found.");
  process.exit(1);
}

const supabase = dryRun
  ? null
  : createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

const source = await getOrCreateSource();
const run = dryRun ? { id: "dry-run" } : await createImportRun(source.id);
const stats = { total: rows.length, processed: 0, failed: 0, skipped_duplicate: 0 };

try {
  const existingDeals = dryRun ? [] : await loadExistingDeals();

  for (const row of rows) {
    const duplicate = findDuplicate(row.normalized, existingDeals);
    const status = row.validationErrors.length > 0
      ? "failed"
      : duplicate
        ? "skipped_duplicate"
        : "pending";

    const rawImport = dryRun ? { id: `dry-row-${row.rowNumber}` } : await insertRawImport(row, status, duplicate);

    if (row.validationErrors.length > 0) {
      stats.failed += 1;
      report(row.rowNumber, "failed", row.validationErrors.join("; "));
      continue;
    }

    if (duplicate) {
      await linkSource(duplicate.dealId, rawImport.id, row);
      await updateRawImport(rawImport.id, "skipped_duplicate", duplicate.dealId, `Duplicate by ${duplicate.rule}`);
      stats.skipped_duplicate += 1;
      report(row.rowNumber, "skipped_duplicate", `${duplicate.rule} -> ${duplicate.dealId}`);
      continue;
    }

    const deal = mapImportToDealInsert(row.normalized, sourceName);
    if (!dryRun) {
      const { error: dealError } = await supabase.from("deals").upsert(stripScriptOnlyFields(deal));
      if (dealError) throw dealError;
      await linkSource(deal.id, rawImport.id, row);
      await updateRawImport(rawImport.id, "processed", deal.id, null);
    }
    existingDeals.push({
      id: deal.id,
      title: deal.title,
      location: deal.location,
      guidePrice: deal.guide_price,
      sourceUrl: row.normalized.sourceUrl,
    });
    stats.processed += 1;
    report(row.rowNumber, "processed", deal.id);
  }

  if (!dryRun) await finishImportRun("processed");
  console.log(JSON.stringify({ source: sourceName, dryRun, ...stats }, null, 2));
} catch (error) {
  if (!dryRun) await finishImportRun("failed", error instanceof Error ? error.message : String(error));
  throw error;
}

async function getOrCreateSource() {
  if (dryRun) return { id: "dry-source", name: sourceName };
  const { data: existing, error: existingError } = await supabase
    .from("import_sources")
    .select("*")
    .eq("name", sourceName)
    .eq("source_type", sourceType)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing;

  const { data, error } = await supabase
    .from("import_sources")
    .insert({ name: sourceName, source_type: sourceType, config: { future_adapter: "apify-rightmove-compatible" } })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function createImportRun(importSourceId) {
  const { data, error } = await supabase
    .from("import_runs")
    .insert({ import_source_id: importSourceId, status: "pending", stats: { total: rows.length } })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function finishImportRun(status, errorMessage = null) {
  const { error } = await supabase
    .from("import_runs")
    .update({ status, finished_at: new Date().toISOString(), stats, error_message: errorMessage })
    .eq("id", run.id);
  if (error) throw error;
}

async function insertRawImport(row, status, duplicate) {
  const { data, error } = await supabase
    .from("raw_imports")
    .insert({
      import_run_id: run.id,
      external_id: row.normalized.externalId ?? null,
      source_url: row.normalized.sourceUrl ?? null,
      payload: row.raw,
      normalized_payload: row.normalized,
      status,
      error_message: row.validationErrors.join("; ") || (duplicate ? `Duplicate by ${duplicate.rule}` : null),
      row_number: row.rowNumber,
      validation_errors: row.validationErrors,
      dedupe_key: Object.values(row.dedupeKeys).filter(Boolean).join(" || ") || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function updateRawImport(rawImportId, status, dealId, errorMessage) {
  const { error } = await supabase
    .from("raw_imports")
    .update({ status, deal_id: dealId, error_message: errorMessage })
    .eq("id", rawImportId);
  if (error) throw error;
}

async function linkSource(dealId, rawImportId, row) {
  if (dryRun) return;
  if (row.normalized.sourceUrl) {
    const { data: existing, error: existingError } = await supabase
      .from("deal_source_links")
      .select("id")
      .eq("source_url", row.normalized.sourceUrl)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return;
  }

  const { error } = await supabase
    .from("deal_source_links")
    .insert({
      deal_id: dealId,
      raw_import_id: rawImportId,
      import_source_id: source.id,
      source_url: row.normalized.sourceUrl ?? null,
      confidence: 1,
    });
  if (error) throw error;
}

async function loadExistingDeals() {
  const [{ data: deals, error: dealsError }, { data: links, error: linksError }] = await Promise.all([
    supabase.from("deals").select("id,title,location,guide_price"),
    supabase.from("deal_source_links").select("deal_id,source_url").not("source_url", "is", null),
  ]);
  if (dealsError) throw dealsError;
  if (linksError) throw linksError;

  const urlsByDealId = new Map((links ?? []).map((link) => [link.deal_id, link.source_url]));
  return (deals ?? []).map((deal) => ({
    id: deal.id,
    title: deal.title,
    location: deal.location,
    guidePrice: deal.guide_price,
    sourceUrl: urlsByDealId.get(deal.id) ?? null,
  }));
}

function stripScriptOnlyFields(deal) {
  const { import_source_name: _importSourceName, ...insert } = deal;
  return insert;
}

function parseArgs(argv) {
  const parsed = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[index + 1];
      if (!next || next.startsWith("--")) {
        parsed[key] = true;
      } else {
        parsed[key] = next;
        index += 1;
      }
    } else {
      parsed._.push(arg);
    }
  }
  return parsed;
}

function loadEnv() {
  const envPath = path.resolve(".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index);
    const value = trimmed.slice(index + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

function report(rowNumber, status, detail) {
  console.log(`row ${rowNumber}: ${status}${detail ? ` - ${detail}` : ""}`);
}
