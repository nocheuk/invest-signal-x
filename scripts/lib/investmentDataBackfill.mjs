import { mapImportToDealInsert } from "./dealImportCore.mjs";
import { extractDealEnrichment, fetchDetailHtml } from "./dealEnrichment.mjs";
import { extractInvestmentFacts } from "./investmentDataExtraction.mjs";

const DEFAULT_LIMIT = 100;

export async function runInvestmentDataBackfill({
  supabase,
  dealId,
  sourceUrl,
  limit = DEFAULT_LIMIT,
  dryRun = false,
  fetchImpl = fetch,
  now = new Date(),
} = {}) {
  if (!supabase) throw new Error("Supabase service client is required.");
  const candidates = await loadBackfillCandidates({ supabase, dealId, sourceUrl, limit });
  const results = [];

  for (const candidate of candidates) {
    const result = await backfillCandidate({ supabase, candidate, dryRun, fetchImpl, now });
    results.push(result);
  }

  return {
    dryRun,
    total: candidates.length,
    updated: results.filter((result) => result.status === "updated").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    failed: results.filter((result) => result.status === "failed").length,
    results,
  };
}

export async function backfillCandidate({ supabase, candidate, dryRun = false, fetchImpl = fetch, now = new Date() }) {
  const before = snapshotDeal(candidate.deal);
  const rawFacts = extractFactsFromCandidate(candidate, now);
  const detail = await loadDetailEnrichment(candidate, fetchImpl);
  const facts = mergeFacts(rawFacts, detail.enrichment?.extractedPayload, detail.enrichment);

  if (!hasRepairFacts(facts)) {
    return {
      status: "skipped",
      dealId: candidate.deal.id,
      sourceUrl: candidate.sourceUrl,
      reason: detail.error ? `No extractable investment facts; detail fetch failed: ${detail.error}` : "No extractable investment facts found.",
      before,
      extracted: facts,
    };
  }

  const repair = buildInvestmentDataRepair({ candidate, facts, detailEnrichment: detail.enrichment, now });
  if (dryRun) {
    return {
      status: "updated",
      dryRun: true,
      dealId: candidate.deal.id,
      sourceUrl: candidate.sourceUrl,
      before,
      after: snapshotUpdate(repair.dealUpdate),
      extracted: facts,
      detailError: detail.error,
    };
  }

  if (candidate.rawImport?.id) {
    const { error: rawError } = await supabase
      .from("raw_imports")
      .update({ normalized_payload: repair.normalizedPayload })
      .eq("id", candidate.rawImport.id);
    if (rawError) throw rawError;
  }

  const { error: enrichmentError } = await supabase
    .from("deal_enrichments")
    .upsert(repair.enrichmentUpsert, { onConflict: "deal_id" });
  if (enrichmentError) throw enrichmentError;

  const { error: dealError } = await supabase
    .from("deals")
    .update(repair.dealUpdate)
    .eq("id", candidate.deal.id);
  if (dealError) throw dealError;

  return {
    status: "updated",
    dealId: candidate.deal.id,
    sourceUrl: candidate.sourceUrl,
    before,
    after: snapshotUpdate(repair.dealUpdate),
    extracted: facts,
    detailError: detail.error,
  };
}

