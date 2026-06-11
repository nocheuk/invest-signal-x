import type { SourceScanRun } from "@/hooks/useNationalScanStatus";
import { classifyDeal } from "@/lib/dealClassification";
import type { Deal } from "@/lib/deals";
import { IMPORT_SOURCE_OPTIONS, normalizeSourceLabel, sourceLabel } from "@/lib/dashboardFilters";

export type SourceHealthStatus = "Healthy" | "Warning" | "Blocked" | "Disabled";
export type InvestorSourceStatus = "Active" | "Monitoring" | "Limited data" | "Updating soon";

export type SourceHealthRow = {
  source: string;
  status: SourceHealthStatus;
  scheduleGroup: "rightmove" | "dynamic" | "static" | "problematic";
  isDue: boolean;
  nextEligibleScanAt: string | null;
  cooldownReason: string;
  consecutiveFailures: number;
  totalImportedDeals: number;
  newDealsToday: number;
  lastSuccessfulScan: string | null;
  lastScanDurationMs: number;
  lastInsertedCount: number;
  lastStatus: string | null;
  lastError: string | null;
  inventoryContributionPct: number;
  topOpportunityCount: number;
  strongOpportunityCount: number;
  warningReasons: string[];
};

export function buildSourceHealth({
  deals,
  scanRuns = [],
  now = new Date(),
  sources = IMPORT_SOURCE_OPTIONS,
}: {
  deals: Deal[];
  scanRuns?: SourceScanRun[];
  now?: Date;
  sources?: readonly string[];
}): SourceHealthRow[] {
  const importedDeals = deals.filter((deal) => deal.isImported || deal.importSourceName);
  const today = startOfLocalDay(now);

  return sources.map((source) => {
    const sourceDeals = importedDeals.filter((deal) => sourceLabel(deal) === source);
    const sourceRuns = scanRuns.filter((run) => normalizeSourceLabel(run.sourceName) === source);
    const lastRun = sourceRuns[0] ?? null;
    const lastSuccess = sourceRuns.find((run) => run.status === "completed" && run.finishedAt);
    const warningReasons = buildWarningReasons({ sourceDeals, sourceRuns, lastRun });
    const scheduleState = buildUiSourceScheduleState({ source, sourceRuns, now });

    return {
      source,
      status: classifySourceStatus({ sourceDeals, sourceRuns, lastRun }),
      scheduleGroup: scheduleState.group,
      isDue: scheduleState.due,
      nextEligibleScanAt: scheduleState.nextEligibleAt,
      cooldownReason: scheduleState.reason,
      consecutiveFailures: scheduleState.consecutiveFailures,
      totalImportedDeals: sourceDeals.length,
      newDealsToday: sourceDeals.filter((deal) => isOnOrAfter(deal.postedAt, today)).length,
      lastSuccessfulScan: lastSuccess?.finishedAt ?? null,
      lastScanDurationMs: scanDurationMs(lastSuccess?.startedAt, lastSuccess?.finishedAt),
      lastInsertedCount: Number(lastSuccess?.inserted ?? 0),
      lastStatus: lastRun?.status ?? null,
      lastError: lastRun?.errorMessage ?? null,
      inventoryContributionPct: importedDeals.length ? Math.round((sourceDeals.length / importedDeals.length) * 1000) / 10 : 0,
      topOpportunityCount: countClassification(sourceDeals, "verified-green"),
      strongOpportunityCount: countClassification(sourceDeals, "green-candidate"),
      warningReasons,
    };
  });
}

export function summarizeSourceHealth(rows: SourceHealthRow[]) {
  return rows.reduce((summary, row) => {
    summary[row.status] += 1;
    return summary;
  }, {
    Healthy: 0,
    Warning: 0,
    Blocked: 0,
    Disabled: 0,
  } satisfies Record<SourceHealthStatus, number>);
}

export function investorSourceStatus(row: SourceHealthRow): InvestorSourceStatus {
  if (row.totalImportedDeals > 0 && row.status === "Healthy") return "Active";
  if (row.totalImportedDeals > 0) return "Limited data";
  if (row.status === "Blocked" || row.scheduleGroup === "problematic") return "Updating soon";
  return "Monitoring";
}

export function splitInvestorSourceRows(rows: SourceHealthRow[]) {
  return {
    visibleRows: rows.filter((row) => row.totalImportedDeals > 0),
    monitoredRows: rows.filter((row) => row.totalImportedDeals === 0),
  };
}

function classifySourceStatus({
  sourceDeals,
  sourceRuns,
  lastRun,
}: {
  sourceDeals: Deal[];
  sourceRuns: SourceScanRun[];
  lastRun: SourceScanRun | null;
}): SourceHealthStatus {
  if (!sourceRuns.length && sourceDeals.length === 0) return "Disabled";
  if (lastRun && isBlockedRun(lastRun)) return "Blocked";
  if (lastRun && lastRun.status === "failed") return "Warning";
  if (lastRun && lastRun.status === "completed" && sourceDeals.length === 0) return "Warning";
  if (lastRun && lastRun.status === "completed" && lastRun.inserted === 0 && lastRun.existing === 0) return "Warning";
  return "Healthy";
}

function buildWarningReasons({
  sourceDeals,
  sourceRuns,
  lastRun,
}: {
  sourceDeals: Deal[];
  sourceRuns: SourceScanRun[];
  lastRun: SourceScanRun | null;
}) {
  const reasons: string[] = [];
  if (!sourceRuns.length) reasons.push("No scan run recorded");
  if (sourceDeals.length === 0) reasons.push("No imported inventory");
  if (lastRun?.status === "failed") reasons.push("Latest scan failed");
  if (lastRun && isBlockedRun(lastRun)) reasons.push("Anti-bot or access block detected");
  if (lastRun?.status === "completed" && lastRun.inserted === 0 && lastRun.existing === 0) reasons.push("Latest scan returned 0 usable results");
  return reasons;
}

