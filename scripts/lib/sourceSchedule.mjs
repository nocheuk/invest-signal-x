export const SOURCE_GROUPS = {
  RIGHTMOVE: "rightmove",
  DYNAMIC: "dynamic",
  STATIC: "static",
  PROBLEMATIC: "problematic",
};

export const SOURCE_SCHEDULES = [
  {
    key: "rightmove",
    sourceName: "Rightmove Commercial",
    group: SOURCE_GROUPS.RIGHTMOVE,
    alwaysRun: true,
    minHoursBetweenRuns: 0,
    blockedBackoffDays: 0,
  },
  {
    key: "allsop",
    sourceName: "Allsop",
    group: SOURCE_GROUPS.DYNAMIC,
    minHoursBetweenRuns: 12,
    blockedBackoffDays: 3,
  },
  {
    key: "pugh",
    sourceName: "Pugh Auctions",
    group: SOURCE_GROUPS.DYNAMIC,
    minHoursBetweenRuns: 12,
    blockedBackoffDays: 3,
  },
  {
    key: "savills",
    sourceName: "Savills Commercial",
    group: SOURCE_GROUPS.DYNAMIC,
    minHoursBetweenRuns: 12,
    blockedBackoffDays: 3,
  },
  {
    key: "eddisons",
    sourceName: "Eddisons",
    group: SOURCE_GROUPS.DYNAMIC,
    minHoursBetweenRuns: 12,
    blockedBackoffDays: 3,
  },
  {
    key: "sdl",
    sourceName: "SDL Property Auctions",
    group: SOURCE_GROUPS.DYNAMIC,
    minHoursBetweenRuns: 24,
    blockedBackoffDays: 3,
  },
  {
    key: "lsh",
    sourceName: "Lambert Smith Hampton",
    group: SOURCE_GROUPS.DYNAMIC,
    minHoursBetweenRuns: 24,
    blockedBackoffDays: 3,
  },
  {
    key: "acuitus",
    sourceName: "Acuitus",
    group: SOURCE_GROUPS.STATIC,
    minHoursBetweenRuns: 24,
    blockedBackoffDays: 3,
  },
  {
    key: "zoopla",
    sourceName: "Zoopla Commercial",
    group: SOURCE_GROUPS.PROBLEMATIC,
    minHoursBetweenRuns: 168,
    blockedBackoffDays: 7,
  },
  {
    key: "goadsby",
    sourceName: "Goadsby Commercial",
    group: SOURCE_GROUPS.PROBLEMATIC,
    minHoursBetweenRuns: 168,
    blockedBackoffDays: 7,
  },
  {
    key: "bondWolfe",
    sourceName: "Bond Wolfe",
    group: SOURCE_GROUPS.PROBLEMATIC,
    minHoursBetweenRuns: 168,
    blockedBackoffDays: 7,
  },
  {
    key: "fisherGerman",
    sourceName: "Fisher German Commercial",
    group: SOURCE_GROUPS.PROBLEMATIC,
    minHoursBetweenRuns: 168,
    blockedBackoffDays: 7,
  },
];

const BLOCKED_PATTERN = /anti-bot|blocked|403|cloudflare|access denied|forbidden|could not be parsed|challenge-platform/i;

export function getSourceSchedule(sourceNameOrKey) {
  const normalized = normalizeScheduleKey(sourceNameOrKey);
  return SOURCE_SCHEDULES.find((schedule) => (
    normalizeScheduleKey(schedule.key) === normalized ||
    normalizeScheduleKey(schedule.sourceName) === normalized
  )) ?? {
    key: normalized,
    sourceName: String(sourceNameOrKey ?? ""),
    group: SOURCE_GROUPS.DYNAMIC,
    minHoursBetweenRuns: 24,
    blockedBackoffDays: 3,
  };
}

