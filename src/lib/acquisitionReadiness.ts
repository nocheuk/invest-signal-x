import type { ComparableEvidence } from "@/lib/comparableEvidence";
import type { Deal } from "@/lib/deals";

export type ReadinessBand = "Not ready" | "Needs verification" | "Review ready" | "Offer ready";

export type ReadinessChecklistItem = {
  key: string;
  label: string;
  present: boolean;
  detail: string;
};

export type AcquisitionReadiness = {
  score: number;
  band: ReadinessBand;
  checklist: ReadinessChecklistItem[];
  missingLabels: string[];
  summary: string;
};

export function buildAcquisitionReadiness(deal: Deal, comparableEvidence?: ComparableEvidence | null): AcquisitionReadiness {
  const checklist: ReadinessChecklistItem[] = [
    item("price", "Price", deal.guidePrice > 0, deal.guidePrice > 0 ? "Guide price available" : "Guide price missing"),
    item("rent", "Rent", deal.passingRent > 0, deal.passingRent > 0 ? "Passing rent available" : "Passing rent missing"),
    item("tenant", "Tenant", knownTenant(deal), knownTenant(deal) ? deal.tenant : "Tenant missing"),
    item("lease", "Lease", hasLeaseExpiry(deal), hasLeaseExpiry(deal) ? "Lease expiry available" : "Lease expiry missing"),
    item("wault", "WAULT", deal.wault > 0 || deal.leaseLength > 0, deal.wault > 0 ? `${deal.wault.toFixed(1)} years WAULT` : deal.leaseLength > 0 ? `${deal.leaseLength.toFixed(1)} years lease length` : "WAULT/lease length missing"),
    item("epc", "EPC", hasEpc(deal), hasEpc(deal) ? "EPC available" : "EPC missing"),
    item("floor-area", "Floor area", deal.sqft > 0, deal.sqft > 0 ? `${deal.sqft.toLocaleString()} sq ft` : "Floor area missing"),
    item("comparable-evidence", "Comparable evidence", Boolean(comparableEvidence && !comparableEvidence.isLimited && comparableEvidence.cleanedSampleSize >= 5), comparableEvidence && comparableEvidence.cleanedSampleSize >= 5 ? `${comparableEvidence.cleanedSampleSize} usable comps` : "Comparable evidence limited"),
    item("source-url", "Source URL", Boolean(deal.sourceUrl), deal.sourceUrl ? "Source listing available" : "Source URL missing"),
  ];
  const present = checklist.filter((entry) => entry.present).length;
  const score = Math.round((present / checklist.length) * 100);
  const band = readinessBand(score);
  const missingLabels = checklist.filter((entry) => !entry.present).map((entry) => entry.label);
  return {
    score,
    band,
    checklist,
    missingLabels,
    summary: missingLabels.length
      ? `${band}: ${present} of ${checklist.length} core diligence fields are present. Missing ${missingLabels.slice(0, 3).join(", ")}${missingLabels.length > 3 ? " and more" : ""}.`
      : "Offer ready: all core diligence fields are present, subject to independent verification.",
  };
}

export function readinessBand(score: number): ReadinessBand {
  if (score < 40) return "Not ready";
  if (score < 70) return "Needs verification";
  if (score < 90) return "Review ready";
  return "Offer ready";
}

function item(key: string, label: string, present: boolean, detail: string): ReadinessChecklistItem {
  return { key, label, present, detail };
}

function knownTenant(deal: Deal) {
  return Boolean(deal.tenant && deal.tenant !== "Unknown" && deal.tenant !== "Vacant");
}

function hasLeaseExpiry(deal: Deal) {
  return Boolean(extractedString(deal, "leaseExpiryText") || extractedString(deal, "leaseExpiry") || deal.leaseLength > 0 || deal.wault > 0);
}

function hasEpc(deal: Deal) {
  return Boolean(deal.enrichment?.epcRating || extractedString(deal, "epcRating") || extractedString(deal, "epc"));
}

function extractedString(deal: Deal, key: string) {
  const value = deal.enrichment?.extractedPayload?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}