function isBlockedRun(run: SourceScanRun) {
  const text = [run.errorMessage, run.status].filter(Boolean).join(" ").toLowerCase();
  return /anti-bot|blocked|403|cloudflare|access denied|forbidden|could not be parsed/.test(text);
}

type UiSourceSchedule = {
  source: string;
  group: SourceHealthRow["scheduleGroup"];
  minHoursBetweenRuns: number;
  blockedBackoffDays: number;
  alwaysRun?: boolean;
};

const UI_SOURCE_SCHEDULES: UiSourceSchedule[] = [
  { source: "Rightmove Commercial", group: "rightmove", minHoursBetweenRuns: 0, blockedBackoffDays: 0, alwaysRun: true },
  { source: "Allsop", group: "dynamic", minHoursBetweenRuns: 12, blockedBackoffDays: 3 },
  { source: "Pugh Auctions", group: "dynamic", minHoursBetweenRuns: 12, blockedBackoffDays: 3 },
  { source: "Savills Commercial", group: "dynamic", minHoursBetweenRuns: 12, blockedBackoffDays: 3 },
  { source: "Eddisons", group: "dynamic", minHoursBetweenRuns: 12, blockedBackoffDays: 3 },
  { source: "SDL Property Auctions", group: "dynamic", minHoursBetweenRuns: 24, blockedBackoffDays: 3 },
  { source: "Lambert Smith Hampton", group: "dynamic", minHoursBetweenRuns: 24, blockedBackoffDays: 3 },
  { source: "Acuitus", group: "static", minHoursBetweenRuns: 24, blockedBackoffDays: 3 },
  { source: "Zoopla Commercial", group: "problematic", minHoursBetweenRuns: 168, blockedBackoffDays: 7 },
  { source: "Goadsby Commercial", group: "problematic", minHoursBetweenRuns: 168, blockedBackoffDays: 7 },
  { source: "Bond Wolfe", group: "problematic", minHoursBetweenRuns: 168, blockedBackoffDays: 7 },
  { source: "Fisher German Commercial", group: "problematic", minHoursBetweenRuns: 168, blockedBackoffDays: 7 },
];

function buildUiSourceScheduleState({ source, sourceRuns, now }: { source: string; sourceRuns: SourceScanRun[]; now: Date }) {
  const schedule = UI_SOURCE_SCHEDULES.find((item) => item.source === source) ?? {
    source,
    group: "dynamic" as const,
    minHoursBetweenRuns: 24,
    blockedBackoffDays: 3,
  };
  const sortedRuns = [...sourceRuns].sort((a, b) => runMs(b) - runMs(a));
  const lastRun = sortedRuns[0] ?? null;
  const lastSuccess = sortedRuns.find((run) => run.status === "completed" && run.finishedAt);
  const lastFailure = sortedRuns.find((run) => run.status === "failed" || isBlockedRun(run));
  const consecutiveFailures = countConsecutiveFailures(sortedRuns);

  if (schedule.alwaysRun) {
    return {
      group: schedule.group,
      due: true,
      nextEligibleAt: now.toISOString(),
      reason: "Runs every scan",
      consecutiveFailures,
    };
  }

  if (lastFailure && isBlockedRun(lastFailure)) {
    const nextEligibleAt = new Date(runMs(lastFailure) + schedule.blockedBackoffDays * 24 * 60 * 60 * 1000);
    if (now.getTime() < nextEligibleAt.getTime()) {
      return {
        group: schedule.group,
        due: false,
        nextEligibleAt: nextEligibleAt.toISOString(),
        reason: "Blocked backoff",
        consecutiveFailures,
      };
    }
  }

  if (lastSuccess && schedule.minHoursBetweenRuns > 0) {
    const nextEligibleAt = new Date(new Date(lastSuccess.finishedAt).getTime() + schedule.minHoursBetweenRuns * 60 * 60 * 1000);
    if (now.getTime() < nextEligibleAt.getTime()) {
      return {
        group: schedule.group,
        due: false,
        nextEligibleAt: nextEligibleAt.toISOString(),
        reason: "Cooldown",
        consecutiveFailures,
      };
    }
  }

  return {
    group: schedule.group,
    due: true,
    nextEligibleAt: now.toISOString(),
    reason: lastRun ? "Eligible now" : "No previous scan",
    consecutiveFailures,
  };
}

function countConsecutiveFailures(sourceRuns: SourceScanRun[]) {
  let total = 0;
  for (const run of sourceRuns) {
    if (run.status === "failed" || isBlockedRun(run)) total += 1;
    else break;
  }
  return total;
}

function runMs(run: SourceScanRun) {
  const value = run.finishedAt ?? run.startedAt;
  const ms = value ? new Date(value).getTime() : 0;
  return Number.isFinite(ms) ? ms : 0;
}

function countClassification(deals: Deal[], classification: "verified-green" | "green-candidate") {
  return deals.filter((deal) => classifyDeal(deal) === classification).length;
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isOnOrAfter(value: string | undefined, threshold: Date) {
  if (!value) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date >= threshold;
}

function scanDurationMs(startedAt: string | null | undefined, finishedAt: string | null | undefined) {
  const started = startedAt ? new Date(startedAt).getTime() : 0;
  const finished = finishedAt ? new Date(finishedAt).getTime() : 0;
  if (!Number.isFinite(started) || !Number.isFinite(finished) || finished < started) return 0;
  return finished - started;
}
