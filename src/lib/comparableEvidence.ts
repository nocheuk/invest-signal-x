import type { Deal } from "@/lib/deals";
import { formatGBP, formatPct } from "@/lib/deals";

export type ComparableGroup =
  | "city-asset"
  | "postcode-asset"
  | "city"
  | "postcode"
  | "region-asset"
  | "region";

export type ComparableEvidence = {
  group: ComparableGroup | null;
  area: string | null;
  assetType?: string;
  sampleSize: number;
  rawSampleSize: number;
  cleanedSampleSize: number;
  excludedSampleSize: number;
  yieldSampleSize: number;
  pricePerSqftSampleSize: number;
  dealYield: number | null;
  averageYield: number | null;
  medianYield: number | null;
  yieldDifferencePercent: number | null;
  yieldPercentileRank: number | null;
  dealPricePerSqft: number | null;
  averagePricePerSqft: number | null;
  medianPricePerSqft: number | null;
  pricePerSqftDifferencePercent: number | null;
  pricePerSqftPercentileRank: number | null;
  isLimited: boolean;
  statements: string[];
  shortEvidenceLine: string;
};

export type ComparableMetricAudit = {
  count: number;
  min: number | null;
  max: number | null;
  median: number | null;
  p95: number | null;
};

export type ComparableOutlierAudit = {
  yieldGreaterThan25: number;
  yieldBelow1: number;
  pricePerSqftGreaterThan2000: number;
  pricePerSqftBelow10: number;
};

export type ComparableDatasetAudit = {
  totalDeals: number;
  importedDeals: number;
  yieldStats: ComparableMetricAudit;
  pricePerSqftStats: ComparableMetricAudit;
  outlierCounts: ComparableOutlierAudit;
  outliersBySource: Record<keyof ComparableOutlierAudit, Record<string, number>>;
};

type PeerGroup = {
  group: ComparableGroup;
  area: string;
  assetType?: string;
  peers: Deal[];
};

const MIN_STRONG_SAMPLE = 5;
const MIN_USABLE_SAMPLE = 3;
const MIN_VALID_YIELD = 1;
const MAX_VALID_YIELD = 25;
const MIN_VALID_PRICE_PER_SQFT = 10;
const MAX_VALID_PRICE_PER_SQFT = 2000;

export function buildComparableEvidence(deal: Deal, deals: Deal[]): ComparableEvidence {
  const peers = deals.filter((peer) => isImportedDeal(peer) && peer.id !== deal.id);
  const group = chooseComparableGroup(deal, peers);
  if (!group) return emptyEvidence(deal);
  const evidence = evidenceFromGroup(deal, group);
  return { ...evidence, statements: evidenceStatements(evidence), shortEvidenceLine: shortEvidenceLine(evidence) };
}

export function comparableEvidenceStatements(evidence: ComparableEvidence) {
  return evidence.statements;
}

export function comparableEvidenceSummary(evidence: ComparableEvidence) {
  if (evidence.rawSampleSize === 0) return "Comparable evidence is not available from imported DealSignal data yet.";
  if (evidence.isLimited) return "Comparable evidence limited. The usable peer set is too small after excluding outliers and low-confidence records.";
  return evidence.statements[0] ?? "Comparable evidence is limited and should be verified manually.";
}

