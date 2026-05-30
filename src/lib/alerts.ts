import type { AssetType, Deal } from "@/lib/deals";
import { formatGBP, formatPct } from "@/lib/deals";

export type SavedAlertCriteria = {
  id?: string;
  name: string;
  locationQuery: string;
  minYield: number;
  maxPrice: number;
  assetType: string;
  minScore: number;
  enabled: boolean;
};

export type AlertMatchResult = {
  matches: boolean;
  reasons: string[];
};

export type AlertEmailDeal = Pick<Deal, "id" | "title" | "location" | "assetType" | "guidePrice" | "netInitialYield" | "score"> & {
  url: string;
};

export type AlertEmailPayload = {
  alertName: string;
  matchingDealCount: number;
  topDeals: AlertEmailDeal[];
  appUrl: string;
  subject: string;
  text: string;
  html: string;
};

export const DEFAULT_ALERT_LIMIT = 5;

export function alertMatchesDeal(alert: SavedAlertCriteria, deal: Deal): AlertMatchResult {
  if (!alert.enabled) return { matches: false, reasons: ["Alert disabled"] };
  const reasons: string[] = [];

  if (alert.locationQuery.trim()) {
    const locationQuery = normalize(alert.locationQuery);
    const haystack = normalize([deal.location, deal.region, deal.title].filter(Boolean).join(" "));
    if (!haystack.includes(locationQuery)) return { matches: false, reasons: [`Location does not match ${alert.locationQuery}`] };
    reasons.push(`Location matches ${alert.locationQuery}`);
  }

  if (alert.assetType && alert.assetType !== "All" && deal.assetType !== alert.assetType) {
    return { matches: false, reasons: [`Asset type is ${deal.assetType}, not ${alert.assetType}`] };
  }
  if (alert.assetType && alert.assetType !== "All") reasons.push(`Asset type matches ${alert.assetType}`);

  if (alert.minYield > 0) {
    if (deal.netInitialYield < alert.minYield) return { matches: false, reasons: [`Yield below ${formatPct(alert.minYield, 1)}`] };
    reasons.push(`Yield ${formatPct(deal.netInitialYield, 2)} meets minimum ${formatPct(alert.minYield, 1)}`);
  }

  if (alert.maxPrice > 0) {
    if (deal.guidePrice <= 0 || deal.guidePrice > alert.maxPrice) return { matches: false, reasons: [`Guide price above ${formatGBP(alert.maxPrice)} or unavailable`] };
    reasons.push(`Guide price ${formatGBP(deal.guidePrice)} within ${formatGBP(alert.maxPrice)}`);
  }

  if (alert.minScore > 0) {
    if (deal.score < alert.minScore) return { matches: false, reasons: [`Score below ${alert.minScore}`] };
    reasons.push(`Score ${deal.score} meets minimum ${alert.minScore}`);
  }

  return { matches: true, reasons: reasons.length ? reasons : ["Deal matches alert criteria"] };
}

export function buildAlertEmailPayload({
  alert,
  deals,
  appUrl,
  limit = DEFAULT_ALERT_LIMIT,
}: {
  alert: Pick<SavedAlertCriteria, "name">;
  deals: Deal[];
  appUrl: string;
  limit?: number;
}): AlertEmailPayload {
  const topDeals = [...deals]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((deal) => ({
      id: deal.id,
      title: deal.title,
      location: deal.location,
      assetType: deal.assetType as AssetType,
      guidePrice: deal.guidePrice,
      netInitialYield: deal.netInitialYield,
      score: deal.score,
      url: `${appUrl.replace(/\/$/, "")}/deal/${deal.id}`,
    }));
  const subject = `DealSignal alert: ${topDeals.length} matching ${topDeals.length === 1 ? "deal" : "deals"} for ${alert.name}`;
  const textDeals = topDeals.map((deal) => (
    `- ${deal.title} (${deal.location}) | Score ${deal.score} | ${deal.guidePrice > 0 ? formatGBP(deal.guidePrice) : "Price not available"} | ${deal.netInitialYield > 0 ? formatPct(deal.netInitialYield, 2) : "Yield not available"} | ${deal.url}`
  )).join("\n");
  const htmlDeals = topDeals.map((deal) => (
    `<li><strong>${escapeHtml(deal.title)}</strong><br>${escapeHtml(deal.location)} · Score ${deal.score} · ${deal.guidePrice > 0 ? formatGBP(deal.guidePrice) : "Price not available"} · ${deal.netInitialYield > 0 ? formatPct(deal.netInitialYield, 2) : "Yield not available"}<br><a href="${deal.url}">Open deal</a></li>`
  )).join("");

  return {
    alertName: alert.name,
    matchingDealCount: deals.length,
    topDeals,
    appUrl,
    subject,
    text: `DealSignal found ${deals.length} matching ${deals.length === 1 ? "deal" : "deals"} for "${alert.name}".\n\n${textDeals}\n\nOpen DealSignal: ${appUrl}`,
    html: `<p>DealSignal found ${deals.length} matching ${deals.length === 1 ? "deal" : "deals"} for <strong>${escapeHtml(alert.name)}</strong>.</p><ul>${htmlDeals}</ul><p><a href="${appUrl}">Open DealSignal</a></p>`,
  };
}

export function defaultAlertName(criteria: Pick<SavedAlertCriteria, "locationQuery" | "assetType" | "minYield" | "maxPrice" | "minScore">) {
  const parts = [
    criteria.locationQuery.trim() || "All locations",
    criteria.assetType && criteria.assetType !== "All" ? criteria.assetType : "",
    criteria.minYield > 0 ? `min ${formatPct(criteria.minYield, 1)}` : "",
    criteria.maxPrice > 0 ? `max ${formatGBP(criteria.maxPrice)}` : "",
    criteria.minScore > 0 ? `score ${criteria.minScore}+` : "",
  ].filter(Boolean);
  return `${parts.join(" · ")} alert`;
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
