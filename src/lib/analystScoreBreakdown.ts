import type { ComparableEvidence } from "@/lib/comparableEvidence";
import type { Deal } from "@/lib/deals";

export type ScoreContributor = {
  label: string;
  value: number;
  detail: string;
};

export type AnalystScoreBreakdown = {
  positives: ScoreContributor[];
  negatives: ScoreContributor[];
  explanation: string;
};

export function buildAnalystScoreBreakdown(
  deal: Deal,
  {
    comparableEvidence,
    strategyMatch,
  }: {
    comparableEvidence?: ComparableEvidence | null;
    strategyMatch?: number | null;
  } = {}
): AnalystScoreBreakdown {
  const positives = positiveContributors(deal, comparableEvidence, strategyMatch)
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, 8);
  const negatives = negativeContributors(deal, comparableEvidence)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value) || a.label.localeCompare(b.label))
    .slice(0, 6);

  return {
    positives,
    negatives,
    explanation: explanationText(deal, positives, negatives),
  };
}

export function scoreBreakdownLines(breakdown: AnalystScoreBreakdown) {
  return [
    ...breakdown.positives.map((item) => `+${item.value} ${item.label}: ${item.detail}`),
    ...breakdown.negatives.map((item) => `${item.value} ${item.label}: ${item.detail}`),
  ];
}

function positiveContributors(deal: Deal, evidence?: ComparableEvidence | null, strategyMatch?: number | null): ScoreContributor[] {
  const contributors: ScoreContributor[] = [];
  const yieldValue = deal.netInitialYield || deal.grossYield;

  if (yieldValue >= 8) {
    contributors.push({
      label: "Yield",
      value: Math.min(22, Math.round(yieldValue * 1.5)),
      detail: `${yieldValue.toFixed(2)}% yield is above the 8% investment benchmark.`,
    });
  }
  if (evidence?.yieldDifferencePercent !== null && evidence?.yieldDifferencePercent !== undefined && evidence.yieldDifferencePercent >= 10) {
    contributors.push({
      label: "Yield vs benchmark",
      value: Math.min(18, Math.round(evidence.yieldDifferencePercent / 3)),
      detail: `Yield is ${Math.round(evidence.yieldDifferencePercent)}% above the cleaned local comparable average.`,
    });
  }
  if (evidence?.pricePerSqftDifferencePercent !== null && evidence?.pricePerSqftDifferencePercent !== undefined && evidence.pricePerSqftDifferencePercent <= -10) {
    contributors.push({
      label: "Area value",
      value: Math.min(18, Math.round(Math.abs(evidence.pricePerSqftDifferencePercent) / 3)),
      detail: `Price per sqft is ${Math.abs(Math.round(evidence.pricePerSqftDifferencePercent))}% below the cleaned local comparable average.`,
    });
  } else if (deal.pricePerSqft > 0 && deal.guidePrice > 0 && deal.sqft > 0) {
    contributors.push({
      label: "Price evidence",
      value: Math.min(10, Math.round((deal.scoreBreakdown.marketPricing ?? 0) / 10)),
      detail: "Guide price and floor area are available, so price per sqft can be assessed.",
    });
  }
  if (knownTenant(deal) && deal.covenantStrength !== "Weak") {
    contributors.push({
      label: "Tenant",
      value: deal.covenantStrength === "Strong" ? 16 : 12,
      detail: `${deal.tenant} is recorded as the tenant; covenant still needs independent verification.`,
    });
  }
  if (deal.leaseLength >= 5 || deal.wault >= 5) {
    const years = Math.max(deal.leaseLength, deal.wault);
    contributors.push({
      label: "Lease",
      value: Math.min(14, Math.round(years)),
      detail: `${years.toFixed(1)} years of lease visibility supports the income profile.`,
    });
  }
  if (deal.rentReview !== "None" || hasRentReviews(deal)) {
    contributors.push({
      label: "Rent reviews",
      value: 8,
      detail: "Rent review information is present in the imported/enriched data.",
    });
  }
  if ((deal.dataConfidenceScore ?? 0) >= 75) {
    contributors.push({
      label: "Confidence",
      value: Math.round((deal.dataConfidenceScore ?? 0) / 8),
      detail: `Data confidence is ${deal.dataConfidenceScore}/100.`,
    });
  }
  if (strategyMatch !== null && strategyMatch !== undefined && strategyMatch >= 70) {
    contributors.push({
      label: "Strategy match",
      value: Math.round(strategyMatch / 10),
      detail: `Matches the active acquisition strategy at ${Math.round(strategyMatch)}%.`,
    });
  }
  if (deal.scoreReasons?.positiveDrivers?.length) {
    contributors.push({
      label: "Positive drivers",
      value: 6,
      detail: deal.scoreReasons.positiveDrivers[0],
    });
  }

  return contributors.filter((item) => item.value > 0);
}

function negativeContributors(deal: Deal, evidence?: ComparableEvidence | null): ScoreContributor[] {
  const contributors: ScoreContributor[] = [];
  const warnings = (deal.scoreReasons?.missingDataWarnings ?? []).join(" ").toLowerCase();

  if (!deal.enrichment?.epcRating && !warnings.includes("epc")) {
    contributors.push({ label: "Missing EPC", value: -4, detail: "EPC rating is not available from imported/enriched data." });
  }
  if (!deal.sqft || deal.sqft <= 0) {
    contributors.push({ label: "Missing floor area", value: -8, detail: "Floor area is missing, so GBP/sqft cannot be verified." });
  }
  if (evidence?.isLimited || !evidence || evidence.cleanedSampleSize < 5) {
    contributors.push({
      label: "Limited comparable evidence",
      value: -6,
      detail: "Fewer than five usable local comparables are available after cleaning the peer set.",
    });
  }
  if (!deal.leaseLength && !deal.wault) {
    contributors.push({ label: "Missing lease data", value: -8, detail: "Lease length and WAULT are not available." });
  }
  if (!knownTenant(deal)) {
    contributors.push({ label: "Missing tenant data", value: -7, detail: "Tenant name is not available from imported/enriched data." });
  }
  if (!deal.passingRent && !deal.netInitialYield && !deal.grossYield) {
    contributors.push({ label: "Missing income data", value: -10, detail: "Passing rent and yield are unavailable, limiting income analysis." });
  }
  if ((deal.dataConfidenceScore ?? 0) < 60) {
    contributors.push({ label: "Low confidence", value: -8, detail: `Data confidence is ${deal.dataConfidenceScore ?? 0}/100.` });
  }
  deal.scoreReasons?.negativeDrivers?.slice(0, 2).forEach((driver) => {
    contributors.push({ label: "Negative driver", value: -5, detail: driver });
  });

  return contributors;
}

function explanationText(deal: Deal, positives: ScoreContributor[], negatives: ScoreContributor[]) {
  const positiveText = positives.length
    ? positives.slice(0, 2).map((item) => item.label.toLowerCase()).join(" and ")
    : "limited positive evidence";
  const negativeText = negatives.length
    ? negatives.slice(0, 2).map((item) => item.label.toLowerCase()).join(" and ")
    : "no major missing-data penalties";
  return `DealSignal score ${deal.score}/100 is mainly supported by ${positiveText}, while ${negativeText} keeps the ranking cautious.`;
}

function knownTenant(deal: Deal) {
  return Boolean(deal.tenant && deal.tenant !== "Unknown" && deal.tenant !== "Vacant");
}

function hasRentReviews(deal: Deal) {
  const reviews = deal.enrichment?.extractedPayload?.rentReviews;
  return Array.isArray(reviews) && reviews.length > 0;
}
