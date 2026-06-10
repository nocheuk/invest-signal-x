import type { Deal } from "@/lib/deals";
import { classifyDeal, type DealClassification } from "@/lib/dealClassification";
import { normalizeSourceLabel } from "@/lib/dashboardFilters";
import { scoreImportedDeal } from "@/lib/scoring";

export type EnrichmentImpactRow = {
  deal: Deal;
  sourceName: string;
  normalizedPayload?: Record<string, unknown> | null;
  enrichment: {
    status: string;
    tenantName?: string | null;
    passingRent?: number | null;
    leaseLength?: number | null;
    wault?: number | null;
    epcRating?: string | null;
    sqft?: number | null;
    guidePrice?: number | null;
    auctionInfo?: Record<string, unknown> | null;
    vatInfo?: string | null;
    investmentSummary?: string | null;
  };
};

export type EnrichmentImpactReport = {
  totalEnriched: number;
  tenantFound: number;
  rentFound: number;
  leaseFound: number;
  waultFound: number;
  epcFound: number;
  areaFound: number;
  dealsImproved: number;
  classificationUplift: number;
  beforeCounts: Record<DealClassification, number>;
  afterCounts: Record<DealClassification, number>;
  movementMatrix: Record<DealClassification, Record<DealClassification, number>>;
  sourceImpact: Array<{
    source: string;
    total: number;
    enriched: number;
    successRate: number;
    fieldsExtracted: {
      tenant: number;
      rent: number;
      lease: number;
      wault: number;
      epc: number;
      area: number;
    };
    classificationUplift: number;
    dealsImproved: number;
  }>;
};

const EMPTY_COUNTS: Record<DealClassification, number> = {
  "verified-green": 0,
  "green-candidate": 0,
  "requires-due-diligence": 0,
  "low-priority": 0,
};

const CLASSIFICATION_RANK: Record<DealClassification, number> = {
  "low-priority": 0,
  "requires-due-diligence": 1,
  "green-candidate": 2,
  "verified-green": 3,
};

export function buildEnrichmentImpactReport(rows: EnrichmentImpactRow[]): EnrichmentImpactReport {
  const enrichedRows = rows.filter((row) => row.enrichment.status === "enriched");
  const beforeCounts = emptyCounts();
  const afterCounts = emptyCounts();
  const movementMatrix = emptyMatrix();
  const sourceMap = new Map<string, ReturnType<typeof createSourceBucket>>();
  let dealsImproved = 0;
  let classificationUplift = 0;

  for (const row of rows) {
    const source = normalizeSourceLabel(row.sourceName || row.deal.importSourceName || "Imported");
    const bucket = sourceMap.get(source) ?? createSourceBucket(source);
    sourceMap.set(source, bucket);
    bucket.total += 1;

    if (row.enrichment.status !== "enriched") continue;
    bucket.enriched += 1;
    addFieldCounts(bucket.fieldsExtracted, row.enrichment);

    const beforeDeal = buildBeforeEnrichmentDeal(row);
    const before = classifyDeal(beforeDeal);
    const after = classifyDeal(row.deal);
    beforeCounts[before] += 1;
    afterCounts[after] += 1;
    movementMatrix[before][after] += 1;

    if (row.deal.score > beforeDeal.score || CLASSIFICATION_RANK[after] > CLASSIFICATION_RANK[before]) {
      dealsImproved += 1;
      bucket.dealsImproved += 1;
    }
    if (CLASSIFICATION_RANK[after] > CLASSIFICATION_RANK[before]) {
      classificationUplift += 1;
      bucket.classificationUplift += 1;
    }
  }

  return {
    totalEnriched: enrichedRows.length,
    tenantFound: countFound(enrichedRows, (row) => row.enrichment.tenantName),
    rentFound: countFound(enrichedRows, (row) => positive(row.enrichment.passingRent)),
    leaseFound: countFound(enrichedRows, (row) => positive(row.enrichment.leaseLength)),
    waultFound: countFound(enrichedRows, (row) => positive(row.enrichment.wault)),
    epcFound: countFound(enrichedRows, (row) => row.enrichment.epcRating),
    areaFound: countFound(enrichedRows, (row) => positive(row.enrichment.sqft)),
    dealsImproved,
    classificationUplift,
    beforeCounts,
    afterCounts,
    movementMatrix,
    sourceImpact: [...sourceMap.values()].map((bucket) => ({
      ...bucket,
      successRate: bucket.total > 0 ? Math.round((bucket.enriched / bucket.total) * 1000) / 10 : 0,
    })).sort((a, b) => b.classificationUplift - a.classificationUplift || b.enriched - a.enriched),
  };
}