export function auditComparableDataset(deals: Deal[]): ComparableDatasetAudit {
  const importedDeals = deals.filter(isImportedDeal);
  const yieldValues = importedDeals.map(getYield).filter(isNumber);
  const priceValues = importedDeals.map(getPricePerSqft).filter(isNumber);
  const outlierCounts: ComparableOutlierAudit = {
    yieldGreaterThan25: 0,
    yieldBelow1: 0,
    pricePerSqftGreaterThan2000: 0,
    pricePerSqftBelow10: 0,
  };
  const outliersBySource: ComparableDatasetAudit["outliersBySource"] = {
    yieldGreaterThan25: {},
    yieldBelow1: {},
    pricePerSqftGreaterThan2000: {},
    pricePerSqftBelow10: {},
  };

  importedDeals.forEach((deal) => {
    const source = comparableSourceLabel(deal);
    const yieldValue = getYield(deal);
    const priceValue = getPricePerSqft(deal);
    if (yieldValue !== null && yieldValue > MAX_VALID_YIELD) incrementOutlier("yieldGreaterThan25", source);
    if (yieldValue !== null && yieldValue < MIN_VALID_YIELD) incrementOutlier("yieldBelow1", source);
    if (priceValue !== null && priceValue > MAX_VALID_PRICE_PER_SQFT) incrementOutlier("pricePerSqftGreaterThan2000", source);
    if (priceValue !== null && priceValue < MIN_VALID_PRICE_PER_SQFT) incrementOutlier("pricePerSqftBelow10", source);
  });

  return {
    totalDeals: deals.length,
    importedDeals: importedDeals.length,
    yieldStats: metricAudit(yieldValues),
    pricePerSqftStats: metricAudit(priceValues),
    outlierCounts,
    outliersBySource,
  };

  function incrementOutlier(kind: keyof ComparableOutlierAudit, source: string) {
    outlierCounts[kind] += 1;
    outliersBySource[kind][source] = (outliersBySource[kind][source] ?? 0) + 1;
  }
}

function chooseComparableGroup(deal: Deal, peers: Deal[]) {
  const candidates: PeerGroup[] = [
    groupFor(deal, peers, "city-asset"),
    groupFor(deal, peers, "postcode-asset"),
    groupFor(deal, peers, "city"),
    groupFor(deal, peers, "postcode"),
    groupFor(deal, peers, "region-asset"),
    groupFor(deal, peers, "region"),
  ].filter(Boolean) as PeerGroup[];
  return candidates.find((candidate) => candidate.peers.filter(isValidComparablePeer).length >= MIN_STRONG_SAMPLE)
    ?? candidates.find((candidate) => candidate.peers.length >= MIN_USABLE_SAMPLE)
    ?? candidates.find((candidate) => candidate.peers.length > 0)
    ?? null;
}

function groupFor(deal: Deal, peers: Deal[], group: ComparableGroup): PeerGroup | null {
  const city = cityKey(deal);
  const postcode = postcodeAreaKey(deal);
  const region = areaKey(deal.region);
  const assetType = deal.assetType;
  const matching = peers.filter((peer) => {
    if (group === "city-asset") return city && cityKey(peer) === city && peer.assetType === assetType;
    if (group === "postcode-asset") return postcode && postcodeAreaKey(peer) === postcode && peer.assetType === assetType;
    if (group === "city") return city && cityKey(peer) === city;
    if (group === "postcode") return postcode && postcodeAreaKey(peer) === postcode;
    if (group === "region-asset") return region && areaKey(peer.region) === region && peer.assetType === assetType;
    return region && areaKey(peer.region) === region;
  });
  const area = group.includes("postcode") ? postcode : group.includes("city") ? city : region;
  if (!area || matching.length === 0) return null;
  return { group, area, assetType: group.includes("asset") ? assetType : undefined, peers: matching };
}

function evidenceFromGroup(deal: Deal, group: PeerGroup): ComparableEvidence {
  const dealYield = getYield(deal);
  const dealPricePerSqft = getPricePerSqft(deal);
  const cleanedPeers = group.peers.filter(isValidComparablePeer);
  const yields = cleanedPeers.map(getYield).filter(isNumber);
  const prices = cleanedPeers.map(getPricePerSqft).filter(isNumber);
  const hasUsableSample = cleanedPeers.length >= MIN_STRONG_SAMPLE;
  const averageYield = hasUsableSample ? average(yields) : null;
  const averagePrice = hasUsableSample ? average(prices) : null;
  const evidence: ComparableEvidence = {
    group: group.group,
    area: group.area,
    assetType: group.assetType,
    sampleSize: cleanedPeers.length,
    rawSampleSize: group.peers.length,
    cleanedSampleSize: cleanedPeers.length,
    excludedSampleSize: Math.max(0, group.peers.length - cleanedPeers.length),
    yieldSampleSize: hasUsableSample ? yields.length : 0,
    pricePerSqftSampleSize: hasUsableSample ? prices.length : 0,
    dealYield,
    averageYield,
    medianYield: hasUsableSample ? median(yields) : null,
    yieldDifferencePercent: percentageDelta(dealYield, averageYield),
    yieldPercentileRank: hasUsableSample ? percentileRank(dealYield, yields, "higher") : null,
    dealPricePerSqft,
    averagePricePerSqft: averagePrice,
    medianPricePerSqft: hasUsableSample ? median(prices) : null,
    pricePerSqftDifferencePercent: percentageDelta(dealPricePerSqft, averagePrice),
    pricePerSqftPercentileRank: hasUsableSample ? percentileRank(dealPricePerSqft, prices, "lower") : null,
    isLimited: !hasUsableSample,
    statements: [],
    shortEvidenceLine: "",
  };
  return evidence;
}

