import type { AreaIntelligence } from "@/lib/areaIntelligence";
import { formatGBP, formatPct, type Deal } from "@/lib/deals";
import { getDealAnalysis } from "@/lib/dealAnalysis";
import { classificationLabel, classifyDeal } from "@/lib/dealClassification";
import { sourceLabel } from "@/lib/dashboardFilters";

export type InvestorVerdict = "Review Immediately" | "Worth Investigating" | "Monitor" | "Low Priority";

export type InvestmentThesis = {
  summary: string;
  whyInteresting: string[];
  potentialUpside: string[];
  keyRisks: string[];
  verifyNext: string[];
  confidenceLevel: "High" | "Medium" | "Low";
  investorVerdict: InvestorVerdict;
};

export type InvestmentThesisOptions = {
  areaIntelligence?: AreaIntelligence | null;
  strategyMatch?: number;
  strategyReasons?: string[];
};

export function buildInvestmentThesis(deal: Deal, options: InvestmentThesisOptions = {}): InvestmentThesis {
  const analysis = getDealAnalysis(deal);
  const classification = classifyDeal(deal);
  const confidenceScore = deal.dataConfidenceScore ?? 0;
  const confidenceLevel = confidenceScore >= 80 ? "High" : confidenceScore >= 60 ? "Medium" : "Low";
  const yieldValue = deal.netInitialYield || deal.grossYield;
  const source = sourceLabel(deal);
  const whyInteresting = unique([
    ...opportunityFromCoreFields(deal, options),
    ...analysis.opportunitySignals,
    ...(options.strategyReasons ?? []),
  ]).slice(0, 6);
  const potentialUpside = unique(upsideFromDeal(deal, options.areaIntelligence)).slice(0, 5);
  const keyRisks = unique([
    ...analysis.riskSignals,
    ...(deal.scoreReasons?.negativeDrivers ?? []),
    ...(deal.scoreReasons?.missingDataWarnings ?? []),
    ...(deal.redFlags ?? []),
  ]).slice(0, 6);
  const verifyNext = unique([
    ...verifyFromMissingData(deal),
    ...(deal.scoreReasons?.verifyBeforeTrusting ?? []),
    "Review title/legal pack",
    "Compare nearby sold/listed evidence",
  ]).slice(0, 8);
  const investorVerdict = verdictForDeal(deal, classification, confidenceScore, options.strategyMatch, options.areaIntelligence);
  const summary = thesisSummary({
    deal,
    classification,
    confidenceLevel,
    investorVerdict,
    source,
    yieldValue,
    whyInteresting,
    potentialUpside,
    keyRisks,
  });

  return {
    summary,
    whyInteresting: whyInteresting.length ? whyInteresting : ["Imported data does not show a strong opportunity signal yet."],
    potentialUpside: potentialUpside.length ? potentialUpside : ["No calculated upside signal is available from the imported data yet."],
    keyRisks: keyRisks.length ? keyRisks : ["No specific risk signal is recorded, but standard diligence still applies."],
    verifyNext,
    confidenceLevel,
    investorVerdict,
  };
}

function opportunityFromCoreFields(deal: Deal, options: InvestmentThesisOptions) {
  const signals: string[] = [];
  const yieldValue = deal.netInitialYield || deal.grossYield;
  if (yieldValue >= 8) signals.push(`Income yield is above 8% at ${formatPct(yieldValue, 1)}`);
  else if (yieldValue >= 6.5) signals.push(`Income yield is visible at ${formatPct(yieldValue, 1)}`);
  if (deal.guidePrice > 0 && deal.sqft > 0) signals.push("Guide price and floor area allow a capital value check");
  if (deal.passingRent > 0) signals.push(`Passing rent is recorded at ${formatGBP(deal.passingRent)} pa`);
  if (deal.tenant && deal.tenant !== "Unknown" && deal.tenant !== "Vacant") signals.push(`Tenant is identified: ${deal.tenant}`);
  if ((deal.dataConfidenceScore ?? 0) >= 80) signals.push("High confidence imported data");
  else if ((deal.dataConfidenceScore ?? 0) >= 75) signals.push("Sufficient confidence for opportunity review");
  if ((options.strategyMatch ?? 0) >= 75) signals.push(`Matches your acquisition brief at ${Math.round(options.strategyMatch ?? 0)}%`);
  if (classifyDeal(deal) === "verified-green" || classifyDeal(deal) === "green-candidate") signals.push(`${classificationLabel(classifyDeal(deal))} classification`);
  return signals;
}

