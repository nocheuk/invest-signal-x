import { load } from "cheerio";
import { mapImportToDealInsert } from "./dealImportCore.mjs";
import { parseMoney, parseRent, parseSize, USER_AGENT } from "./commercialSourceScraper.mjs";

const DEFAULT_LIMIT = 25;
const DEFAULT_TIMEOUT_MS = 20000;
const RETRY_HOURS = 24;
const MAX_SUMMARY_LENGTH = 700;

export async function runDealEnrichment({
  supabase,
  dryRun = false,
  limit = DEFAULT_LIMIT,
  fetchImpl = fetch,
  now = new Date(),
} = {}) {
  if (!supabase && !dryRun) throw new Error("Supabase service client is required for live enrichment.");

  const candidates = dryRun
    ? []
    : await loadEnrichmentCandidates({ supabase, limit, now });

  const stats = {
    dryRun,
    total: candidates.length,
    enriched: 0,
    failed: 0,
    skipped: 0,
    queueSize: candidates.length,
  };
  const results = [];

  for (const candidate of candidates) {
    try {
      await markEnrichmentAttempt({ supabase, candidate, now });
      const html = await fetchDetailHtml(candidate.sourceUrl, { fetchImpl });
      const enrichment = extractDealEnrichment({
        html,
        sourceUrl: candidate.sourceUrl,
        sourceName: candidate.sourceName,
      });

      if (!hasUsefulEnrichment(enrichment)) {
        throw new Error("No enrichment fields found on source detail page.");
      }

      await saveEnrichment({ supabase, candidate, enrichment, now });
      await applyEnrichmentToDeal({ supabase, candidate, enrichment });
      stats.enriched += 1;
      results.push({ dealId: candidate.deal.id, status: "enriched", fields: enrichedFieldNames(enrichment) });
    } catch (error) {
      const message = errorMessage(error);
      await saveFailedEnrichment({ supabase, candidate, message, now });
      stats.failed += 1;
      results.push({ dealId: candidate.deal.id, status: "failed", error: message });
    }
  }

  return { ...stats, results };
}

export function extractDealEnrichment({ html, sourceUrl = "", sourceName = "" } = {}) {
  const $ = load(html ?? "");
  $("script, style, noscript, svg").remove();
  const paragraphs = $("p, li, div, section")
    .toArray()
    .map((node) => clean($(node).text()))
    .filter((value, index, values) => value.length > 0 && values.indexOf(value) === index);
  const text = clean($("body").text());
  const rentText = findContext(text, /(passing\s+rent|current\s+rent|rental\s+income|income|rent)\b/i);
  const guideText = findContext(text, /(guide\s+price|offers\s+over|asking\s+price|price)\b/i);
  const areaText = findContext(text, /(floor\s+area|area|sq\s*ft|sqft|gia|nia)\b/i);
  const summary = pickInvestmentSummary(paragraphs);
  const auctionInfo = extractAuctionInfo(text);

  return {
    sourceUrl,
    sourceName,
    tenantName: extractTenant(text),
    passingRent: parseRent(rentText || text),
    leaseLength: extractYears(text, /(lease\s+length|lease\s+term|unexpired\s+term|term\s+certain|lease)\D{0,70}(\d+(?:\.\d+)?)\s*(?:years|yrs|year)/i),
    wault: extractYears(text, /\bWAULT\b\D{0,50}(\d+(?:\.\d+)?)\s*(?:years|yrs|year)?/i),
    epcRating: extractEpc(text),
    sqft: parseSize(areaText || text),
    guidePrice: parseMoney(guideText || text),
    auctionInfo,
    vatInfo: extractVat(text),
    investmentSummary: summary,
    extractedPayload: {
      rentText,
      guideText,
      areaText,
      summary,
      auctionInfo,
      sourceUrl,
    },
  };
}

