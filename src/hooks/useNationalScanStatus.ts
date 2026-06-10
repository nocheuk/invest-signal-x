import { useQuery } from "@tanstack/react-query";
import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase/client";
import {
  ACUITUS_SOURCE,
  ALLSOP_SOURCE,
  BOND_WOLFE_SOURCE,
  EDDISONS_SOURCE,
  FISHER_GERMAN_SOURCE,
  GOADSBY_SOURCE,
  LSH_SOURCE,
  PUGH_SOURCE,
  RIGHTMOVE_COMMERCIAL_SOURCE,
  SAVILLS_SOURCE,
  SDL_SOURCE,
  ZOOPLA_SOURCE,
} from "@/lib/dashboardFilters";

export type NationalScanStatus = {
  id: string;
  sourceName: string;
  locationQuery: string;
  startedAt: string;
  finishedAt: string | null;
  locationsScanned: string[];
  totalConfiguredLocations: number;
  nextIndex: number;
  estimatedFullCycleDays: number;
  scanCycleProgress: number;
  totalDeals: number;
  totalRightmoveDeals: number;
  totalAcuitusDeals: number;
  totalEddisonsDeals: number;
  totalAllsopDeals: number;
  totalGoadsbyDeals: number;
  totalZooplaDeals: number;
  totalSavillsDeals: number;
  totalSdlDeals: number;
  totalPughDeals: number;
  totalBondWolfeDeals: number;
  totalFisherGermanDeals: number;
  totalLshDeals: number;
  sourceDealCounts: Record<string, number>;
  sourceScanRuns: SourceScanRun[];
  locationsCompletedInCurrentCycle: number;
  lastSuccessfulScanDurationMs: number;
  lastScanInsertedCount: number;
};

export type SourceScanRun = {
  id: string;
  sourceName: string;
  locationQuery: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  inserted: number;
  existing: number;
  failed: number;
  skippedDuplicate: number;
  skippedRentOnly: number;
  skippedPoa: number;
  errorMessage: string | null;
};

export const nationalScanStatusQueryKey = ["national-scan-status"];
const SOURCE_MATCHERS = [
  { key: "rightmove", label: RIGHTMOVE_COMMERCIAL_SOURCE, patterns: ["rightmove"] },
  { key: "acuitus", label: ACUITUS_SOURCE, patterns: ["acuitus"] },
  { key: "eddisons", label: EDDISONS_SOURCE, patterns: ["eddisons"] },
  { key: "allsop", label: ALLSOP_SOURCE, patterns: ["allsop"] },
  { key: "goadsby", label: GOADSBY_SOURCE, patterns: ["goadsby"] },
  { key: "zoopla", label: ZOOPLA_SOURCE, patterns: ["zoopla"] },
  { key: "savills", label: SAVILLS_SOURCE, patterns: ["savills"] },
  { key: "sdl", label: SDL_SOURCE, patterns: ["sdl"] },
  { key: "pugh", label: PUGH_SOURCE, patterns: ["pugh"] },
  { key: "bondWolfe", label: BOND_WOLFE_SOURCE, patterns: ["bond wolfe", "bondwolfe"] },
  { key: "fisherGerman", label: FISHER_GERMAN_SOURCE, patterns: ["fisher german", "fishergerman"] },
  { key: "lsh", label: LSH_SOURCE, patterns: ["lambert smith hampton", "lsh"] },
] as const;
const EMPTY_SOURCE_COUNTS = Object.fromEntries(SOURCE_MATCHERS.map((source) => [source.key, 0])) as SourceCountMap;

type SourceCountMap = Record<(typeof SOURCE_MATCHERS)[number]["key"], number>;

