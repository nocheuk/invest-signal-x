import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { ASSET_TYPES, REGIONS, formatPct, type Rating } from "@/lib/deals";
import { DealCard } from "@/components/DealCard";
import { DealRow } from "@/components/DealRow";
import { PIPELINE_STATUSES, type PipelineStatus, useWatchlist } from "@/lib/watchlist";
import { useStrategy, personalisedScore } from "@/lib/strategy";
import { useDeals } from "@/hooks/useDeals";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/hooks/useProfile";
import { useSavedSearches, type SavedSearchFilters } from "@/hooks/useSavedSearches";
import { useSavedAlerts, type SavedAlert, type SaveAlertInput } from "@/hooks/useSavedAlerts";
import { LocationImportError, useLocationImport, type LocationImportResult } from "@/hooks/useLocationImport";
import { formatNationalScanTime, formatScanDuration, useNationalScanStatus } from "@/hooks/useNationalScanStatus";
import { buildInventoryAudit, formatInventoryAuditReport } from "@/lib/inventoryAudit";
import { buildDashboardKpis } from "@/lib/dashboardKpis";
import { buildFreshnessMetrics, filterByFreshness, formatImportDate, type FreshnessFilter, sortNewestDeals } from "@/lib/freshness";
import { ClassificationBadge } from "@/components/RatingBadge";
import { classifyDeal } from "@/lib/dealClassification";
import { StrategyControl } from "@/components/StrategyControl";
import { StrategyOptimiserModal } from "@/components/StrategyOptimiserModal";
import { Activity, Target, TrendingUp, Bookmark, Sparkles, ArrowUpRight, Filter, Search, Save, Bell, Pencil, Trash2, FileText, CalendarDays, Clock3, RadioTower } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Hint } from "@/components/Hint";
import { cn } from "@/lib/utils";
import { ALL_REAL_DEALS_FILTER, buildSourceOptions, DEMO_SOURCE_FILTER, filterAndSortDeals, isSeedDeal, sourceLabel as getSourceLabel } from "@/lib/dashboardFilters";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { defaultAlertName } from "@/lib/alerts";
import { isAdminUser } from "@/lib/admin";

const EMPTY_DEALS = [];

