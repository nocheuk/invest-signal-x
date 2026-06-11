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

type PeerGroup = {
  group: ComparableGroup;
  area: string;
  assetType?: string;
  peers: Deal[];
};

const MIN_STRONG_SAMPLE = 5;
const MIN_USABLE_SAMPLE = 3;

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
  if (evidence.sampleSize === 0) return "Comparable evidence is not available from imported DealSignal data yet.";
  return evidence.statements[0] ?? "Comparable evidence is limited and should be verified manually.";
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
  return candidates.find((candidate) => candidate.peers.length >= MIN_USABLE_SAMPLE) ?? candidates.find((candidate) => candidate.peers.length > 0) ?? null;
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
  const dealYield = positiveNumber(deal.netInitialYield || deal.grossYield);
  const dealPricePerSqft = positiveNumber(deal.pricePerSqft || (deal.guidePrice > 0 && deal.sqft > 0 ? deal.guidePrice / deal.sqft : 0));
  const yields = group.peers.map((peer) => positiveNumber(peer.netInitialYield || peer.grossYield)).filter(isNumber);
  const prices = group.peers.map((peer) => positiveNumber(peer.pricePerSqft || (peer.guidePrice > 0 && peer.sqft > 0 ? peer.guidePrice / peer.sqft : 0))).filter(isNumber);
  const averageYield = average(yields);
  const averagePrice = average(prices);
  const evidence: ComparableEvidence = {
    group: group.group,
    area: group.area,
    assetType: group.assetType,
    sampleSize: group.peers.length,
    yieldSampleSize: yields.length,
    pricePerSqftSampleSize: prices.length,
    dealYield,
    averageYield,
    medianYield: median(yields),
    yieldDifferencePercent: percentageDelta(dealYield, averageYield),
    yieldPercentileRank: percentileRank(dealYield, yields, "higher"),
    dealPricePerSqft,
    averagePricePerSqft: averagePrice,
    medianPricePerSqft: median(prices),
    pricePerSqftDifferencePercent: percentageDelta(dealPricePerSqft, averagePrice),
    pricePerSqftPercentileRank: percentileRank(dealPricePerSqft, prices, "lower"),
    isLimited: group.peers.length < MIN_STRONG_SAMPLE,
    statements: [],
    shortEvidenceLine: "",
  };
  return evidence;
}

function evidenceStatements(evidence: ComparableEvidence) {
  const statements: string[] = [];
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
  if (evidence.isLimited) statements.push("Comparable evidence is limited in this area, so this should be verified manually.");
  return statements.length ? statements : ["Comparable evidence is not available from imported DealSignal data yet."];
}

function shortEvidenceLine(evidence: ComparableEvidence) {
  if (evidence.yieldDifferencePercent !== null && evidence.yieldSampleSize >= MIN_USABLE_SAMPLE && evidence.yieldDifferencePercent >= 10) {
    return `+${Math.round(evidence.yieldDifferencePercent)}% vs area yield`;
  }
  if (evidence.pricePerSqftDifferencePercent !== null && evidence.pricePerSqftSampleSize >= MIN_USABLE_SAMPLE && evidence.pricePerSqftDifferencePercent <= -10) {
    return `${Math.abs(Math.round(evidence.pricePerSqftDifferencePercent))}% below area GBP/sqft`;
  }
  if (evidence.isLimited) return "Limited local comps";
  return evidence.sampleSize > 0 ? `${evidence.sampleSize} local comps` : "No local comps yet";
}

function emptyEvidence(deal: Deal): ComparableEvidence {
  const dealYield = positiveNumber(deal.netInitialYield || deal.grossYield);
  const dealPricePerSqft = positiveNumber(deal.pricePerSqft || (deal.guidePrice > 0 && deal.sqft > 0 ? deal.guidePrice / deal.sqft : 0));
  return {
    group: null,
    area: null,
    sampleSize: 0,
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