export function buildBeforeEnrichmentDeal(row: EnrichmentImpactRow): Deal {
  const raw = row.normalizedPayload ?? {};
  const beforeInput = {
    title: stringValue(raw.title) || row.deal.title,
    location: stringValue(raw.location) || row.deal.location,
    assetType: (stringValue(raw.assetType) || stringValue(raw.asset_type) || row.deal.assetType) as Deal["assetType"],
    source: (stringValue(raw.source) || row.deal.source) as Deal["source"],
    sourceUrl: stringValue(raw.sourceUrl) || stringValue(raw.source_url) || row.deal.sourceUrl,
    importSourceName: row.sourceName || row.deal.importSourceName,
    importSourceType: row.deal.importSourceType,
    guidePrice: numberValue(raw.guidePrice ?? raw.guide_price),
    passingRent: numberValue(raw.passingRent ?? raw.passing_rent),
    sqft: numberValue(raw.sqft),
    grossYield: numberValue(raw.grossYield ?? raw.gross_yield),
    netInitialYield: numberValue(raw.netInitialYield ?? raw.net_initial_yield),
    reversionaryYield: numberValue(raw.reversionaryYield ?? raw.reversionary_yield),
    tenant: stringValue(raw.tenant) || "Unknown",
    wault: numberValue(raw.wault),
    leaseLength: numberValue(raw.leaseLength ?? raw.lease_length),
    pricePerSqft: numberValue(raw.pricePerSqft ?? raw.price_per_sqft),
    planningUpsideScore: numberValue(raw.planningUpsideScore ?? raw.planning_upside_score),
    voidRiskScore: numberValue(raw.voidRiskScore ?? raw.void_risk_score),
    exitYieldSensitivity: (stringValue(raw.exitYieldSensitivity) || stringValue(raw.exit_yield_sensitivity) || row.deal.exitYieldSensitivity) as Deal["exitYieldSensitivity"],
    postedAt: stringValue(raw.postedAt) || stringValue(raw.posted_at) || row.deal.postedAt,
    descriptionText: stringValue(raw.description) || stringValue(raw.summary),
  };
  const scored = scoreImportedDeal(beforeInput);
  return {
    ...row.deal,
    title: beforeInput.title,
    location: beforeInput.location,
    assetType: beforeInput.assetType,
    source: beforeInput.source,
    sourceUrl: beforeInput.sourceUrl,
    guidePrice: beforeInput.guidePrice,
    passingRent: beforeInput.passingRent,
    sqft: beforeInput.sqft,
    grossYield: scored.grossYield,
    netInitialYield: scored.netInitialYield,
    reversionaryYield: beforeInput.reversionaryYield,
    tenant: beforeInput.tenant,
    wault: beforeInput.wault,
    leaseLength: beforeInput.leaseLength,
    pricePerSqft: scored.pricePerSqft,
    score: scored.dealSignalScore,
    rating: scored.rating,
    dataConfidenceScore: scored.dataConfidenceScore,
    confidenceLevel: scored.confidenceLevel,
    scoreReasons: scored.reasons,
    scoreBreakdown: scored.scoreBreakdown,
    mainRiskFlag: scored.mainRiskFlag,
    needsReview: scored.needsReview,
  };
}

function createSourceBucket(source: string) {
  return {
    source,
    total: 0,
    enriched: 0,
    fieldsExtracted: {
      tenant: 0,
      rent: 0,
      lease: 0,
      wault: 0,
      epc: 0,
      area: 0,
    },
    classificationUplift: 0,
    dealsImproved: 0,
  };
}

function addFieldCounts(fields: ReturnType<typeof createSourceBucket>["fieldsExtracted"], enrichment: EnrichmentImpactRow["enrichment"]) {
  if (enrichment.tenantName) fields.tenant += 1;
  if (positive(enrichment.passingRent)) fields.rent += 1;
  if (positive(enrichment.leaseLength)) fields.lease += 1;
  if (positive(enrichment.wault)) fields.wault += 1;
  if (enrichment.epcRating) fields.epc += 1;
  if (positive(enrichment.sqft)) fields.area += 1;
}

function emptyCounts() {
  return { ...EMPTY_COUNTS };
}

function emptyMatrix() {
  return Object.fromEntries(Object.keys(EMPTY_COUNTS).map((from) => [from, emptyCounts()])) as Record<DealClassification, Record<DealClassification, number>>;
}

function countFound(rows: EnrichmentImpactRow[], predicate: (row: EnrichmentImpactRow) => unknown) {
  return rows.filter((row) => Boolean(predicate(row))).length;
}

function positive(value: unknown) {
  return Number(value) > 0;
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}
