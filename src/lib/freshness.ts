import type { Deal } from "@/lib/deals";
import { classifyDeal } from "@/lib/dealClassification";

export type FreshnessFilter = "all" | "today" | "week" | "green-candidates-week" | "sources-today";

export type FreshnessMetrics = {
  newToday: number;
  newThisWeek: number;
  newGreenCandidates: number;
  newSourcesToday: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function buildFreshnessMetrics(deals: Deal[], now = new Date()): FreshnessMetrics {
  const newTodayDeals = deals.filter((deal) => isNewToday(deal, now));
  const newThisWeekDeals = deals.filter((deal) => isNewThisWeek(deal, now));

  return {
    newToday: newTodayDeals.length,
    newThisWeek: newThisWeekDeals.length,
    newGreenCandidates: newThisWeekDeals.filter((deal) => classifyDeal(deal) === "green-candidate").length,
    newSourcesToday: newTodayDeals.filter(hasSourceListing).length,
  };
}

export function filterByFreshness(deals: Deal[], filter: FreshnessFilter, now = new Date()) {
  if (filter === "today") return deals.filter((deal) => isNewToday(deal, now));
  if (filter === "week") return deals.filter((deal) => isNewThisWeek(deal, now));
  if (filter === "green-candidates-week") {
    return deals.filter((deal) => isNewThisWeek(deal, now) && classifyDeal(deal) === "green-candidate");
  }
  if (filter === "sources-today") return deals.filter((deal) => isNewToday(deal, now) && hasSourceListing(deal));
  return deals;
}

export function sortNewestDeals(deals: Deal[]) {
  return [...deals].sort((a, b) => dateValue(b.postedAt) - dateValue(a.postedAt));
}

export function isNewToday(deal: Deal, now = new Date()) {
  return isFreshImportedDeal(deal, now, DAY_MS);
}

export function isNewThisWeek(deal: Deal, now = new Date()) {
  return isFreshImportedDeal(deal, now, 7 * DAY_MS);
}

export function formatAddedAgo(value: string | undefined, now = new Date()) {
  const timestamp = dateValue(value);
  if (!timestamp) return "";
  const elapsedMs = Math.max(0, now.getTime() - timestamp);
  const minutes = Math.floor(elapsedMs / (60 * 1000));
  if (minutes < 1) return "Added just now";
  if (minutes < 60) return `Added ${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Added ${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  return `Added ${days} ${days === 1 ? "day" : "days"} ago`;
}

export function formatImportDate(value: string | undefined) {
  const timestamp = dateValue(value);
  if (!timestamp) return "Import date not available";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date(timestamp));
}

function isFreshImportedDeal(deal: Deal, now: Date, windowMs: number) {
  if (!isImportedDeal(deal)) return false;
  const timestamp = dateValue(deal.postedAt);
  if (!timestamp) return false;
  const current = now.getTime();
  return timestamp <= current && timestamp >= current - windowMs;
}

function hasSourceListing(deal: Deal) {
  return Boolean(deal.sourceUrl || deal.importSourceName || deal.importSourceType);
}

function isImportedDeal(deal: Deal) {
  return Boolean(deal.isImported || deal.importSourceName);
}

function dateValue(value: string | undefined) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}
