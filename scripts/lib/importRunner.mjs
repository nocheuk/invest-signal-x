import { createClient } from "@supabase/supabase-js";
import {
  dedupeImportRows,
  findDuplicate,
  isSafeGuidePrice,
  mapImportToDealInsert,
  MAX_GUIDE_PRICE,
  MIN_GUIDE_PRICE,
} from "./dealImportCore.mjs";

export async function runDealImport({
  rows,
  sourceName,
  sourceType,
  dryRun,
  sourceConfig = {},
}) {
  if (rows.length === 0) {
    throw new Error("No import rows found.");
  }

  const sourceItemTotal = rows.length;
  const safeRows = rows.map(applyFinalSafetyGuards);
  const { uniqueRows, duplicateRows } = dedupeImportRows(safeRows);

  const url = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!dryRun && (!url || !serviceRoleKey)) {
    throw new Error("VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const supabase = dryRun
    ? null
    : createClient(url, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

  reportImportShape({ sourceItemTotal, uniqueRowTotal: uniqueRows.length, duplicateRowTotal: duplicateRows.length });
  for (const duplicateRow of duplicateRows) {
    report(
      duplicateRow.row.rowNumber,
      "skipped_duplicate",
      `duplicate ${duplicateRow.rule} in source row ${duplicateRow.duplicateOfRowNumber}`
    );
  }

  const source = await getOrCreateSource({ supabase, dryRun, sourceName, sourceType, sourceConfig });
  const run = dryRun ? { id: "dry-run" } : await createImportRun({ supabase, importSourceId: source.id, total: sourceItemTotal });
  const stats = { total: sourceItemTotal, unique: uniqueRows.length, inserted: 0, existing: 0, processed: 0, failed: 0, skipped_duplicate: duplicateRows.length };

  try {
    const existingDeals = dryRun ? [] : await loadExistingDeals(supabase);

    for (const row of uniqueRows) {
      const duplicate = findDuplicate(row.normalized, existingDeals);
      const status = row.validationErrors.length > 0
        ? "failed"
        : duplicate
          ? "skipped_duplicate"
          : "pending";

      const rawImport = dryRun ? { id: `dry-row-${row.rowNumber}` } : await insertRawImport({ supabase, runId: run.id, row, status, duplicate });

      if (row.validationErrors.length > 0) {
        stats.failed += 1;
        report(row.rowNumber, "failed", row.validationErrors.join("; "));
        continue;
      }

      if (duplicate) {
        if (!dryRun) {
          await linkSource({ supabase, dryRun, source, dealId: duplicate.dealId, rawImportId: rawImport.id, row });
          await refreshDuplicateDeal({ supabase, dealId: duplicate.dealId, row, sourceName });
          await updateRawImport({ supabase, rawImportId: rawImport.id, status: "skipped_duplicate", dealId: duplicate.dealId, errorMessage: `Duplicate by ${duplicate.rule}` });
        }
        stats.existing += 1;
        stats.skipped_duplicate += 1;
        report(row.rowNumber, "skipped_duplicate", `${duplicate.rule} -> ${duplicate.dealId}`);
        continue;
      }

      const deal = mapImportToDealInsert(row.normalized, sourceName);
      if (!dryRun) {
        const { error: dealError } = await supabase.from("deals").upsert(stripScriptOnlyFields(deal));
        if (dealError) throw dealError;
        await linkSource({ supabase, dryRun, source, dealId: deal.id, rawImportId: rawImport.id, row });
        await updateRawImport({ supabase, rawImportId: rawImport.id, status: "processed", dealId: deal.id, errorMessage: null });
      }
      existingDeals.push({
        id: deal.id,
        title: deal.title,
        location: deal.location,
        guidePrice: deal.guide_price,
        sourceUrl: row.normalized.sourceUrl,
      });
      stats.processed += 1;
      stats.inserted += 1;
      report(row.rowNumber, "processed", deal.id);
    }

    if (!dryRun) await finishImportRun({ supabase, runId: run.id, stats, status: "processed" });
    const result = { source: sourceName, dryRun, ...stats };
    console.log(JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    if (!dryRun) await finishImportRun({ supabase, runId: run.id, stats, status: "failed", errorMessage: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

function applyFinalSafetyGuards(row) {
  const guidePrice = row.normalized?.guidePrice;
  const normalized = { ...row.normalized };
  let validationErrors = row.validationErrors ?? [];
  let changed = false;

  if (guidePrice !== undefined && guidePrice !== null && guidePrice !== "" && !isSafeGuidePrice(guidePrice)) {
    const message = `guide_price must be a safe integer between ${MIN_GUIDE_PRICE} and ${MAX_GUIDE_PRICE}`;
    validationErrors = [...new Set([...validationErrors, message])];
    normalized.guidePrice = undefined;
    changed = true;
  }

  for (const field of ["passingRent", "sqft", "pricePerSqft", "cashflowAfterDebt"]) {
    const value = normalized[field];
    if (value !== undefined && value !== null && value !== "" && !isSafeNonNegativeNumber(value)) {
      normalized[field] = undefined;
      changed = true;
    }
  }

  if (!changed) return row;

  return {
    ...row,
    normalized,
    validationErrors,
    dedupeKeys: {
      ...row.dedupeKeys,
      titlePriceLocation: undefined,
    },
  };
}

function isSafeNonNegativeNumber(value, max = MAX_GUIDE_PRICE) {
  return Number.isSafeInteger(value) && value >= 0 && value <= max;
}

async function getOrCreateSource({ supabase, dryRun, sourceName, sourceType, sourceConfig }) {
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
    .insert({ name: sourceName, source_type: sourceType, config: sourceConfig })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function createImportRun({ supabase, importSourceId, total }) {
  const { data, error } = await supabase
    .from("import_runs")
    .insert({ import_source_id: importSourceId, status: "pending", stats: { total } })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function finishImportRun({ supabase, runId, stats, status, errorMessage = null }) {
  const { error } = await supabase
    .from("import_runs")
    .update({ status, finished_at: new Date().toISOString(), stats, error_message: errorMessage })
    .eq("id", runId);
  if (error) throw error;
}

async function insertRawImport({ supabase, runId, row, status, duplicate }) {
  const { data, error } = await supabase
    .from("raw_imports")
    .insert({
      import_run_id: runId,
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

async function updateRawImport({ supabase, rawImportId, status, dealId, errorMessage }) {
  const { error } = await supabase
    .from("raw_imports")
    .update({ status, deal_id: dealId, error_message: errorMessage })
    .eq("id", rawImportId);
  if (error) throw error;
}

async function linkSource({ supabase, dryRun, source, dealId, rawImportId, row }) {
  if (dryRun) return;
  if (row.normalized.sourceUrl) {
    const { data: existing, error: existingError } = await supabase
      .from("deal_source_links")
      .select("id")
      .eq("source_url", row.normalized.sourceUrl)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      const { error } = await supabase
        .from("deal_source_links")
        .update({
          deal_id: dealId,
          raw_import_id: rawImportId,
          import_source_id: source.id,
          source_url: row.normalized.sourceUrl,
          confidence: 1,
        })
        .eq("id", existing.id);
      if (error) throw error;
      return;
    }
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

async function refreshDuplicateDeal({ supabase, dealId, row, sourceName }) {
  const deal = mapImportToDealInsert(row.normalized, sourceName);
  const { error } = await supabase
    .from("deals")
    .update({
      title: deal.title,
      location: deal.location,
      region: deal.region,
      asset_type: deal.asset_type,
      source: deal.source,
      guide_price: deal.guide_price,
      passing_rent: deal.passing_rent,
      sqft: deal.sqft,
      thumbnail: deal.thumbnail,
      updated_at: new Date().toISOString(),
    })
    .eq("id", dealId);
  if (error) throw error;
}

async function loadExistingDeals(supabase) {
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

function report(rowNumber, status, detail) {
  console.log(`row ${rowNumber}: ${status}${detail ? ` - ${detail}` : ""}`);
}

function reportImportShape({ sourceItemTotal, uniqueRowTotal, duplicateRowTotal }) {
  console.log(`source items: ${sourceItemTotal}`);
  console.log(`unique rows after source dedupe: ${uniqueRowTotal}`);
  console.log(`duplicate source rows skipped: ${duplicateRowTotal}`);
}
