import type { Deal } from "@/lib/deals";
import { countDealClassifications } from "@/lib/dealClassification";
import { ACUITUS_SOURCE, ALLSOP_SOURCE, EDDISONS_SOURCE, IMPORT_SOURCE_OPTIONS, RIGHTMOVE_COMMERCIAL_SOURCE, sourceLabel } from "@/lib/dashboardFilters";
import type { NationalScanStatus } from "@/hooks/useNationalScanStatus";

export type InventoryAuditMetrics = {
  totalDeals: number;
  totalImportedDeals: number;
  rightmoveDeals: number;
  acuitusDeals: number;
  eddisonsDeals: number;
  allsopDeals: number;
  sourceCounts: Record<string, number>;
  verifiedGreens: number;
  greenCandidates: number;
  requiresDueDiligence: number;
  lowPriority: number;
  addedToday: number;
  addedThisWeek: number;
  locationsCompletedInCurrentCycle: number;
  totalConfiguredLocations: number;
};

export function buildInventoryAudit({
  deals,
  scanStatus,
  now = new Date(),
}: {
  deals: Deal[];
  scanStatus?: NationalScanStatus | null;
  now?: Date;
}): InventoryAuditMetrics {
  const classifications = countDealClassifications(deals);
  const startOfToday = startOfLocalDay(now);
  const startOfWeek = startOfLocalWeek(now);

  const sourceCounts = Object.fromEntries(
    IMPORT_SOURCE_OPTIONS.map((source) => [source, deals.filter((deal) => sourceLabel(deal) === source).length])
  );

  return {
    totalDeals: deals.length,
    totalImportedDeals: deals.filter(isImportedDeal).length,
    rightmoveDeals: sourceCounts[RIGHTMOVE_COMMERCIAL_SOURCE] ?? 0,
    acuitusDeals: sourceCounts[ACUITUS_SOURCE] ?? 0,
    eddisonsDeals: sourceCounts[EDDISONS_SOURCE] ?? 0,
    allsopDeals: sourceCounts[ALLSOP_SOURCE] ?? 0,
    sourceCounts,
    verifiedGreens: classifications["verified-green"],
    greenCandidates: classifications["green-candidate"],
    requiresDueDiligence: classifications["requires-due-diligence"],
    lowPriority: classifications["low-priority"],
    addedToday: deals.filter((deal) => isOnOrAfter(deal.postedAt, startOfToday)).length,
    addedThisWeek: deals.filter((deal) => isOnOrAfter(deal.postedAt, startOfWeek)).length,
    locationsCompletedInCurrentCycle: scanStatus?.locationsCompletedInCurrentCycle ?? 0,
    totalConfiguredLocations: scanStatus?.totalConfiguredLocations ?? 0,
  };
}

export function formatInventoryAuditReport(metrics: InventoryAuditMetrics) {
  return [
    "DealSignal inventory audit",
    `Generated: ${new Date().toISOString()}`,
    "",
    `Total deals: ${metrics.totalDeals}`,
    `Total imported deals: ${metrics.totalImportedDeals}`,
    `Rightmove deals: ${metrics.rightmoveDeals}`,
    `Acuitus deals: ${metrics.acuitusDeals}`,
    `Eddisons deals: ${metrics.eddisonsDeals}`,
    `Allsop deals: ${metrics.allsopDeals}`,
    ...Object.entries(metrics.sourceCounts ?? {})
      .filter(([source]) => ![RIGHTMOVE_COMMERCIAL_SOURCE, ACUITUS_SOURCE, EDDISONS_SOURCE, ALLSOP_SOURCE].includes(source))
      .map(([source, count]) => `${source} deals: ${count}`),
    `Top Opportunities: ${metrics.verifiedGreens}`,
    `Strong Opportunities: ${metrics.greenCandidates}`,
    `Requires Due Diligence: ${metrics.requiresDueDiligence}`,
    `Low Priority: ${metrics.lowPriority}`,
    `Added today: ${metrics.addedToday}`,
    `Added this week: ${metrics.addedThisWeek}`,
    `Locations completed in current scan cycle: ${metrics.locationsCompletedInCurrentCycle}/${metrics.totalConfiguredLocations || "unknown"}`,
  ].join("\n");
}

function isImportedDeal(deal: Deal) {
  return Boolean(deal.isImported || deal.importSourceName);
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfLocalWeek(date: Date) {
  const start = startOfLocalDay(date);
  const day = start.getDay();
  const offset = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - offset);
  return start;
}

function isOnOrAfter(value: string | undefined, threshold: Date) {
  if (!value) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date >= threshold;
}
