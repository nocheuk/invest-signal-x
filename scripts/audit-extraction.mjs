import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { extractInvestmentFacts } from "./lib/investmentDataExtraction.mjs";

loadEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for extraction audit.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
const rows = await loadRows();
const audit = {
  totalRowsChecked: rows.length,
  tenantFoundInTextButMissingInDisplay: [],
  rentFoundInTextButMissingInDisplay: [],
  leaseExpiryFoundInTextButMissingInDisplay: [],
};

for (const row of rows) {
  const raw = row.raw_imports ?? {};
  const payload = raw.payload ?? {};
  const normalized = raw.normalized_payload ?? {};
  const deal = row.deals ?? {};
  const facts = extractInvestmentFacts({
    title: normalized.title ?? payload.title ?? deal.title,
    description: normalized.description ?? payload.description,
    text: payload.rawText,
    payload,
  });
  const entry = {
    dealId: row.deal_id,
    title: deal.title ?? normalized.title ?? payload.title,
    sourceUrl: row.source_url,
    tenantFound: facts.tenantName,
    passingRentFound: facts.passingRent,
    leaseExpiryFound: facts.leaseExpiryText,
    displayedTenant: deal.tenant,
    displayedPassingRent: deal.passing_rent,
    displayedLeaseLength: deal.lease_length,
    displayedWault: deal.wault,
  };
  if (facts.tenantName && (!deal.tenant || deal.tenant === "Unknown")) audit.tenantFoundInTextButMissingInDisplay.push(entry);
  if (facts.passingRent && Number(deal.passing_rent ?? 0) <= 0) audit.rentFoundInTextButMissingInDisplay.push(entry);
  if (facts.leaseExpiryText && Number(deal.lease_length ?? 0) <= 0 && Number(deal.wault ?? 0) <= 0) audit.leaseExpiryFoundInTextButMissingInDisplay.push(entry);
}

console.log(JSON.stringify({
  totalRowsChecked: audit.totalRowsChecked,
  tenantFoundInTextButMissingInDisplay: audit.tenantFoundInTextButMissingInDisplay.length,
  rentFoundInTextButMissingInDisplay: audit.rentFoundInTextButMissingInDisplay.length,
  leaseExpiryFoundInTextButMissingInDisplay: audit.leaseExpiryFoundInTextButMissingInDisplay.length,
  examples: {
    tenant: audit.tenantFoundInTextButMissingInDisplay.slice(0, 10),
    rent: audit.rentFoundInTextButMissingInDisplay.slice(0, 10),
    lease: audit.leaseExpiryFoundInTextButMissingInDisplay.slice(0, 10),
  },
}, null, 2));

async function loadRows() {
  const output = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("deal_source_links")
      .select("deal_id,source_url,deals(id,title,tenant,passing_rent,lease_length,wault),raw_imports(payload,normalized_payload)")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    output.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return output;
}

function loadEnv() {
  if (!fs.existsSync(".env")) return;
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] ??= value;
  }
}