export function buildInvestmentDataRepair({ candidate, facts, detailEnrichment = null, now = new Date() }) {
  const deal = candidate.deal;
  const raw = candidate.rawImport;
  const existingNormalized = objectRecord(raw?.normalized_payload);
  const sourceName = candidate.sourceName || existingNormalized.sourceName || "Investment data backfill";
  const currentPassingRent = choosePassingRent({ facts, deal, existingNormalized });
  const covenantStrength = facts.covenantStrength || deal.covenant_strength || existingNormalized.covenantStrength || "Moderate";
  const tenantHealthScore = covenantStrength === "Strong" ? 90 : covenantStrength === "Good" ? 76 : Number(deal.tenant_health_score ?? 0) || undefined;
  const rentReview = Array.isArray(facts.rentReviews) && facts.rentReviews.length > 0 ? "Fixed uplift" : deal.rent_review || "None";
  const leaseLength = facts.leaseLength ?? positiveNumber(deal.lease_length) ?? positiveNumber(existingNormalized.leaseLength);
  const wault = facts.wault ?? positiveNumber(deal.wault) ?? leaseLength;
  const tenant = facts.tenantName || knownValue(deal.tenant) || knownValue(existingNormalized.tenant) || "Unknown";

  const normalized = {
    externalId: existingNormalized.externalId || raw?.external_id || deal.id,
    sourceUrl: candidate.sourceUrl || existingNormalized.sourceUrl,
    imageUrl: existingNormalized.imageUrl || deal.thumbnail,
    title: existingNormalized.title || deal.title,
    location: existingNormalized.location || deal.location,
    postcode: existingNormalized.postcode || deal.postcode,
    region: existingNormalized.region || deal.region || "All UK",
    assetType: existingNormalized.assetType || deal.asset_type || "Retail",
    source: existingNormalized.source || deal.source || "Private treaty",
    guidePrice: positiveNumber(existingNormalized.guidePrice) ?? positiveNumber(deal.guide_price) ?? detailEnrichment?.guidePrice ?? 0,
    passingRent: currentPassingRent,
    sqft: positiveNumber(existingNormalized.sqft) ?? positiveNumber(deal.sqft) ?? detailEnrichment?.sqft ?? 0,
    grossYield: undefined,
    netInitialYield: undefined,
    reversionaryYield: positiveNumber(deal.reversionary_yield),
    wault,
    leaseLength,
    tenant,
    covenantStrength,
    tenantHealthScore,
    rentSustainability: deal.rent_sustainability || "Market rent",
    rentReview,
    pricePerSqft: positiveNumber(existingNormalized.pricePerSqft) ?? positiveNumber(deal.price_per_sqft),
    planningUpsideScore: positiveNumber(deal.planning_upside_score),
    voidRiskScore: positiveNumber(deal.void_risk_score),
    exitYieldSensitivity: deal.exit_yield_sensitivity || "Moderate",
    auctionGuideRisk: deal.auction_guide_risk ?? undefined,
    redFlags: mergeBackfillFlags(deal.red_flags, facts),
    mainRiskFlag: "Investment data extracted from source text; verify source documents before offer",
    description: detailEnrichment?.investmentSummary || existingNormalized.description,
    postedAt: deal.posted_at,
  };

  const rescored = mapImportToDealInsert(normalized, sourceName);
  const normalizedPayload = {
    ...existingNormalized,
    tenant,
    passingRent: currentPassingRent,
    leaseLength: leaseLength ?? null,
    wault: wault ?? null,
    covenantStrength,
    tenantHealthScore: tenantHealthScore ?? existingNormalized.tenantHealthScore,
    rentReview,
    grossYield: rescored.gross_yield,
    netInitialYield: rescored.net_initial_yield,
    redFlags: normalized.redFlags,
    extractedInvestmentData: facts,
  };
  const extractedPayload = {
    ...(objectRecord(detailEnrichment?.extractedPayload)),
    ...facts,
    backfilledAt: now.toISOString(),
  };

  return {
    normalizedPayload,
    enrichmentUpsert: {
      deal_id: deal.id,
      source_url: candidate.sourceUrl,
      status: "enriched",
      attempt_count: Number(candidate.existingEnrichment?.attempt_count ?? 0) + 1,
      last_attempted_at: now.toISOString(),
      next_attempt_at: now.toISOString(),
      last_error: null,
      tenant_name: tenant !== "Unknown" ? tenant : null,
      passing_rent: currentPassingRent || null,
      lease_length: leaseLength ?? null,
      wault: wault ?? null,
      epc_rating: detailEnrichment?.epcRating ?? candidate.existingEnrichment?.epc_rating ?? null,
      sqft: normalized.sqft || null,
      guide_price: normalized.guidePrice || null,
      auction_info: detailEnrichment?.auctionInfo ?? candidate.existingEnrichment?.auction_info ?? {},
      vat_info: detailEnrichment?.vatInfo ?? candidate.existingEnrichment?.vat_info ?? null,
      investment_summary: detailEnrichment?.investmentSummary ?? candidate.existingEnrichment?.investment_summary ?? null,
      extracted_payload: extractedPayload,
    },
    dealUpdate: {
      passing_rent: rescored.passing_rent,
      gross_yield: rescored.gross_yield,
      net_initial_yield: rescored.net_initial_yield,
      reversionary_yield: rescored.reversionary_yield,
      wault: rescored.wault,
      lease_length: rescored.lease_length,
      tenant: rescored.tenant,
      covenant_strength: covenantStrength,
      tenant_health_score: rescored.tenant_health_score,
      rent_review: rentReview,
      score: rescored.score,
      rating: rescored.rating,
      score_breakdown: rescored.score_breakdown,
      insights: rescored.insights,
      red_flags: normalized.redFlags,
      main_risk_flag: rescored.main_risk_flag,
      updated_at: now.toISOString(),
    },
  };
}