function evidenceStatements(evidence: ComparableEvidence) {
  const statements: string[] = [];
  if (evidence.isLimited) {
    if (evidence.rawSampleSize > 0) {
      return [`Comparable evidence limited: ${evidence.cleanedSampleSize} usable comps from ${evidence.rawSampleSize} raw local peers after excluding outliers, incomplete records and low-confidence data.`];
    }
    return ["Comparable evidence is not available from imported DealSignal data yet."];
  }
  if (evidence.yieldDifferencePercent !== null && evidence.yieldSampleSize >= MIN_USABLE_SAMPLE) {
    if (evidence.yieldDifferencePercent >= 10) {
      statements.push(`Yield is ${Math.round(evidence.yieldDifferencePercent)}% above the local average based on ${evidence.yieldSampleSize} comparable imported opportunities.`);
    } else if (evidence.yieldDifferencePercent <= -10) {
      statements.push(`Yield is ${Math.abs(Math.round(evidence.yieldDifferencePercent))}% below the local average based on ${evidence.yieldSampleSize} comparable imported opportunities.`);
    } else {
      statements.push(`Yield is broadly in line with the local average based on ${evidence.yieldSampleSize} comparable imported opportunities.`);
    }
  }
  if (evidence.pricePerSqftDifferencePercent !== null && evidence.pricePerSqftSampleSize >= MIN_USABLE_SAMPLE) {
    if (evidence.pricePerSqftDifferencePercent <= -10) {
      statements.push(`Price per sqft is ${Math.abs(Math.round(evidence.pricePerSqftDifferencePercent))}% below the local average based on ${evidence.pricePerSqftSampleSize} comparable properties.`);
    } else if (evidence.pricePerSqftDifferencePercent >= 10) {
      statements.push(`Price per sqft is ${Math.round(evidence.pricePerSqftDifferencePercent)}% above the local average based on ${evidence.pricePerSqftSampleSize} comparable properties.`);
    } else {
      statements.push(`Price per sqft is broadly in line with the local average based on ${evidence.pricePerSqftSampleSize} comparable properties.`);
    }
  }
  return statements.length ? statements : ["Comparable evidence is not available from imported DealSignal data yet."];
}

function shortEvidenceLine(evidence: ComparableEvidence) {
  if (evidence.isLimited) return "Limited local comps";
  if (evidence.yieldDifferencePercent !== null && evidence.yieldSampleSize >= MIN_USABLE_SAMPLE && evidence.yieldDifferencePercent >= 10) {
    return `+${Math.round(evidence.yieldDifferencePercent)}% vs area yield`;
  }
  if (evidence.pricePerSqftDifferencePercent !== null && evidence.pricePerSqftSampleSize >= MIN_USABLE_SAMPLE && evidence.pricePerSqftDifferencePercent <= -10) {
    return `${Math.abs(Math.round(evidence.pricePerSqftDifferencePercent))}% below area GBP/sqft`;
  }
  return evidence.sampleSize > 0 ? `${evidence.sampleSize} local comps` : "No local comps yet";
}