async function loadEnrichmentCandidates({ supabase, limit, now }) {
  const { data: links, error } = await supabase
    .from("deal_source_links")
    .select("deal_id,source_url,import_sources(name,source_type),deals(*)")
    .not("source_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(Math.max(limit * 4, limit));
  if (error) throw error;

  const normalizedLinks = (links ?? [])
    .map((link) => {
      const source = Array.isArray(link.import_sources) ? link.import_sources[0] : link.import_sources;
      const deal = Array.isArray(link.deals) ? link.deals[0] : link.deals;
      if (!deal || !link.source_url) return null;
      return {
        deal,
        sourceUrl: link.source_url,
        sourceName: source?.name ?? "",
        sourceType: source?.source_type ?? "",
      };
    })
    .filter(Boolean);

  const dealIds = normalizedLinks.map((link) => link.deal.id);
  const enrichments = await loadExistingEnrichments({ supabase, dealIds });
  const nowMs = now.getTime();
  return normalizedLinks
    .filter((candidate) => {
      const existing = enrichments.get(candidate.deal.id);
      if (!existing) return true;
      if (existing.status === "enriched") return false;
      const nextMs = new Date(existing.next_attempt_at ?? 0).getTime();
      return !Number.isFinite(nextMs) || nextMs <= nowMs;
    })
    .slice(0, limit)
    .map((candidate) => ({ ...candidate, existingEnrichment: enrichments.get(candidate.deal.id) ?? null }));
}

async function loadExistingEnrichments({ supabase, dealIds }) {
  const enrichments = new Map();
  if (dealIds.length === 0) return enrichments;
  const { data, error } = await supabase
    .from("deal_enrichments")
    .select("*")
    .in("deal_id", dealIds);
  if (error) throw error;
  for (const row of data ?? []) enrichments.set(row.deal_id, row);
  return enrichments;
}

async function markEnrichmentAttempt({ supabase, candidate, now }) {
  const attempts = Number(candidate.existingEnrichment?.attempt_count ?? 0) + 1;
  const { error } = await supabase
    .from("deal_enrichments")
    .upsert({
      deal_id: candidate.deal.id,
      source_url: candidate.sourceUrl,
      status: "pending",
      attempt_count: attempts,
      last_attempted_at: now.toISOString(),
      next_attempt_at: now.toISOString(),
      last_error: null,
    }, { onConflict: "deal_id" });
  if (error) throw error;
}

async function saveEnrichment({ supabase, candidate, enrichment, now }) {
  const { error } = await supabase
    .from("deal_enrichments")
    .upsert({
      deal_id: candidate.deal.id,
      source_url: candidate.sourceUrl,
      status: "enriched",
      attempt_count: Number(candidate.existingEnrichment?.attempt_count ?? 0) + 1,
      last_attempted_at: now.toISOString(),
      next_attempt_at: null,
      last_error: null,
      tenant_name: enrichment.tenantName ?? null,
      passing_rent: enrichment.passingRent ?? null,
      lease_length: enrichment.leaseLength ?? null,
      wault: enrichment.wault ?? null,
      epc_rating: enrichment.epcRating ?? null,
      sqft: enrichment.sqft ?? null,
      guide_price: enrichment.guidePrice ?? null,
      auction_info: enrichment.auctionInfo ?? {},
      vat_info: enrichment.vatInfo ?? null,
      investment_summary: enrichment.investmentSummary ?? null,
      extracted_payload: enrichment.extractedPayload ?? {},
    }, { onConflict: "deal_id" });
  if (error) throw error;
}

async function saveFailedEnrichment({ supabase, candidate, message, now }) {
  const attempts = Number(candidate.existingEnrichment?.attempt_count ?? 0) + 1;
  const nextAttemptAt = new Date(now.getTime() + RETRY_HOURS * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from("deal_enrichments")
    .upsert({
      deal_id: candidate.deal.id,
      source_url: candidate.sourceUrl,
      status: "failed",
      attempt_count: attempts,
      last_attempted_at: now.toISOString(),
      next_attempt_at: nextAttemptAt,
      last_error: message,
    }, { onConflict: "deal_id" });
  if (error) throw error;
}

async function applyEnrichmentToDeal({ supabase, candidate, enrichment }) {
  const deal = candidate.deal;
  const normalized = {
    externalId: deal.id,
    sourceUrl: candidate.sourceUrl,
    title: deal.title,
    location: deal.location,
    region: deal.region,
    assetType: deal.asset_type,
    source: deal.source,
    guidePrice: enrichment.guidePrice ?? Number(deal.guide_price ?? 0),
    passingRent: enrichment.passingRent ?? Number(deal.passing_rent ?? 0),
    sqft: enrichment.sqft ?? Number(deal.sqft ?? 0),
    grossYield: Number(deal.gross_yield ?? 0),
    netInitialYield: Number(deal.net_initial_yield ?? 0),
    reversionaryYield: Number(deal.reversionary_yield ?? 0),
    wault: enrichment.wault ?? Number(deal.wault ?? 0),
    leaseLength: enrichment.leaseLength ?? Number(deal.lease_length ?? 0),
    tenant: enrichment.tenantName ?? deal.tenant ?? "Unknown",
    covenantStrength: deal.covenant_strength || "Moderate",
    tenantHealthScore: Number(deal.tenant_health_score ?? 0) || undefined,
    rentSustainability: deal.rent_sustainability || "Market rent",
    rentReview: deal.rent_review || "None",
    pricePerSqft: Number(deal.price_per_sqft ?? 0) || undefined,
    planningUpsideScore: Number(deal.planning_upside_score ?? 0) || undefined,
    voidRiskScore: Number(deal.void_risk_score ?? 0) || undefined,
    exitYieldSensitivity: deal.exit_yield_sensitivity || "Moderate",
    auctionGuideRisk: deal.auction_guide_risk ?? undefined,
    redFlags: deal.red_flags ?? [],
    mainRiskFlag: "Enriched from source detail page; verify source documents before offer",
    description: enrichment.investmentSummary ?? undefined,
    postedAt: deal.posted_at,
  };
  const rescored = mapImportToDealInsert(normalized, candidate.sourceName || "Source enrichment");
  const { error } = await supabase
    .from("deals")
    .update({
      guide_price: rescored.guide_price,
      passing_rent: rescored.passing_rent,
      sqft: rescored.sqft,
      gross_yield: rescored.gross_yield,
      net_initial_yield: rescored.net_initial_yield,
      reversionary_yield: rescored.reversionary_yield,
      wault: rescored.wault,
      lease_length: rescored.lease_length,
      tenant: rescored.tenant,
      tenant_health_score: rescored.tenant_health_score,
      price_per_sqft: rescored.price_per_sqft,
      score: rescored.score,
      rating: rescored.rating,
      score_breakdown: rescored.score_breakdown,
      insights: rescored.insights,
      main_risk_flag: rescored.main_risk_flag,
      updated_at: new Date().toISOString(),
    })
    .eq("id", deal.id);
  if (error) throw error;
}

export async function fetchDetailHtml(url, { timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml;q=0.9",
      },
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
    if (isBlockedHtml(text)) throw new Error("Source detail page is blocked by anti-bot protection.");
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

function extractTenant(text) {
  const patterns = [
    /\b(?:let|leased)\s+to\s+([^.;\n\r]{3,80})/i,
    /\btenant(?:\s+name)?\s*[:\-]\s*([^.;\n\r]{3,80})/i,
    /\boccupied\s+by\s+([^.;\n\r]{3,80})/i,
  ];
  for (const pattern of patterns) {
    const value = clean(text.match(pattern)?.[1] ?? "");
    if (value && !/unknown|vacant|not\s+available/i.test(value)) {
      return trimValue(value.replace(/\b(producing|at|on)\b.*$/i, ""));
    }
  }
  return undefined;
}

function extractYears(text, pattern) {
  const match = String(text).match(pattern);
  const parsed = Number(match?.find((item, index) => index > 0 && /^\d+(?:\.\d+)?$/.test(item)));
  return Number.isFinite(parsed) && parsed > 0 && parsed < 250 ? parsed : undefined;
}

function extractEpc(text) {
  const value = clean(text.match(/\bEPC(?:\s+rating)?\s*[:\-]?\s*([A-G][+-]?)(?:\b|$)/i)?.[1] ?? "");
  return value ? value.toUpperCase() : undefined;
}

function extractVat(text) {
  const match = text.match(/\bVAT\b[^.\n\r]{0,140}/i)?.[0];
  return match ? trimValue(clean(match)) : undefined;
}

function extractAuctionInfo(text) {
  const lotNumber = clean(text.match(/\bLot\s*(?:number|no\.?)?\s*[:\-]?\s*([A-Z0-9-]{1,20})/i)?.[1] ?? "");
  const auctionDate = clean(text.match(/\b(?:auction\s+date|auction)\s*[:\-]?\s*([0-3]?\d\s+[A-Z][a-z]+\s+\d{4})/i)?.[1] ?? "");
  return Object.fromEntries(Object.entries({ lotNumber, auctionDate }).filter(([, value]) => value));
}

function pickInvestmentSummary(paragraphs) {
  const summary = paragraphs.find((item) => (
    item.length >= 80 &&
    /\b(investment|let|leased|income|yield|tenant|freehold|auction|opportunity)\b/i.test(item)
  ));
  return summary ? trimValue(summary, MAX_SUMMARY_LENGTH) : undefined;
}

function findContext(text, pattern) {
  const match = pattern.exec(text);
  if (!match) return "";
  return text.slice(Math.max(0, match.index - 20), Math.min(text.length, match.index + 180));
}

function hasUsefulEnrichment(enrichment) {
  return enrichedFieldNames(enrichment).length > 0;
}

function enrichedFieldNames(enrichment) {
  return [
    ["tenantName", enrichment.tenantName],
    ["passingRent", enrichment.passingRent],
    ["leaseLength", enrichment.leaseLength],
    ["wault", enrichment.wault],
    ["epcRating", enrichment.epcRating],
    ["sqft", enrichment.sqft],
    ["guidePrice", enrichment.guidePrice],
    ["auctionInfo", Object.keys(enrichment.auctionInfo ?? {}).length ? enrichment.auctionInfo : null],
    ["vatInfo", enrichment.vatInfo],
    ["investmentSummary", enrichment.investmentSummary],
  ].filter(([, value]) => value !== undefined && value !== null && value !== "").map(([key]) => key);
}

function trimValue(value, max = 120) {
  return clean(value).replace(/\s+\|\s+.*$/, "").slice(0, max).trim();
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function isBlockedHtml(html) {
  return /<title>\s*Just a moment|cf-browser-verification|challenge-platform|Access Denied|cf-chl-/i.test(String(html ?? ""));
}

function errorMessage(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}