export function buildSourceScheduleState({
  sourceName,
  scanRuns = [],
  now = new Date(),
  force = false,
} = {}) {
  const schedule = getSourceSchedule(sourceName);
  const sourceRuns = scanRuns
    .filter((run) => normalizeScheduleKey(run.sourceName) === normalizeScheduleKey(schedule.sourceName))
    .sort((a, b) => scanTime(b) - scanTime(a));
  const lastRun = sourceRuns[0] ?? null;
  const lastSuccess = sourceRuns.find((run) => run.status === "completed" && run.finishedAt);
  const lastFailure = sourceRuns.find((run) => run.status === "failed" || isBlockedScanRun(run));
  const consecutiveFailures = countConsecutiveFailures(sourceRuns);
  const nowMs = dateMs(now);

  if (force || schedule.alwaysRun) {
    return {
      ...baseState(schedule, lastRun, lastSuccess, lastFailure, consecutiveFailures),
      due: true,
      reason: schedule.alwaysRun ? "Runs every scan" : "Forced scan",
      nextEligibleAt: now.toISOString(),
    };
  }

  if (lastFailure && isBlockedScanRun(lastFailure)) {
    const backoffHours = Math.max(1, Number(schedule.blockedBackoffDays ?? 3) * 24);
    const nextEligibleMs = scanTime(lastFailure) + hoursToMs(backoffHours);
    if (nowMs < nextEligibleMs) {
      return {
        ...baseState(schedule, lastRun, lastSuccess, lastFailure, consecutiveFailures),
        due: false,
        reason: `Blocked/backoff until ${new Date(nextEligibleMs).toISOString()}`,
        nextEligibleAt: new Date(nextEligibleMs).toISOString(),
      };
    }
  }

  if (lastSuccess && schedule.minHoursBetweenRuns > 0) {
    const nextEligibleMs = dateMs(lastSuccess.finishedAt) + hoursToMs(schedule.minHoursBetweenRuns);
    if (nowMs < nextEligibleMs) {
      return {
        ...baseState(schedule, lastRun, lastSuccess, lastFailure, consecutiveFailures),
        due: false,
        reason: `Cooldown until ${new Date(nextEligibleMs).toISOString()}`,
        nextEligibleAt: new Date(nextEligibleMs).toISOString(),
      };
    }
  }

  return {
    ...baseState(schedule, lastRun, lastSuccess, lastFailure, consecutiveFailures),
    due: true,
    reason: lastRun ? "Eligible now" : "No previous scan",
    nextEligibleAt: now.toISOString(),
  };
}

export function buildSourceSchedulePlan({
  sources = SOURCE_SCHEDULES.map((schedule) => schedule.sourceName),
  scanRuns = [],
  now = new Date(),
  force = false,
} = {}) {
  return sources.map((sourceName) => buildSourceScheduleState({ sourceName, scanRuns, now, force }));
}

export function isBlockedScanRun(run = {}) {
  const text = [
    run.errorMessage,
    run.error_message,
    run.error,
    run.status,
    run.result?.error,
  ].filter(Boolean).join(" ");
  return BLOCKED_PATTERN.test(text);
}

export function normalizeScheduleKey(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function baseState(schedule, lastRun, lastSuccess, lastFailure, consecutiveFailures) {
  return {
    key: schedule.key,
    sourceName: schedule.sourceName,
    group: schedule.group,
    minHoursBetweenRuns: schedule.minHoursBetweenRuns,
    blockedBackoffDays: schedule.blockedBackoffDays,
    lastRunAt: lastRun?.finishedAt ?? lastRun?.startedAt ?? null,
    lastSuccessfulScanAt: lastSuccess?.finishedAt ?? null,
    lastFailedScanAt: lastFailure?.finishedAt ?? lastFailure?.startedAt ?? null,
    consecutiveFailures,
    blocked: Boolean(lastFailure && isBlockedScanRun(lastFailure)),
  };
}

function countConsecutiveFailures(sourceRuns) {
  let total = 0;
  for (const run of sourceRuns) {
    if (run.status === "failed" || isBlockedScanRun(run)) total += 1;
    else break;
  }
  return total;
}

function scanTime(run) {
  return dateMs(run?.finishedAt ?? run?.startedAt);
}

function dateMs(value) {
  const ms = value instanceof Date ? value.getTime() : new Date(value ?? 0).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function hoursToMs(hours) {
  return Number(hours) * 60 * 60 * 1000;
}
