import type { Deal } from "@/lib/deals";
import { formatGBP, formatPct } from "@/lib/deals";
import { sourceLabel } from "@/lib/dashboardFilters";

export type DealAnalysis = NonNullable<Deal["analysis"]>;

const STRONG_LOCATION_TERMS = [
  "london",
  "manchester",
  "birmingham",
  "bristol",
  "leeds",
  "reading",
  "oxford",
  "cambridge",
  "southampton",
  "bournemouth",
];

const UPSIDE_TERMS = ["development", "planning", "refurb", "reversion", "asset management", "under-rented", "vacant possession"];

export function getDealAnalysis(deal: Deal): DealAnalysis {
  return deal.analysis ?? buildDealAnalysis(deal);
}

export function buildDealAnalysis(deal: Deal): DealAnalysis {
  const opportunitySignals = uniqueSignals([
    ...opportunitySignalsFromScoreReasons(deal),
    ...opportunitySignalsFromFields(deal),
  ]).slice(0, 6);
  const riskSignals = uniqueSignals([
    ...riskSignalsFromFields(deal),
    ...(deal.scoreReasons?.negativeDrivers ?? []),
    ...(deal.scoreReasons?.missingDataWarnings ?? []),
    ...(deal.redFlags ?? []),
  ]).slice(0, 7);

  return {
    opportunitySignals,
    riskSignals,
    investmentSummary: buildInvestmentSummary(deal, opportunitySignals, riskSignals),
  };
}

function opportunitySignalsFromScoreReasons(deal: Deal) {
  return deal.scoreReasons?.positiveDrivers ?? [];
}

function opportunitySignalsFromFields(deal: Deal) {
  const text = searchableDealText(deal);
  const source = sourceLabel(deal);
  const signals: string[] = [];

  if (deal.netInitialYield >= 8) signals.push(`${formatPct(deal.netInitialYield, 1)} yield is above an 8% acquisition benchmark`);
  else if (deal.netInitialYield >= 6.5) signals.push(`${formatPct(deal.netInitialYield, 1)} income yield available`);
  if (deal.pricePerSqft > 0 && deal.pricePerSqft <= 150) signals.push(`Below benchmark capital value at ${formatGBP(deal.pricePerSqft)} / sq ft`);
  if (deal.guidePrice > 0 && deal.sqft >= 20000) signals.push(`Large site for price: ${deal.sqft.toLocaleString()} sq ft available`);
  if (deal.passingRent > 0) signals.push(`Passing income recorded at ${formatGBP(deal.passingRent)} pa`);
  if (deal.tenant && deal.tenant !== "Unknown" && deal.tenant !== "Vacant") signals.push(`Existing tenant in place: ${deal.tenant}`);
  if (deal.covenantStrength === "Strong" || deal.covenantStrength === "Good") signals.push(`${deal.covenantStrength} covenant strength recorded`);
  if (deal.wault >= 5 || deal.leaseLength >= 5) signals.push("Lease term information supports income visibility");
  if (deal.source === "Auction" || /acuitus|auction/i.test(source)) signals.push("Auction source may offer guide-price discount opportunity");
  if (deal.reversionaryYield > deal.netInitialYield && deal.netInitialYield > 0) signals.push("Reversionary yield suggests income upside");
  if (containsAny(text, UPSIDE_TERMS)) signals.push("Listing text suggests value-add potential");
  if (containsAny(`${deal.location} ${deal.region}`, STRONG_LOCATION_TERMS)) signals.push(`Recognisable commercial location: ${deal.location}`);

  return signals;
}

function riskSignalsFromFields(deal: Deal) {
  const signals: string[] = [];

  if (deal.guidePrice <= 0) signals.push("Guide price missing or POA");
  if (deal.passingRent <= 0) signals.push("Passing rent missing");
  if (!deal.tenant || deal.tenant === "Unknown") signals.push("Tenant unknown");
  if (deal.tenant === "Vacant" || deal.covenantStrength === "Vacant") signals.push("Vacant property or income not in place");
  if (deal.covenantStrength === "Weak") signals.push("Weak covenant strength recorded");
  if (deal.wault <= 0 && deal.leaseLength <= 0) signals.push("Lease information missing");
  if ((deal.dataConfidenceScore ?? 100) < 45) signals.push("Low confidence data");
  else if ((deal.dataConfidenceScore ?? 100) < 75) signals.push("Medium confidence data");
  if (deal.netInitialYield <= 0) signals.push("Yield unavailable");
  else if (deal.netInitialYield < 5) signals.push("Weak yield below 5%");
  if (deal.pricePerSqft >= 600) signals.push(`Price above benchmark at ${formatGBP(deal.pricePerSqft)} / sq ft`);
  if (deal.needsReview) signals.push("Sparse listing data needs review");
  if (!deal.sourceUrl && deal.isImported) signals.push("Source URL missing");
  if (deal.mainRiskFlag && !/needs review/i.test(deal.mainRiskFlag)) signals.push(deal.mainRiskFlag);

  return signals;
}

function buildInvestmentSummary(deal: Deal, opportunities: string[], risks: string[]) {
  const source = sourceLabel(deal);
  const price = deal.guidePrice > 0 ? `with a guide price of ${formatGBP(deal.guidePrice)}` : "with no guide price available";
  const yieldText = deal.netInitialYield > 0 ? ` and ${formatPct(deal.netInitialYield, 2)} NIY` : " and no verified yield";
  const sqftText = deal.sqft > 0 ? ` The listing records ${deal.sqft.toLocaleString()} sq ft.` : " Floor area is not available.";
  const opportunityText = opportunities.length > 0
    ? `Opportunity signals include ${sentenceList(opportunities.slice(0, 2))}.`
    : "No strong opportunity signal is available from the imported fields yet.";
  const riskText = risks.length > 0
    ? `Key risks are ${sentenceList(risks.slice(0, 2))}.`
    : "No specific risk signal has been recorded, but standard title, lease and comparable checks still apply.";

  return `${deal.title} is a ${deal.assetType.toLowerCase()} opportunity in ${deal.location} from ${source}, ${price}${yieldText}.${sqftText} ${opportunityText} ${riskText}`;
}

function searchableDealText(deal: Deal) {
  return [
    deal.title,
    deal.location,
    deal.region,
    deal.assetType,
    deal.mainRiskFlag,
    deal.insights?.mispricing,
    deal.insights?.askAgent,
    deal.insights?.couldGoWrong,
  ].filter(Boolean).join(" ").toLowerCase();
}

function sentenceList(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function uniqueSignals(items: string[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const normalized = item.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function containsAny(value: string, terms: string[]) {
  const normalized = value.toLowerCase();
  return terms.some((term) => normalized.includes(term));
}