async function loadBackfillCandidates({ supabase, dealId, sourceUrl, limit }) {
  let query = supabase
    .from("deal_source_links")
    .select("*, import_sources(*), raw_imports(*), deals(*)")
    .order("created_at", { ascending: false });

  if (dealId) query = query.eq("deal_id", dealId);
  if (sourceUrl) query = query.eq("source_url", sourceUrl);
  if (!dealId && !sourceUrl) query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw error;
  const dealIds = (data ?? []).map((link) => link.deal_id).filter(Boolean);
  const enrichments = await loadExistingEnrichments({ supabase, dealIds });

  return (data ?? [])
    .map((link) => {
      const deal = firstRow(link.deals);
      const rawImport = firstRow(link.raw_imports);
      if (!deal || !link.source_url) return null;
      return {
        link,
        deal,
        rawImport,
        existingEnrichment: enrichments.get(deal.id) ?? null,
        sourceUrl: link.source_url,
        sourceName: firstRow(link.import_sources)?.name ?? "",
      };
    })
    .filter(Boolean)
    .filter((candidate) => dealId || sourceUrl || shouldBackfill(candidate))
    .slice(0, limit);
}

async function loadExistingEnrichments({ supabase, dealIds }) {
  const uniqueIds = [...new Set(dealIds)];
  if (uniqueIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("deal_enrichments")
    .select("*")
    .in("deal_id", uniqueIds);
  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.deal_id, row]));
}

function extractFactsFromCandidate(candidate, now) {
  const raw = candidate.rawImport;
  return extractInvestmentFacts({
    title: candidate.deal.title,
    description: [
      candidate.deal.main_risk_flag,
      objectRecord(raw?.normalized_payload).description,
      JSON.stringify(raw?.normalized_payload ?? {}),
    ].filter(Boolean).join(" "),
    payload: raw?.payload ?? {},
    now,
  });
}

async function loadDetailEnrichment(candidate, fetchImpl) {
  try {
    const html = await fetchDetailHtml(candidate.sourceUrl, { fetchImpl });
    return {
      enrichment: extractDealEnrichment({
        html,
        sourceUrl: candidate.sourceUrl,
        sourceName: candidate.sourceName,
      }),
      error: null,
    };
  } catch (error) {
    return { enrichment: null, error: error instanceof Error ? error.message : String(error) };
  }
}

