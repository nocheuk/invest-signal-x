import type { Deal } from "@/lib/deals";

export type DealClassification = "verified-green" | "green-candidate" | "amber" | "red";

export function classifyDeal(deal: Deal): DealClassification {
  const confidence = deal.dataConfidenceScore ?? 100;
  if (deal.score >= 78 && confidence >= 80) return "verified-green";
  if (isGreenCandidate(deal)) return "green-candidate";
  if (deal.score >= 60) return "amber";
  return "red";
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
  if (deal.score >= 72) reasons.push(`Score ${deal.score} is above the Green Candidate threshold`);
  if ((deal.dataConfidenceScore ?? 0) >= 75) reasons.push(`Confidence ${deal.dataConfidenceScore} is high enough for candidate review`);
  if (deal.guidePrice > 0) reasons.push("Guide price is available");
  if (deal.netInitialYield > 0 || deal.grossYield > 0) reasons.push("Yield is available");
  else if (deal.passingRent > 0) reasons.push("Passing rent is available");
  return reasons;
}

export function classificationLabel(classification: DealClassification) {
  if (classification === "verified-green") return "Verified Green";
  if (classification === "green-candidate") return "Green Candidate";
  if (classification === "amber") return "Amber";
  return "Red";
}

export function countDealClassifications(deals: Deal[]) {
  return deals.reduce((counts, deal) => {
    counts[classifyDeal(deal)] += 1;
    return counts;
  }, {
    "verified-green": 0,
    "green-candidate": 0,
    amber: 0,
    red: 0,
  } satisfies Record<DealClassification, number>);
}