function upsideFromDeal(deal: Deal, area: AreaIntelligence | null | undefined) {
  const upside: string[] = [];
  const yieldValue = deal.netInitialYield || deal.grossYield;
  const pricePerSqft = deal.pricePerSqft || (deal.guidePrice > 0 && deal.sqft > 0 ? deal.guidePrice / deal.sqft : 0);

  if (area?.yieldDelta !== null && area?.yieldDelta !== undefined && area.yieldDelta >= 1) {
    upside.push(`Yield is ${area.yieldDelta.toFixed(1)} percentage points above the local average`);
  }
  if (area?.pricePerSqftDelta !== null && area?.pricePerSqftDelta !== undefined && area.pricePerSqftDelta <= -25) {
    const localAverage = area.stats?.averagePricePerSqft;
    const percentBelow = localAverage ? Math.round((Math.abs(area.pricePerSqftDelta) / localAverage) * 100) : null;
    upside.push(percentBelow
      ? `Price per sqft is ${percentBelow}% below the local average (${formatGBP(Math.abs(Math.round(area.pricePerSqftDelta)))}/sq ft lower)`
      : `Price per sqft is ${formatGBP(Math.abs(Math.round(area.pricePerSqftDelta)))}/sq ft below the local average`);
  }
  if (deal.reversionaryYield > 0 && yieldValue > 0 && deal.reversionaryYield > yieldValue) {
    upside.push(`Reversionary yield is ${(deal.reversionaryYield - yieldValue).toFixed(1)} percentage points above current yield`);
  }
  if (deal.passingRent > 0 && deal.guidePrice > 0 && yieldValue <= 0) {
    upside.push("Passing rent and guide price are available for yield verification");
  }
  if (deal.guidePrice > 0 && deal.sqft > 0 && pricePerSqft > 0) {
    upside.push(`Potential value gap can be checked against ${formatGBP(Math.round(pricePerSqft))}/sq ft`);
  }
  return upside;
}

function verifyFromMissingData(deal: Deal) {
  const warnings = new Set([...(deal.scoreReasons?.missingDataWarnings ?? []), ...getDealAnalysis(deal).riskSignals]);
  const checklist: string[] = [];
  if (warnings.has("Tenant covenant unknown") || warnings.has("Tenant unknown") || !deal.tenant || deal.tenant === "Unknown") checklist.push("Confirm tenant covenant");
  if (warnings.has("Lease length/WAULT missing") || warnings.has("Lease information missing") || (!deal.wault && !deal.leaseLength)) checklist.push("Confirm lease expiry and WAULT");
  if (warnings.has("Passing rent missing") || deal.passingRent <= 0) checklist.push("Confirm passing rent");
  if (warnings.has("Floor area missing") || deal.sqft <= 0) checklist.push("Confirm floor area");
  if (warnings.has("Guide price missing") || deal.guidePrice <= 0) checklist.push("Confirm guide price");
  if (warnings.has("No comparable evidence yet")) checklist.push("Compare nearby sold/listed evidence");
  checklist.push("Check planning constraints");
  checklist.push("Check EPC");
  return checklist;
}

function verdictForDeal(
  deal: Deal,
  classification: ReturnType<typeof classifyDeal>,
  confidenceScore: number,
  strategyMatch: number | undefined,
  area: AreaIntelligence | null | undefined
): InvestorVerdict {
  if (classification === "low-priority" || confidenceScore < 45 || deal.score < 55) return "Low Priority";
  const areaSupport = (area?.yieldDelta ?? 0) >= 1 || (area?.pricePerSqftDelta ?? 0) <= -25;
  const strategySupport = (strategyMatch ?? 0) >= 70;
  if (classification === "verified-green" && confidenceScore >= 80) return "Review Immediately";
  if (classification === "green-candidate" && confidenceScore >= 75 && (deal.score >= 74 || areaSupport || strategySupport)) return "Review Immediately";
  if (classification === "green-candidate" || deal.score >= 68 || areaSupport || strategySupport) return "Worth Investigating";
  return "Monitor";
}

function thesisSummary({
  deal,
  classification,
  confidenceLevel,
  investorVerdict,
  source,
  yieldValue,
  whyInteresting,
  potentialUpside,
  keyRisks,
}: {
  deal: Deal;
  classification: ReturnType<typeof classifyDeal>;
  confidenceLevel: InvestmentThesis["confidenceLevel"];
  investorVerdict: InvestorVerdict;
  source: string;
  yieldValue: number;
  whyInteresting: string[];
  potentialUpside: string[];
  keyRisks: string[];
}) {
  const priceText = deal.guidePrice > 0 ? `guide price of ${formatGBP(deal.guidePrice)}` : "no verified guide price";
  const yieldText = yieldValue > 0 ? ` and ${formatPct(yieldValue, 2)} yield` : " and no verified yield";
  const interest = whyInteresting[0] ?? `${classificationLabel(classification)} classification`;
  const upside = potentialUpside[0] ?? "no calculated upside signal is available yet";
  const risk = keyRisks[0] ?? "standard lease, title and comparable evidence still need checking";
  return `DealSignal Thesis: This ${deal.assetType.toLowerCase()} opportunity in ${deal.location} from ${source} has a ${priceText}${yieldText}. It looks interesting because ${lowerFirst(interest)}. Potential upside is based on ${lowerFirst(upside)}, but ${lowerFirst(risk)}. Investor verdict: ${investorVerdict} with ${confidenceLevel.toLowerCase()} confidence.`;
}

function unique(items: string[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const normalized = item.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function lowerFirst(value: string) {
  return value ? value.charAt(0).toLowerCase() + value.slice(1) : value;
}