export function useNationalScanStatus() {
  return useQuery({
    queryKey: nationalScanStatusQueryKey,
    enabled: isSupabaseConfigured,
    queryFn: async (): Promise<NationalScanStatus | null> => {
      const supabase = requireSupabase();
      const { data, error } = await supabase
        .from("national_scan_runs")
        .select("id,source_name,location_query,started_at,finished_at,metadata,inserted")
        .eq("status", "completed")
        .order("finished_at", { ascending: false })
        .limit(1);

      if (error) throw error;
      const row = data?.[0];
      if (!row) return null;
      const metadata = (row.metadata ?? {}) as Record<string, unknown>;
      const sourceCounts = await withTimeout(
        loadSourceDealCounts(supabase),
        8000,
        EMPTY_SOURCE_COUNTS,
        "national scan source counts"
      );
      const totalDeals = await withTimeout(
        loadTotalDealCount(supabase),
        5000,
        0,
        "national scan deal count"
      );
      const sourceScanRuns = await withTimeout(
        loadRecentSourceScanRuns(supabase),
        8000,
        [],
        "recent source scan runs"
      );
      const totalConfiguredLocations = Number(metadata.total_configured_locations ?? 0);
      const nextIndex = Number(metadata.next_index ?? 0);
      return {
        id: row.id,
        sourceName: row.source_name,
        locationQuery: row.location_query,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        locationsScanned: Array.isArray(metadata.locations_scanned) ? metadata.locations_scanned.map(String) : [row.location_query].filter(Boolean),
        totalConfiguredLocations,
        nextIndex,
        estimatedFullCycleDays: Number(metadata.estimated_full_cycle_days ?? 0),
        scanCycleProgress: Number(metadata.scan_cycle_progress ?? 0),
        totalDeals,
        totalRightmoveDeals: sourceCounts.rightmove,
        totalAcuitusDeals: sourceCounts.acuitus,
        totalEddisonsDeals: sourceCounts.eddisons,
        totalAllsopDeals: sourceCounts.allsop,
        totalGoadsbyDeals: sourceCounts.goadsby,
        totalZooplaDeals: sourceCounts.zoopla,
        totalSavillsDeals: sourceCounts.savills,
        totalSdlDeals: sourceCounts.sdl,
        totalPughDeals: sourceCounts.pugh,
        totalBondWolfeDeals: sourceCounts.bondWolfe,
        totalFisherGermanDeals: sourceCounts.fisherGerman,
        totalLshDeals: sourceCounts.lsh,
        sourceDealCounts: Object.fromEntries(SOURCE_MATCHERS.map((source) => [source.label, sourceCounts[source.key]])),
        sourceScanRuns,
        locationsCompletedInCurrentCycle: totalConfiguredLocations > 0 && nextIndex === 0 ? totalConfiguredLocations : nextIndex,
        lastSuccessfulScanDurationMs: scanDurationMs(row.started_at, row.finished_at),
        lastScanInsertedCount: Number(row.inserted ?? 0),
      };
    },
  });
}

async function loadRecentSourceScanRuns(supabase: ReturnType<typeof requireSupabase>): Promise<SourceScanRun[]> {
  const { data, error } = await supabase
    .from("national_scan_runs")
    .select("id,source_name,location_query,status,started_at,finished_at,inserted,existing,failed,skipped_duplicate,skipped_rent_only,skipped_poa,error_message")
    .order("started_at", { ascending: false })
    .limit(250);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    sourceName: String(row.source_name ?? ""),
    locationQuery: String(row.location_query ?? ""),
    status: String(row.status ?? ""),
    startedAt: String(row.started_at ?? ""),
    finishedAt: row.finished_at ?? null,
    inserted: Number(row.inserted ?? 0),
    existing: Number(row.existing ?? 0),
    failed: Number(row.failed ?? 0),
    skippedDuplicate: Number(row.skipped_duplicate ?? 0),
    skippedRentOnly: Number(row.skipped_rent_only ?? 0),
    skippedPoa: Number(row.skipped_poa ?? 0),
    errorMessage: row.error_message ?? null,
  }));
}

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`Timed out loading ${label}`);
      resolve(fallback);
    }, ms);
  });

  try {
    return await Promise.race([
      promise.catch((error) => {
        const message = errorMessage(error);
        console.warn(`Could not load ${label}`, message);
        return fallback;
      }),
      timeout,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String((error as { message: unknown }).message);
  return String(error);
}

async function loadTotalDealCount(supabase: ReturnType<typeof requireSupabase>) {
  const { count, error } = await supabase
    .from("deals")
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

async function loadSourceDealCounts(supabase: ReturnType<typeof requireSupabase>) {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("deal_source_links")
      .select("deal_id,source_url,import_sources(name)")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }

  const sets = Object.fromEntries(SOURCE_MATCHERS.map((source) => [source.key, new Set<string>()])) as Record<keyof SourceCountMap, Set<string>>;
  for (const row of rows) {
    const importSource = Array.isArray(row.import_sources) ? row.import_sources[0] : row.import_sources;
    const sourceText = sourceClassificationText({
      importSourceName: importSource?.name,
      sourceUrl: row.source_url,
    });
    for (const source of SOURCE_MATCHERS) {
      if (source.patterns.some((pattern) => sourceText.includes(pattern))) sets[source.key].add(row.deal_id);
    }
  }
  return Object.fromEntries(SOURCE_MATCHERS.map((source) => [source.key, sets[source.key].size])) as SourceCountMap;
}

function sourceClassificationText({
  importSourceName,
  sourceUrl,
}: {
  importSourceName?: unknown;
  sourceUrl?: unknown;
}) {
  return [
    importSourceName,
    sourceUrl,
  ].filter(Boolean).join(" ").toLowerCase();
}

function scanDurationMs(startedAt: string | null | undefined, finishedAt: string | null | undefined) {
  const started = startedAt ? new Date(startedAt).getTime() : 0;
  const finished = finishedAt ? new Date(finishedAt).getTime() : 0;
  if (!Number.isFinite(started) || !Number.isFinite(finished) || finished < started) return 0;
  return finished - started;
}

export function formatNationalScanTime(value: string | null | undefined) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(date);
}

export function formatScanDuration(value: number | null | undefined) {
  const ms = Math.max(0, Number(value) || 0);
  if (!ms) return "Not available";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}