export default function Dashboard() {
  const { ids, pipelineItems, pipelineCounts } = useWatchlist();
  const { weights } = useStrategy();
  const dealsQuery = useDeals();
  const auth = useAuth();
  const profile = useProfile();
  const savedSearches = useSavedSearches();
  const savedAlerts = useSavedAlerts();
  const locationImport = useLocationImport();
  const nationalScanStatus = useNationalScanStatus();
  const [searchParams] = useSearchParams();
  const fetchedDeals = dealsQuery.data ?? EMPTY_DEALS;
  const deals = useMemo(() => (
    isSupabaseConfigured ? fetchedDeals.filter((deal) => !isSeedDeal(deal)) : fetchedDeals
  ), [fetchedDeals]);
  const search = searchParams.get("q") ?? "";
  const firstName = (profile.data?.full_name || auth.user?.user_metadata?.full_name || auth.user?.email || "there").split(/\s|@/)[0];
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [region, setRegion] = useState("All UK");
  const [asset, setAsset] = useState<string>("All");
  const [minYield, setMinYield] = useState(0);
  const [maxPrice, setMaxPrice] = useState(0);
  const [locationQuery, setLocationQuery] = useState("");
  const [rating, setRating] = useState<"all" | Rating | "verified-green" | "green-candidate">("all");
  const [confidence, setConfidence] = useState<"all" | "high" | "medium" | "low">("all");
  const [pipelineStatus, setPipelineStatus] = useState<"all" | PipelineStatus>("all");
  const [source, setSource] = useState(isSupabaseConfigured ? ALL_REAL_DEALS_FILTER : "All");
  const [sort, setSort] = useState<"score" | "yield" | "price" | "confidence" | "newest">("score");
  const [freshnessFilter, setFreshnessFilter] = useState<FreshnessFilter>("all");
  const [locationImportResult, setLocationImportResult] = useState<LocationImportResult | null>(null);
  const [editingAlertId, setEditingAlertId] = useState<string | null>(null);
  const [editingAlert, setEditingAlert] = useState<SaveAlertInput | null>(null);
  const [inventoryReport, setInventoryReport] = useState("");

  const currentFilterScope = useMemo(() => {
    return filterAndSortDeals(deals, { region, asset, source, rating: "all", confidence, minYield, maxPrice, search, locationQuery, sort }, weights);
  }, [deals, region, asset, source, minYield, maxPrice, confidence, search, locationQuery, sort, weights]);

  const kpis = useMemo(() => {
    return buildDashboardKpis({
      allDeals: deals,
      filteredDeals: currentFilterScope,
      watchlistIds: ids,
      pipelineCounts,
      totalDatabaseDeals: nationalScanStatus.data?.totalDeals,
    });
  }, [currentFilterScope, deals, ids, pipelineCounts, nationalScanStatus.data?.totalDeals]);
  const now = useMemo(() => new Date(), []);
  const freshnessKpis = useMemo(() => buildFreshnessMetrics(currentFilterScope, now), [currentFilterScope, now]);

  const filtered = useMemo(() => {
    const base = filterAndSortDeals(deals, { region, asset, source, rating, confidence, minYield, maxPrice, search, locationQuery, sort }, weights);
    const fresh = filterByFreshness(base, freshnessFilter, now);
    if (pipelineStatus === "all") return fresh;
    return fresh.filter((deal) => pipelineItems[deal.id]?.status === pipelineStatus);
  }, [deals, region, asset, source, minYield, maxPrice, rating, confidence, search, locationQuery, sort, weights, freshnessFilter, now, pipelineStatus, pipelineItems]);

  const best = useMemo(() => [...filtered].sort((a, b) => personalisedScore(b, weights) - personalisedScore(a, weights)).slice(0, 3), [filtered, weights]);
  const sourceOptions = useMemo(() => {
    const options = buildSourceOptions(deals);
    return isSupabaseConfigured ? options.filter((option) => option !== DEMO_SOURCE_FILTER && option !== "All") : options;
  }, [deals]);
  const needsReview = useMemo(() => filtered.filter((deal) => deal.needsReview || (deal.isImported && deal.score <= 45)), [filtered]);
  const recentlyAdded = useMemo(() => sortNewestDeals(filtered.filter((deal) => deal.isImported || deal.importSourceName)).slice(0, 5), [filtered]);
  const pipelineAnalytics = useMemo(() => ({
    totalSaved: ids.length,
    activeOpportunities: pipelineCounts.Reviewing + pipelineCounts["Viewing Booked"] + pipelineCounts["Offer Submitted"],
    offersSubmitted: pipelineCounts["Offer Submitted"],
    purchased: pipelineCounts.Purchased,
  }), [ids.length, pipelineCounts]);
  const canShowDiagnostics = import.meta.env.DEV || isAdminUser(auth.user);
  const showDebugCounts = canShowDiagnostics;
  const inventoryAudit = useMemo(() => buildInventoryAudit({ deals, scanStatus: nationalScanStatus.data }), [deals, nationalScanStatus.data]);
  const hasLocationFilter = locationQuery.trim().length > 0;
  const showLocationSearchCta = isSupabaseConfigured && hasLocationFilter && filtered.length < 3;
  const canRunLiveLocationSearch = Boolean(auth.user && auth.session?.access_token);
  const canShowLocationSearchDebug = canShowDiagnostics;
  const locationImportErrorDetail = locationImport.error instanceof LocationImportError ? locationImport.error.detail : undefined;
  const locationImportDiagnostics = locationImport.error instanceof LocationImportError ? locationImport.error.diagnostics : undefined;

  const currentSavedFilters: SavedSearchFilters = { locationQuery, source, asset, minYield, maxPrice };
  const currentAlertCriteria: SaveAlertInput = {
    name: defaultAlertName({
      locationQuery,
      assetType: asset,
      minYield,
      maxPrice,
      minScore: rating === "verified-green" ? 78 : rating === "green-candidate" ? 72 : rating === "amber" ? 60 : 0,
    }),
    locationQuery: locationQuery.trim(),
    minYield,
    maxPrice,
    assetType: asset,
    minScore: rating === "verified-green" ? 78 : rating === "green-candidate" ? 72 : rating === "amber" ? 60 : 0,
    enabled: true,
  };
  const saveLocationSearch = async () => {
    if (!locationQuery.trim()) return;
    await savedSearches.saveSearch({
      name: `${locationQuery.trim()}${source !== "All" ? ` - ${source}` : ""}`,
      filters: currentSavedFilters,
    });
  };
  const applySavedSearch = (filters: SavedSearchFilters) => {
    setLocationQuery(filters.locationQuery);
    setSource(filters.source || "All");
    setAsset(filters.asset || "All");
    setMinYield(filters.minYield || 0);
    setMaxPrice(filters.maxPrice || 0);
  };
  const createAlertFromFilters = async () => {
    await savedAlerts.saveAlert(currentAlertCriteria);
  };
  const startEditingAlert = (alert: SavedAlert) => {
    setEditingAlertId(alert.id);
    setEditingAlert({
      id: alert.id,
      name: alert.name,
      locationQuery: alert.locationQuery,
      minYield: alert.minYield,
      maxPrice: alert.maxPrice,
      assetType: alert.assetType,
      minScore: alert.minScore,
      enabled: alert.enabled,
    });
  };
  const saveEditedAlert = async () => {
    if (!editingAlert) return;
    await savedAlerts.saveAlert(editingAlert);
    setEditingAlertId(null);
    setEditingAlert(null);
  };
  const toggleAlert = async (alert: SavedAlert) => {
    await savedAlerts.saveAlert({ ...alertToInput(alert), enabled: !alert.enabled });
  };
  const runLiveLocationSearch = async () => {
    if (!locationQuery.trim()) return;
    setLocationImportResult(null);
    try {
      const result = await locationImport.mutateAsync({ locationQuery: locationQuery.trim() });
      setLocationImportResult(result);
    } catch {
      // The mutation state renders the user-facing error message.
    }
  };
  const generateInventoryReport = () => {
    setInventoryReport(formatInventoryAuditReport(inventoryAudit));
  };

  return (
    <AppLayout>
      <div className="container max-w-7xl py-8 space-y-8">
        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-primary font-medium">Dashboard</div>
            <h1 className="font-display text-4xl mt-1">Good morning, {firstName}.</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {dealsQuery.isLoading ? "Loading live opportunities." : `${filtered.length} matching ${filtered.length === 1 ? "deal" : "deals"} from real imported data.`}
            </p>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Kpi
            label="Filtered deals"
            value={kpis.filteredDeals.toLocaleString()}
            icon={Activity}
            accent="text-foreground"
            sub={`${kpis.totalDatabaseDeals.toLocaleString()} total DB · ${kpis.importedDeals.toLocaleString()} imported · ${kpis.withGuidePrice.toLocaleString()} priced`}
          />
          <Kpi
            label="Verified Green"
            value={kpis.verifiedGreens.toString()}
            icon={Target}
            accent="text-signal-green"
            sub="from current"
            onClick={() => setRating("verified-green")}
            active={rating === "verified-green"}
            ariaLabel={`Show ${kpis.verifiedGreens} verified green deals from current filters`}
          />
          <Kpi
            label="Green Candidates"
            value={kpis.greenCandidates.toString()}
            icon={Sparkles}
            accent="text-primary"
            sub="high-potential"
            onClick={() => setRating("green-candidate")}
            active={rating === "green-candidate"}
            ariaLabel={`Show ${kpis.greenCandidates} green candidate deals from current filters`}
          />
          <Kpi
            label="Average yield (NIY)"
            value={formatPct(kpis.averageYield, 2)}
            icon={TrendingUp}
            accent="text-foreground"
            sub={kpis.yieldSampleSize ? `NIY from ${kpis.yieldSampleSize.toLocaleString()} deals` : "No yield samples"}
          />
          <Kpi
            label="Watchlisted deals"
            value={kpis.watchlistedDeals.toString()}
            icon={Bookmark}
            accent="text-foreground"
            sub={`${kpis.activeWatchlistDeals.toLocaleString()} active opportunities`}
          />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi
            label="New Today"
            value={freshnessKpis.newToday.toLocaleString()}
            icon={Clock3}
            accent="text-primary"
            sub="imported in 24h"
            onClick={() => setFreshnessFilter(freshnessFilter === "today" ? "all" : "today")}
            active={freshnessFilter === "today"}
            ariaLabel={`Show ${freshnessKpis.newToday} deals imported today`}
          />
          <Kpi
            label="New This Week"
            value={freshnessKpis.newThisWeek.toLocaleString()}
            icon={CalendarDays}
            accent="text-foreground"
            sub="imported in 7d"
            onClick={() => setFreshnessFilter(freshnessFilter === "week" ? "all" : "week")}
            active={freshnessFilter === "week"}
            ariaLabel={`Show ${freshnessKpis.newThisWeek} deals imported this week`}
          />
          <Kpi
            label="New Green Candidates"
            value={freshnessKpis.newGreenCandidates.toLocaleString()}
            icon={Sparkles}
            accent="text-primary"
            sub="candidate / 7d"
            onClick={() => setFreshnessFilter(freshnessFilter === "green-candidates-week" ? "all" : "green-candidates-week")}
            active={freshnessFilter === "green-candidates-week"}
            ariaLabel={`Show ${freshnessKpis.newGreenCandidates} new green candidate deals`}
          />
          <Kpi
            label="New Sources Today"
            value={freshnessKpis.newSourcesToday.toLocaleString()}
            icon={RadioTower}
            accent="text-foreground"
            sub="source listings / 24h"
            onClick={() => setFreshnessFilter(freshnessFilter === "sources-today" ? "all" : "sources-today")}
            active={freshnessFilter === "sources-today"}
            ariaLabel={`Show ${freshnessKpis.newSourcesToday} source listings imported today`}
          />
        </div>

        {isSupabaseConfigured && (
          <div className="ds-card p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground font-medium">National scan status</div>
              <div className="mt-1 text-sm font-medium">
                {nationalScanStatus.isLoading
                  ? "Loading national scan status..."
                  : nationalScanStatus.isError
                    ? "Could not load national scan status"
                    : nationalScanStatus.data
                      ? `Last national scan: ${formatNationalScanTime(nationalScanStatus.data.finishedAt ?? nationalScanStatus.data.startedAt)}`
                      : "National scan has not run yet"}
              </div>
            </div>
            <div className="text-xs text-muted-foreground sm:text-right">
              <div>Next scheduled scan: daily at 6am UK time</div>
              <div>Sources: Rightmove Commercial + Acuitus + Eddisons</div>
              {nationalScanStatus.data && (
                <>
                  <div>Last run locations: {nationalScanStatus.data.locationsScanned.length ? nationalScanStatus.data.locationsScanned.join(", ") : "Not available"}</div>
                  <div>
                    Queue: {nationalScanStatus.data.totalConfiguredLocations || "unknown"} locations
                    {nationalScanStatus.data.totalConfiguredLocations ? ` · next index ${nationalScanStatus.data.nextIndex}` : ""}
                  </div>
                  <div>
                    Cycle progress: {nationalScanStatus.data.scanCycleProgress}%
                    {nationalScanStatus.data.estimatedFullCycleDays ? ` · ${nationalScanStatus.data.estimatedFullCycleDays} day cycle` : ""}
                  </div>
                  <div>
                    Locations completed this cycle: {nationalScanStatus.data.locationsCompletedInCurrentCycle}/{nationalScanStatus.data.totalConfiguredLocations || "unknown"}
                  </div>
                  <div>
                    Database: {nationalScanStatus.data.totalDeals.toLocaleString()} deals · Rightmove {nationalScanStatus.data.totalRightmoveDeals.toLocaleString()} · Acuitus {nationalScanStatus.data.totalAcuitusDeals.toLocaleString()} · Eddisons {nationalScanStatus.data.totalEddisonsDeals.toLocaleString()}
                  </div>
                  <div>
                    Loaded ratings: Verified Greens {inventoryAudit.verifiedGreens} · Green Candidates {inventoryAudit.greenCandidates} · Amber {inventoryAudit.amber} · Red {inventoryAudit.red}
                  </div>
                  <div>
                    Freshness: {freshnessKpis.newToday.toLocaleString()} added today · {freshnessKpis.newThisWeek.toLocaleString()} this week
                  </div>
                  <div>
                    Last successful scan duration: {formatScanDuration(nationalScanStatus.data.lastSuccessfulScanDurationMs)} · Inserted: {nationalScanStatus.data.lastScanInsertedCount.toLocaleString()}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {canShowDiagnostics && (
          <section className="ds-card p-4 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Inventory audit</div>
                <h2 className="text-sm font-medium mt-1">Admin diagnostics</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Real inventory counts from the current deal set and latest scan status.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={generateInventoryReport} className="h-9 gap-1.5 text-xs">
                <FileText className="h-3.5 w-3.5" /> Generate inventory report
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              <InventoryMetric label="Total deals" value={inventoryAudit.totalDeals} />
              <InventoryMetric label="Imported" value={inventoryAudit.totalImportedDeals} />
              <InventoryMetric label="Rightmove" value={inventoryAudit.rightmoveDeals} />
              <InventoryMetric label="Acuitus" value={inventoryAudit.acuitusDeals} />
              <InventoryMetric label="Eddisons" value={inventoryAudit.eddisonsDeals} />
              <InventoryMetric label="Verified Greens" value={inventoryAudit.verifiedGreens} />
              <InventoryMetric label="Green Candidates" value={inventoryAudit.greenCandidates} />
              <InventoryMetric label="Amber" value={inventoryAudit.amber} />
              <InventoryMetric label="Red" value={inventoryAudit.red} />
              <InventoryMetric label="Added today" value={inventoryAudit.addedToday} />
              <InventoryMetric label="Added this week" value={inventoryAudit.addedThisWeek} />
              <InventoryMetric
                label="Locations completed"
                value={inventoryAudit.totalConfiguredLocations ? `${inventoryAudit.locationsCompletedInCurrentCycle}/${inventoryAudit.totalConfiguredLocations}` : inventoryAudit.locationsCompletedInCurrentCycle}
              />
            </div>
            {inventoryReport && (
              <pre className="max-h-72 overflow-auto rounded-md border border-border/60 bg-surface-2 p-3 text-xs text-muted-foreground whitespace-pre-wrap">
                {inventoryReport}
              </pre>
            )}
          </section>
        )}

        <section className="ds-card p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium">My Pipeline</h2>
              <p className="text-xs text-muted-foreground">Track saved acquisition opportunities by stage.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <PipelineMetric label="Total saved" value={pipelineAnalytics.totalSaved} />
              <PipelineMetric label="Active opportunities" value={pipelineAnalytics.activeOpportunities} />
              <PipelineMetric label="Offers submitted" value={pipelineAnalytics.offersSubmitted} />
              <PipelineMetric label="Purchased" value={pipelineAnalytics.purchased} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {PIPELINE_STATUSES.filter((status) => status !== "Passed").map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setPipelineStatus(pipelineStatus === status ? "all" : status)}
                aria-pressed={pipelineStatus === status}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs transition-colors",
                  pipelineStatus === status
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/60 bg-surface-2 text-muted-foreground hover:text-foreground"
                )}
              >
                {status}: {pipelineCounts[status]}
              </button>
            ))}
          </div>
        </section>

        {recentlyAdded.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="font-display text-2xl">Recently Added</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Newest imported opportunities from the active filters.</p>
              </div>
              <button onClick={() => setSort("newest")} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                Sort newest <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
            <div className="ds-card overflow-hidden">
              {recentlyAdded.map((deal) => (
                <div key={deal.id} className="grid grid-cols-12 gap-3 items-center px-4 py-3 border-b border-border/40 last:border-b-0 text-sm">
                  <div className="col-span-12 md:col-span-5 min-w-0">
                    <div className="font-medium truncate">{deal.title}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{deal.location}</div>
                  </div>
                  <div className="col-span-5 md:col-span-2 text-xs text-muted-foreground">{formatImportDate(deal.postedAt)}</div>
                  <div className="col-span-4 md:col-span-2 text-xs text-muted-foreground truncate">{getSourceLabel(deal)}</div>
                  <div className="col-span-3 md:col-span-1 font-mono text-sm font-semibold tabular text-right md:text-left">{deal.score}</div>
                  <div className="col-span-12 md:col-span-2 flex justify-start md:justify-end">
                    <ClassificationBadge classification={classifyDeal(deal)} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Needs review */}
        {needsReview.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="font-display text-2xl">Needs review</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Sparse imported listings waiting for underwriting.</p>
              </div>
              <button onClick={() => setSource("Imported")} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                View imported <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {needsReview.slice(0, 3).map((d) => <DealCard key={d.id} deal={d} variant="feature" />)}
            </div>
          </section>
        )}

        {best.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-display text-2xl">Top matching deals</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Top 3 by your active filters and strategy.</p>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {best.map((d) => <DealCard key={d.id} deal={d} variant="feature" />)}
          </div>
        </section>
        )}

        {/* Filters + table */}
        <section className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-display text-2xl">All live opportunities</h2>
            <div className="text-xs text-muted-foreground font-mono tabular">{dealsQuery.isLoading ? "Loading deals" : `${filtered.length} of ${deals.length} deals`}</div>
          </div>
          {showDebugCounts && (
            <div className="text-[11px] text-muted-foreground font-mono tabular">
              total DB: {kpis.totalDatabaseDeals} · fetched: {fetchedDeals.length} · visible: {filtered.length} · imported: {kpis.importedDeals}
            </div>
          )}

          <StrategyControl onOpen={() => setStrategyOpen(true)} />

          <div className="ds-card p-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground"><Filter className="h-3.5 w-3.5" />Filters</div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={locationQuery}
                onChange={(event) => setLocationQuery(event.target.value)}
                placeholder="Location, postcode, region"
                className="h-9 w-[220px] bg-surface-2 border-border/60 pl-8 text-xs"
                aria-label="Location filter"
              />
            </div>
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger className="h-9 w-[140px] bg-surface-2 border-border/60 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={asset} onValueChange={setAsset}>
              <SelectTrigger className="h-9 w-[140px] bg-surface-2 border-border/60 text-xs"><SelectValue placeholder="Asset" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All assets</SelectItem>
                {ASSET_TYPES.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(minYield)} onValueChange={(v) => setMinYield(+v)}>
              <SelectTrigger className="h-9 w-[140px] bg-surface-2 border-border/60 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Any yield</SelectItem>
                <SelectItem value="5">Min 5% NIY</SelectItem>
                <SelectItem value="6">Min 6% NIY</SelectItem>
                <SelectItem value="7">Min 7% NIY</SelectItem>
                <SelectItem value="8">Min 8% NIY</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(maxPrice)} onValueChange={(v) => setMaxPrice(+v)}>
              <SelectTrigger className="h-9 w-[140px] bg-surface-2 border-border/60 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Any price</SelectItem>
                <SelectItem value="500000">Max £500k</SelectItem>
                <SelectItem value="1000000">Max £1m</SelectItem>
                <SelectItem value="2500000">Max £2.5m</SelectItem>
                <SelectItem value="5000000">Max £5m</SelectItem>
                <SelectItem value="10000000">Max £10m</SelectItem>
              </SelectContent>
            </Select>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="h-9 w-[210px] bg-surface-2 border-border/60 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {!isSupabaseConfigured && <SelectItem value="All">All sources</SelectItem>}
                {isSupabaseConfigured && <SelectItem value={ALL_REAL_DEALS_FILTER}>All real deals</SelectItem>}
                {sourceOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={rating} onValueChange={(v) => setRating(v as typeof rating)}>
              <SelectTrigger className="h-9 w-[170px] bg-surface-2 border-border/60 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ratings</SelectItem>
                <SelectItem value="verified-green">Verified Green</SelectItem>
                <SelectItem value="green-candidate">Green Candidate</SelectItem>
                <SelectItem value="amber">Amber</SelectItem>
                <SelectItem value="red">Red</SelectItem>
              </SelectContent>
            </Select>
            <Select value={confidence} onValueChange={(v) => setConfidence(v as typeof confidence)}>
              <SelectTrigger className="h-9 w-[150px] bg-surface-2 border-border/60 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any confidence</SelectItem>
                <SelectItem value="high">High confidence</SelectItem>
                <SelectItem value="medium">Medium confidence</SelectItem>
                <SelectItem value="low">Low confidence</SelectItem>
              </SelectContent>
            </Select>
            <Select value={pipelineStatus} onValueChange={(v) => setPipelineStatus(v as typeof pipelineStatus)}>
              <SelectTrigger className="h-9 w-[170px] bg-surface-2 border-border/60 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any pipeline stage</SelectItem>
                {PIPELINE_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="ml-auto flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!locationQuery.trim() || savedSearches.isSaving}
                onClick={() => void saveLocationSearch()}
                className="h-9 gap-1.5 text-xs"
              >
                <Save className="h-3.5 w-3.5" /> Save
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={savedAlerts.isSaving}
                onClick={() => void createAlertFromFilters()}
                className="h-9 gap-1.5 text-xs"
              >
                <Bell className="h-3.5 w-3.5" /> Create Alert
              </Button>
              <span className="text-xs text-muted-foreground">Sort</span>
              <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
                <SelectTrigger className="h-9 w-[130px] bg-surface-2 border-border/60 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="score">Highest score</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="confidence">Highest confidence</SelectItem>
                  <SelectItem value="yield">Highest yield</SelectItem>
                  <SelectItem value="price">Lowest price</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {(rating === "verified-green" || rating === "green-candidate") && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-md border border-signal-green/40 bg-signal-green/10 px-2.5 py-1 text-signal-green">
                {rating === "verified-green" ? "Verified Green" : "Green Candidates"}
              </span>
              <button
                type="button"
                onClick={() => setRating("all")}
                className="rounded-md border border-border/60 bg-surface-2 px-2.5 py-1 text-muted-foreground hover:text-foreground"
              >
                Clear green filter
              </button>
            </div>
          )}

          {pipelineStatus !== "all" && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-primary">Pipeline: {pipelineStatus}</span>
              <button
                type="button"
                onClick={() => setPipelineStatus("all")}
                className="rounded-md border border-border/60 bg-surface-2 px-2.5 py-1 text-muted-foreground hover:text-foreground"
              >
                Clear pipeline filter
              </button>
            </div>
          )}

          {freshnessFilter !== "all" && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-primary">{freshnessFilterLabel(freshnessFilter)}</span>
              <button
                type="button"
                onClick={() => setFreshnessFilter("all")}
                className="rounded-md border border-border/60 bg-surface-2 px-2.5 py-1 text-muted-foreground hover:text-foreground"
              >
                Clear freshness filter
              </button>
            </div>
          )}

          {savedSearches.savedSearches.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">Saved searches</span>
              {savedSearches.savedSearches.slice(0, 5).map((saved) => (
                <button
                  key={saved.id}
                  type="button"
                  onClick={() => applySavedSearch(saved.filters)}
                  className="rounded-md border border-border/60 bg-surface-2 px-2.5 py-1 text-muted-foreground hover:text-foreground"
                >
                  {saved.name}
                </button>
              ))}
            </div>
          )}

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium">My Alerts</h3>
                <p className="text-xs text-muted-foreground">Daily emails for new imported deals matching your saved criteria.</p>
              </div>
              {savedAlerts.isLoading && <div className="text-xs text-muted-foreground">Loading alerts...</div>}
            </div>
            {savedAlerts.error && (
              <div className="rounded-md border border-signal-amber/40 bg-signal-amber/10 px-3 py-2 text-xs text-muted-foreground">
                Could not load or save alerts. Check that the Saved Alerts migration has been applied.
              </div>
            )}
            {savedAlerts.alerts.length === 0 && !savedAlerts.isLoading ? (
              <div className="rounded-md border border-border/60 bg-surface-2/40 px-3 py-2 text-xs text-muted-foreground">
                No saved alerts yet. Use Create Alert to save the current filters.
              </div>
            ) : (
              <div className="space-y-2">
                {savedAlerts.alerts.map((alert) => (
                  <div key={alert.id} className="rounded-md border border-border/60 bg-surface-2/40 px-3 py-2">
                    {editingAlertId === alert.id && editingAlert ? (
                      <div className="grid gap-2 md:grid-cols-6">
                        <Input value={editingAlert.name} onChange={(event) => setEditingAlert({ ...editingAlert, name: event.target.value })} className="h-8 text-xs md:col-span-2" aria-label="Alert name" />
                        <Input value={editingAlert.locationQuery} onChange={(event) => setEditingAlert({ ...editingAlert, locationQuery: event.target.value })} className="h-8 text-xs" aria-label="Alert location" placeholder="Location" />
                        <Input value={editingAlert.minYield} onChange={(event) => setEditingAlert({ ...editingAlert, minYield: Number(event.target.value) || 0 })} className="h-8 text-xs" aria-label="Alert minimum yield" type="number" min="0" step="0.1" />
                        <Input value={editingAlert.maxPrice} onChange={(event) => setEditingAlert({ ...editingAlert, maxPrice: Number(event.target.value) || 0 })} className="h-8 text-xs" aria-label="Alert maximum price" type="number" min="0" />
                        <Input value={editingAlert.minScore} onChange={(event) => setEditingAlert({ ...editingAlert, minScore: Number(event.target.value) || 0 })} className="h-8 text-xs" aria-label="Alert minimum score" type="number" min="0" max="100" />
                        <div className="flex gap-2 md:col-span-6">
                          <Button type="button" size="sm" className="h-8 text-xs" onClick={() => void saveEditedAlert()} disabled={savedAlerts.isSaving}>Save alert</Button>
                          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setEditingAlertId(null); setEditingAlert(null); }}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">{alert.name}</span>
                            <span className={cn("rounded-md px-2 py-0.5 text-[10px] uppercase tracking-wide", alert.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                              {alert.enabled ? "Enabled" : "Disabled"}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {alert.locationQuery || "All locations"} · {alert.assetType || "All assets"} · min yield {alert.minYield || 0}% · max {alert.maxPrice ? `£${alert.maxPrice.toLocaleString()}` : "any price"} · score {alert.minScore || 0}+
                          </div>
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            Last run: {alert.lastRunAt ? new Date(alert.lastRunAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Not run yet"} · matches found: {alert.matchesFound}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => void toggleAlert(alert)} disabled={savedAlerts.isSaving}>
                            {alert.enabled ? "Disable" : "Enable"}
                          </Button>
                          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => startEditingAlert(alert)}>
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Button>
                          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => void savedAlerts.deleteAlert(alert.id)} disabled={savedAlerts.isDeleting}>
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {showLocationSearchCta && (
            <div className="ds-card p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Search live sources for this location</div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {locationImport.isPending
                    ? `Scanning Rightmove Commercial and Acuitus for ${locationQuery.trim()}...`
                    : `Only ${filtered.length} local ${filtered.length === 1 ? "deal" : "deals"} found for ${locationQuery.trim()}.`}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={locationImport.isPending || !canRunLiveLocationSearch}
                onClick={() => void runLiveLocationSearch()}
                className="h-9 gap-1.5 text-xs"
              >
                <Search className="h-3.5 w-3.5" /> Refresh live sources
              </Button>
              {!canRunLiveLocationSearch && (
                <div className="basis-full text-[11px] text-muted-foreground">Sign in to search live sources.</div>
              )}
              {locationImport.isError && (
                <div className="basis-full rounded-md border border-signal-amber/40 bg-signal-amber/10 px-3 py-2 text-xs text-muted-foreground">
                  {locationImport.error.message || "Couldn't search this location yet. Try a Rightmove search URL instead."}
                  {canShowLocationSearchDebug && locationImportErrorDetail && (
                    <div className="mt-1 font-mono text-[11px]">Detail: {locationImportErrorDetail}</div>
                  )}
                  {canShowLocationSearchDebug && locationImportDiagnostics && (
                    <div className="mt-1 font-mono text-[11px] break-all">
                      URL: {locationImportDiagnostics.generatedUrl || "-"} · Env: {formatEnvDiagnostics(locationImportDiagnostics.env)} · Commit: {locationImportDiagnostics.vercelGitCommitSha || "-"}
                    </div>
                  )}
                </div>
              )}
              {locationImportResult && (
                <div className="basis-full rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-muted-foreground">
                  Scanned Rightmove Commercial and Acuitus. Added {locationImportResult.imported} new deals, refreshed {locationImportResult.refreshed ?? locationImportResult.existing} existing deals.
                  {(locationImportResult.skippedRentOnly ?? 0) > 0 && ` Skipped ${locationImportResult.skippedRentOnly} rent-only listings.`}
                  {(locationImportResult.skippedPoa ?? 0) > 0 && ` Skipped ${locationImportResult.skippedPoa} POA listings.`}
                  {locationImportResult.failed > 0 && ` ${locationImportResult.failed} rows failed validation or source parsing.`}
                </div>
              )}
            </div>
          )}

          <div className="ds-card overflow-hidden">
            {/* Header row */}
            <div className="grid grid-cols-12 gap-3 items-center px-4 py-2.5 bg-surface-2/60 border-b border-border/60 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              <div className="col-span-3 sm:col-span-2">Score / Your</div>
              <div className="col-span-9 sm:col-span-3">Deal</div>
              <div className="hidden sm:block col-span-2 text-right">Guide</div>
              <div className="hidden md:block col-span-1 text-right"><Hint term="NIY">NIY</Hint></div>
              <div className="hidden md:block col-span-1 text-right"><Hint term="WAULT">WAULT</Hint></div>
              <div className="hidden lg:block col-span-2">Main risk</div>
              <div className="col-span-12 sm:col-span-1 text-right">Save</div>
            </div>
            {filtered.map(d => <DealRow key={d.id} deal={d} />)}
            {filtered.length === 0 && (
              <div className="p-12 text-center text-muted-foreground text-sm">
                {dealsQuery.isError
                  ? "Could not load live deals. Please try again shortly."
                  : deals.length === 0
                    ? "No real deals yet. Run an import to populate the dashboard."
                    : hasLocationFilter
                      ? "No deals found in this location."
                      : "No deals match these filters."}
              </div>
            )}
          </div>
        </section>
      </div>
      <StrategyOptimiserModal open={strategyOpen} onOpenChange={setStrategyOpen} />
    </AppLayout>
  );
}

function formatEnvDiagnostics(env?: Record<string, boolean>) {
  if (!env) return "-";
  return Object.entries(env).map(([key, value]) => `${key}=${value ? "set" : "missing"}`).join(", ");
}

function freshnessFilterLabel(filter: FreshnessFilter) {
  if (filter === "today") return "New Today";
  if (filter === "week") return "New This Week";
  if (filter === "green-candidates-week") return "New Green Candidates";
  if (filter === "sources-today") return "New Sources Today";
  return "Freshness";
}

function alertToInput(alert: SavedAlert): SaveAlertInput {
  return {
    id: alert.id,
    name: alert.name,
    locationQuery: alert.locationQuery,
    minYield: alert.minYield,
    maxPrice: alert.maxPrice,
    assetType: alert.assetType,
    minScore: alert.minScore,
    enabled: alert.enabled,
  };
}

function PipelineMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border/60 bg-surface-2/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-sm font-semibold tabular">{value}</div>
    </div>
  );
}

function InventoryMetric({ label, value }: { label: string; value: number | string }) {
  const formatted = typeof value === "number" ? value.toLocaleString() : value;
  return (
    <div className="rounded-md border border-border/60 bg-surface-2/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-sm font-semibold tabular">{formatted}</div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  onClick,
  active,
  ariaLabel,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  onClick?: () => void;
  active?: boolean;
  ariaLabel?: string;
}) {
  const content = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
        <Icon className={cn("h-3.5 w-3.5 text-muted-foreground")} />
      </div>
      <div className={cn("font-mono text-2xl font-semibold tabular", accent)}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel ?? label}
        aria-pressed={active}
        className={cn(
          "ds-card p-4 space-y-2 text-left transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active && "border-primary/50 bg-primary/10"
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <div className="ds-card p-4 space-y-2">
      {content}
    </div>
  );
}
