import { useQuery } from "@tanstack/react-query";
import { mapDealRow } from "@/lib/supabase/mappers";
import { buildEnrichmentImpactReport, type EnrichmentImpactReport, type EnrichmentImpactRow } from "@/lib/enrichmentImpact";
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
  enrichmentMetrics: EnrichmentMetrics;
  enrichmentImpact: EnrichmentImpactReport;
  locationsCompletedInCurrentCycle: number;
  lastSuccessfulScanDurationMs: number;
  lastScanInsertedCount: number;
};

export type EnrichmentMetrics = {
  total: number;
  enriched: number;
  failed: number;
  pending: number;
  queueSize: number;
  successRate: number;
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
const EMPTY_ENRICHMENT_METRICS: EnrichmentMetrics = { total: 0, enriched: 0, failed: 0, pending: 0, queueSize: 0, successRate: 0 };
const EMPTY_ENRICHMENT_IMPACT = buildEnrichmentImpactReport([]);

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
      const enrichmentMetrics = await withTimeout(
        loadEnrichmentMetrics(supabase, Object.values(sourceCounts).reduce((total, count) => total + count, 0)),
        6000,
        EMPTY_ENRICHMENT_METRICS,
        "deal enrichment metrics"
      );
      const enrichmentImpact = await withTimeout(
        loadEnrichmentImpact(supabase),
        8000,
        EMPTY_ENRICHMENT_IMPACT,
        "deal enrichment impact"
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
        enrichmentMetrics,
        enrichmentImpact,
        locationsCompletedInCurrentCycle: totalConfiguredLocations > 0 && nextIndex === 0 ? totalConfiguredLocations : nextIndex,
        lastSuccessfulScanDurationMs: scanDurationMs(row.started_at, row.finished_at),
        lastScanInsertedCount: Number(row.inserted ?? 0),
      };
    },
  });
}

async function loadEnrichmentImpact(supabase: ReturnType<typeof requireSupabase>): Promise<EnrichmentImpactReport> {
  const enrichments = await loadAllRows<{
    id: string;
    deal_id: string;
    source_url: string | null;
    status: string;
    tenant_name: string | null;
    passing_rent: number | null;
    lease_length: number | null;
    wault: number | null;
    epc_rating: string | null;
    sqft: number | null;
    guide_price: number | null;
    auction_info: Record<string, unknown> | null;
    vat_info: string | null;
    investment_summary: string | null;
  }>(supabase, "deal_enrichments", "id,deal_id,source_url,status,tenant_name,passing_rent,lease_length,wault,epc_rating,sqft,guide_price,auction_info,vat_info,investment_summary");
  if (enrichments.length === 0) return EMPTY_ENRICHMENT_IMPACT;

  const dealIds = [...new Set(enrichments.map((row) => row.deal_id).filter(Boolean))];
  const [dealRows, sourceLinks] = await Promise.all([
    loadRowsByDealId(supabase, "deals", "*", "id", dealIds),
    loadRowsByDealId(supabase, "deal_source_links", "deal_id,source_url,import_sources(name,source_type),raw_imports(normalized_payload)", "deal_id", dealIds),
  ]);
  const dealsById = new Map(dealRows.map((row) => [String(row.id), row]));
  const linksByDealId = new Map<string, unknown>();
  for (const link of sourceLinks) {
    if (!linksByDealId.has(String(link.deal_id))) linksByDealId.set(String(link.deal_id), link);
  }

  const rows: EnrichmentImpactRow[] = [];
  for (const enrichment of enrichments) {
    const dealRow = dealsById.get(enrichment.deal_id);
    if (!dealRow) continue;
    const link = linksByDealId.get(enrichment.deal_id) as Record<string, unknown> | undefined;
    const importSource = (Array.isArray(link?.import_sources) ? link?.import_sources[0] : link?.import_sources) as Record<string, unknown> | undefined;
    const rawImport = (Array.isArray(link?.raw_imports) ? link?.raw_imports[0] : link?.raw_imports) as Record<string, unknown> | undefined;
    rows.push({
      deal: mapDealRow(dealRow as Parameters<typeof mapDealRow>[0], {
        sourceUrl: String(link?.source_url ?? enrichment.source_url ?? ""),
        importSourceName: typeof importSource?.name === "string" ? importSource.name : undefined,
        importSourceType: typeof importSource?.source_type === "string" ? importSource.source_type : undefined,
        enrichment: {
          id: enrichment.id,
          deal_id: enrichment.deal_id,
          source_url: enrichment.source_url,
          status: enrichment.status,
          attempt_count: 0,
          last_attempted_at: null,
          next_attempt_at: null,
          last_error: null,
          tenant_name: enrichment.tenant_name,
          passing_rent: enrichment.passing_rent,
          lease_length: enrichment.lease_length,
          wault: enrichment.wault,
          epc_rating: enrichment.epc_rating,
          sqft: enrichment.sqft,
          guide_price: enrichment.guide_price,
          auction_info: enrichment.auction_info ?? {},
          vat_info: enrichment.vat_info,
          investment_summary: enrichment.investment_summary,
          extracted_payload: {},
          created_at: "",
          updated_at: "",
        },
      }),
      sourceName: typeof importSource?.name === "string" ? importSource.name : "",
      normalizedPayload: rawImport?.normalized_payload as Record<string, unknown> | undefined,
      enrichment: {
        status: enrichment.status,
        tenantName: enrichment.tenant_name,
        passingRent: enrichment.passing_rent,
        leaseLength: enrichment.lease_length,
        wault: enrichment.wault,
        epcRating: enrichment.epc_rating,
        sqft: enrichment.sqft,
        guidePrice: enrichment.guide_price,
        auctionInfo: enrichment.auction_info,
        vatInfo: enrichment.vat_info,
        investmentSummary: enrichment.investment_summary,
      },
    });
  }
  return buildEnrichmentImpactReport(rows);
}

async function loadAllRows<T>(supabase: ReturnType<typeof requireSupabase>, table: string, select: string): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function loadRowsByDealId<T extends Record<string, unknown>>(supabase: ReturnType<typeof requireSupabase>, table: string, select: string, column: string, dealIds: string[]): Promise<T[]> {
  const rows: T[] = [];
  const chunkSize = 150;
  for (let index = 0; index < dealIds.length; index += chunkSize) {
    const chunk = dealIds.slice(index, index + chunkSize);
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .in(column, chunk);
    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
  }
  return rows;
}

async function loadEnrichmentMetrics(supabase: ReturnType<typeof requireSupabase>, estimatedImportedCandidates = 0): Promise<EnrichmentMetrics> {
  const { data, error } = await supabase
    .from("deal_enrichments")
    .select("status,next_attempt_at");
  if (error) throw error;
  const now = Date.now();
  const total = data?.length ?? 0;
  const enriched = (data ?? []).filter((row) => row.status === "enriched").length;
  const failed = (data ?? []).filter((row) => row.status === "failed").length;
  const pending = (data ?? []).filter((row) => row.status === "pending").length;
  const dueRetryRows = (data ?? []).filter((row) => {
    if (row.status === "enriched") return false;
    const nextMs = row.next_attempt_at ? new Date(row.next_attempt_at).getTime() : 0;
    return !Number.isFinite(nextMs) || nextMs <= now;
  }).length;
  const neverAttemptedEstimate = Math.max(0, estimatedImportedCandidates - enriched - failed - pending);
  return {
    total,
    enriched,
    failed,
    pending,
    queueSize: Math.max(dueRetryRows, neverAttemptedEstimate + dueRetryRows),
    successRate: total > 0 ? Math.round((enriched / total) * 1000) / 10 : 0,
  };
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
