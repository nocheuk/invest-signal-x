import type { Deal } from "@/lib/deals";

export type DealClassification = "verified-green" | "green-candidate" | "requires-due-diligence" | "low-priority";

export function classifyDeal(deal: Deal): DealClassification {
  const confidence = deal.dataConfidenceScore ?? 100;
  if (deal.score >= 78 && confidence >= 80) return "verified-green";
  if (isGreenCandidate(deal)) return "green-candidate";
  if (isLowPriority(deal)) return "low-priority";
  return "requires-due-diligence";
}

export function isGreenCandidate(deal: Deal) {
  return (
    deal.score >= 72 &&
    (deal.dataConfidenceScore ?? 0) >= 75 &&
    deal.guidePrice > 0 &&
    (deal.netInitialYield > 0 || deal.grossYield > 0 || deal.passingRent > 0)
  );
}

export function greenCandidateReasons(deal: Deal) {
  const reasons: string[] = [];
  if (deal.score >= 72) reasons.push(`Score ${deal.score} is above the Strong Opportunity threshold`);
  if ((deal.dataConfidenceScore ?? 0) >= 75) reasons.push(`Confidence ${deal.dataConfidenceScore} is high enough for opportunity review`);
  if (deal.guidePrice > 0) reasons.push("Guide price is available");
  if (deal.netInitialYield > 0 || deal.grossYield > 0) reasons.push("Yield is available");
  else if (deal.passingRent > 0) reasons.push("Passing rent is available");
  return reasons;
}

export function isLowPriority(deal: Deal) {
  const confidence = deal.dataConfidenceScore ?? 100;
  const missing = deal.scoreReasons?.missingDataWarnings ?? [];
  const sourceMissing = missing.includes("Source URL missing") || !deal.sourceUrl && Boolean(deal.isImported || deal.importSourceName);
  const guideMissing = missing.includes("Guide price missing") || deal.guidePrice <= 0;
  const incomeMissing = (deal.passingRent <= 0 && deal.netInitialYield <= 0 && deal.grossYield <= 0);
  const actionableFieldCount = [
    deal.guidePrice > 0,
    Boolean(deal.location && deal.location !== "All UK"),
    Boolean(deal.assetType),
    Boolean(deal.sourceUrl || deal.importSourceName),
    deal.sqft > 0 || deal.pricePerSqft > 0,
    deal.passingRent > 0 || deal.netInitialYield > 0 || deal.grossYield > 0,
    Boolean(deal.tenant && deal.tenant !== "Unknown"),
    deal.wault > 0 || deal.leaseLength > 0,
  ].filter(Boolean).length;

  return (
    guideMissing ||
    sourceMissing ||
    confidence < 45 ||
    incomeMissing ||
    actionableFieldCount <= 3
  );
}

export function classificationLabel(classification: DealClassification) {
  if (classification === "verified-green") return "Top Opportunity";
  if (classification === "green-candidate") return "Strong Opportunity";
  if (classification === "requires-due-diligence") return "Requires Due Diligence";
  return "Low Priority";
}

export function countDealClassifications(deals: Deal[]) {
  return deals.reduce((counts, deal) => {
    counts[classifyDeal(deal)] += 1;
    return counts;
  }, {
    "verified-green": 0,
    "green-candidate": 0,
    "requires-due-diligence": 0,
    "low-priority": 0,
  } satisfies Record<DealClassification, number>);
}