function emptyEvidence(deal: Deal): ComparableEvidence {
  const dealYield = positiveNumber(deal.netInitialYield || deal.grossYield);
  const dealPricePerSqft = positiveNumber(deal.pricePerSqft || (deal.guidePrice > 0 && deal.sqft > 0 ? deal.guidePrice / deal.sqft : 0));
  return {
    group: null,
    area: null,
    sampleSize: 0,
    rawSampleSize: 0,
    cleanedSampleSize: 0,
    excludedSampleSize: 0,
    yieldSampleSize: 0,
    pricePerSqftSampleSize: 0,
    dealYield,
    averageYield: null,
    medianYield: null,
    yieldDifferencePercent: null,
    yieldPercentileRank: null,
    dealPricePerSqft,
    averagePricePerSqft: null,
    medianPricePerSqft: null,
    pricePerSqftDifferencePercent: null,
    pricePerSqftPercentileRank: null,
    isLimited: true,
    statements: ["Comparable evidence is not available from imported DealSignal data yet."],
    shortEvidenceLine: "Limited local comps",
  };
}

export function formatComparableMetric(value: number | null, unit: "yield" | "price" | "percentile" | "percent") {
  if (value === null) return "Not available";
  if (unit === "yield") return formatPct(value, 2);
  if (unit === "price") return `${formatGBP(Math.round(value))} / sq ft`;
  if (unit === "percentile") return `${Math.round(value)}th percentile`;
  const sign = value > 0 ? "+" : "";
  return `${sign}${Math.round(value)}%`;
}

function percentileRank(value: number | null, peers: number[], direction: "higher" | "lower") {
  if (value === null || peers.length === 0) return null;
  const beaten = peers.filter((peer) => direction === "higher" ? value >= peer : value <= peer).length;
  return Math.round((beaten / peers.length) * 100);
}

function percentile(values: number[], percentileValue: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentileValue / 100) * sorted.length) - 1;
  return sorted[Math.min(sorted.length - 1, Math.max(0, index))];
}

function percentageDelta(value: number | null, benchmark: number | null) {
  if (value === null || !benchmark) return null;
  return ((value - benchmark) / benchmark) * 100;
}

function cityKey(deal: Deal) {
  return areaKey(deal.location.split(",")[0]);
}

function postcodeAreaKey(deal: Deal) {
  return deal.location.match(/\b[A-Z]{1,2}\d[A-Z\d]?\b/i)?.[0]?.toUpperCase() ?? "";
}

function areaKey(value: string | undefined) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function isImportedDeal(deal: Deal) {
  return Boolean(deal.isImported || deal.importSourceName);
}

function isValidComparablePeer(deal: Deal) {
  const guidePrice = positiveNumber(deal.guidePrice);
  const yieldValue = getYield(deal);
  const pricePerSqft = getPricePerSqft(deal);
  return Boolean(
    guidePrice
    && isKnownAssetType(deal.assetType)
    && hasComparableConfidence(deal)
    && yieldValue !== null
    && yieldValue >= MIN_VALID_YIELD
    && yieldValue <= MAX_VALID_YIELD
    && pricePerSqft !== null
    && pricePerSqft >= MIN_VALID_PRICE_PER_SQFT
    && pricePerSqft <= MAX_VALID_PRICE_PER_SQFT
  );
}

function hasComparableConfidence(deal: Deal) {
  if (deal.confidenceLevel) return deal.confidenceLevel === "medium" || deal.confidenceLevel === "high";
  return Number(deal.dataConfidenceScore ?? 0) >= 45;
}

function isKnownAssetType(value: string | undefined) {
  return Boolean(value && value.trim() && value.trim().toLowerCase() !== "unknown");
}

function getYield(deal: Deal) {
  return positiveNumber(deal.netInitialYield || deal.grossYield);
}

function getPricePerSqft(deal: Deal) {
  return positiveNumber(deal.pricePerSqft || (deal.guidePrice > 0 && deal.sqft > 0 ? deal.guidePrice / deal.sqft : 0));
}

function comparableSourceLabel(deal: Deal) {
  return deal.importSourceName || deal.source || "Unknown";
}

function positiveNumber(value: number) {
  return Number.isFinite(value) && value > 0 ? value : null;
}

function isNumber(value: number | null): value is number {
  return value !== null;
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function metricAudit(values: number[]): ComparableMetricAudit {
  return {
    count: values.length,
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    median: median(values),
    p95: percentile(values, 95),
  };
}