function mergeFacts(rawFacts, extractedPayload, detailEnrichment) {
  const payload = objectRecord(extractedPayload);
  const detailReviews = Array.isArray(payload.rentReviews) ? payload.rentReviews : [];
  const rawReviews = Array.isArray(rawFacts.rentReviews) ? rawFacts.rentReviews : [];
  const rentReviews = detailReviews.length > 0 ? detailReviews : rawReviews;
  return {
    tenantName: detailEnrichment?.tenantName || rawFacts.tenantName,
    passingRent: detailEnrichment?.passingRent || rawFacts.passingRent,
    leaseExpiryText: payload.leaseExpiryText || rawFacts.leaseExpiryText,
    leaseExpiryDate: payload.leaseExpiryDate || rawFacts.leaseExpiryDate,
    leaseLength: detailEnrichment?.leaseLength || rawFacts.leaseLength,
    wault: detailEnrichment?.wault || rawFacts.wault,
    rentReviewDates: payload.rentReviewDates || rawFacts.rentReviewDates || rentReviews.map((review) => review.year),
    rentReviewAmounts: payload.rentReviewAmounts || rawFacts.rentReviewAmounts || rentReviews.map((review) => review.amount),
    rentReviews,
    covenantStrength: payload.covenantStrength || rawFacts.covenantStrength,
    covenantVerified: payload.covenantVerified ?? rawFacts.covenantVerified,
  };
}

function choosePassingRent({ facts, deal, existingNormalized }) {
  if (positiveNumber(facts.passingRent)) return positiveNumber(facts.passingRent);
  const current = positiveNumber(deal.passing_rent) ?? positiveNumber(existingNormalized.passingRent);
  const reviewAmounts = new Set((facts.rentReviewAmounts ?? []).filter(Boolean).map(Number));
  if (current && !reviewAmounts.has(current)) return current;
  return 0;
}

function shouldBackfill(candidate) {
  const deal = candidate.deal;
  const facts = extractFactsFromCandidate(candidate, new Date());
  const missingTenant = !knownValue(deal.tenant) && facts.tenantName;
  const missingLease = !positiveNumber(deal.lease_length) && !positiveNumber(deal.wault) && (facts.leaseLength || facts.leaseExpiryText);
  const reviewRentStoredAsPassing = positiveNumber(deal.passing_rent) && (facts.rentReviewAmounts ?? []).map(Number).includes(Number(deal.passing_rent));
  return Boolean(missingTenant || missingLease || reviewRentStoredAsPassing);
}

function hasRepairFacts(facts) {
  return Boolean(facts.tenantName || facts.passingRent || facts.leaseLength || facts.leaseExpiryText || (facts.rentReviews ?? []).length > 0);
}

function mergeBackfillFlags(existing, facts) {
  const flags = Array.isArray(existing) ? existing.filter((flag) => !/tenant covenant unknown|lease information missing|tenant unknown/i.test(String(flag))) : [];
  if (facts.leaseExpiryText) flags.push(`Lease expiry extracted: ${facts.leaseExpiryText}`);
  if (Array.isArray(facts.rentReviews) && facts.rentReviews.length > 0) {
    flags.push(`Rent reviews extracted: ${facts.rentReviews.map((review) => review.amount ? `${review.year}: GBP ${Number(review.amount).toLocaleString()} pa` : review.year).join("; ")}`);
  }
  if (facts.tenantName && !facts.covenantVerified) flags.push("Tenant covenant not independently verified");
  return [...new Set(flags)];
}

function snapshotDeal(deal) {
  return {
    id: deal.id,
    tenant: deal.tenant,
    passing_rent: deal.passing_rent,
    lease_length: deal.lease_length,
    wault: deal.wault,
    covenant_strength: deal.covenant_strength,
    rent_review: deal.rent_review,
    gross_yield: deal.gross_yield,
    net_initial_yield: deal.net_initial_yield,
    score: deal.score,
    red_flags: deal.red_flags,
  };
}

function snapshotUpdate(update) {
  return {
    tenant: update.tenant,
    passing_rent: update.passing_rent,
    lease_length: update.lease_length,
    wault: update.wault,
    covenant_strength: update.covenant_strength,
    rent_review: update.rent_review,
    gross_yield: update.gross_yield,
    net_initial_yield: update.net_initial_yield,
    score: update.score,
    red_flags: update.red_flags,
  };
}

function objectRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function firstRow(value) {
  return Array.isArray(value) ? value[0] : value;
}

function positiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function knownValue(value) {
  return typeof value === "string" && value.trim() && !/^unknown$/i.test(value.trim()) ? value.trim() : undefined;
}
