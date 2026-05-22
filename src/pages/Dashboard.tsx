import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { ASSET_TYPES, REGIONS, formatPct, type Rating } from "@/lib/deals";
import { DealCard } from "@/components/DealCard";
import { DealRow } from "@/components/DealRow";
import { useWatchlist } from "@/lib/watchlist";
import { useStrategy, personalisedScore } from "@/lib/strategy";
import { useDeals } from "@/hooks/useDeals";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/hooks/useProfile";
import { useSavedSearches, type SavedSearchFilters } from "@/hooks/useSavedSearches";
import { LocationImportError, useLocationImport, type LocationImportResult } from "@/hooks/useLocationImport";
import { StrategyControl } from "@/components/StrategyControl";
import { StrategyOptimiserModal } from "@/components/StrategyOptimiserModal";
import { Activity, Target, TrendingUp, Bookmark, Sparkles, ArrowUpRight, Filter, Search, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Hint } from "@/components/Hint";
import { cn } from "@/lib/utils";
import { ALL_REAL_DEALS_FILTER, buildSourceOptions, filterAndSortDeals } from "@/lib/dashboardFilters";
import { isSupabaseConfigured } from "@/lib/supabase/client";

const EMPTY_DEALS = [];

export default function Dashboard() {
  const { ids } = useWatchlist();
  const { weights } = useStrategy();
  const dealsQuery = useDeals();
  const auth = useAuth();
  const profile = useProfile();
  const savedSearches = useSavedSearches();
  const locationImport = useLocationImport();
  const [searchParams] = useSearchParams();
  const deals = dealsQuery.data ?? EMPTY_DEALS;
  const search = searchParams.get("q") ?? "";
  const firstName = (profile.data?.full_name || auth.user?.user_metadata?.full_name || auth.user?.email || "there").split(/\s|@/)[0];
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [region, setRegion] = useState("All UK");
  const [asset, setAsset] = useState<string>("All");
  const [minYield, setMinYield] = useState(0);
  const [maxPrice, setMaxPrice] = useState(0);
  const [locationQuery, setLocationQuery] = useState("");
  const [rating, setRating] = useState<"all" | Rating>("all");
  const [confidence, setConfidence] = useState<"all" | "high" | "medium" | "low">("all");
  const [source, setSource] = useState(isSupabaseConfigured ? ALL_REAL_DEALS_FILTER : "All");
  const [sort, setSort] = useState<"score" | "yield" | "price" | "confidence">("score");
  const [locationImportResult, setLocationImportResult] = useState<LocationImportResult | null>(null);

  const kpis = useMemo(() => {
    const greens = deals.filter(d => d.rating === "green").length;
    const yields = deals.filter(d => d.netInitialYield > 0).map(d => d.netInitialYield);
    const avg = yields.reduce((a, b) => a + b, 0) / yields.length;
    const top = [...deals].sort((a, b) => b.score - a.score)[0];
    return {
      scanned: 14_832,
      greens,
      avgYield: Number.isFinite(avg) ? avg : 0,
      top: top?.score ?? 0,
      watched: ids.length,
    };
  }, [deals, ids.length]);

  const filtered = useMemo(() => {
    return filterAndSortDeals(deals, { region, asset, source, rating, confidence, minYield, maxPrice, search, locationQuery, sort }, weights);
  }, [deals, region, asset, source, minYield, maxPrice, rating, confidence, search, locationQuery, sort, weights]);

  const best = useMemo(() => [...deals].sort((a, b) => personalisedScore(b, weights) - personalisedScore(a, weights)).slice(0, 3), [deals, weights]);
  const sourceOptions = useMemo(() => buildSourceOptions(deals), [deals]);
  const needsReview = useMemo(() => deals.filter((deal) => deal.needsReview || (deal.isImported && deal.score <= 45)), [deals]);
  const importedCount = useMemo(() => deals.filter((deal) => deal.isImported || deal.importSourceName).length, [deals]);
  const showDebugCounts = import.meta.env.DEV || source !== "All" || search.length > 0 || locationQuery.length > 0;
  const hasLocationFilter = locationQuery.trim().length > 0;
  const showLocationSearchCta = isSupabaseConfigured && hasLocationFilter && filtered.length < 3;
  const canRunLiveLocationSearch = Boolean(auth.user && auth.session?.access_token);
  const canShowLocationSearchDebug = true;
  const locationImportErrorDetail = locationImport.error instanceof LocationImportError ? locationImport.error.detail : undefined;
  const locationImportDiagnostics = locationImport.error instanceof LocationImportError ? locationImport.error.diagnostics : undefined;

  const currentSavedFilters: SavedSearchFilters = { locationQuery, source, asset, minYield, maxPrice };
  const saveLocationSearch = async () => {
    if (!locationQuery.trim()) return;
    await savedSearches.saveSearch({
      name: `${locationQuery.trim()}${source !== "All" ? ` · ${source}` : ""}`,
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

  return (
    <AppLayout>
      <div className="container max-w-7xl py-8 space-y-8">
        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-primary font-medium">Today · 30 April 2026</div>
            <h1 className="font-display text-4xl mt-1">Good morning, {firstName}.</h1>
            <p className="text-muted-foreground text-sm mt-1">{kpis.greens} green-rated deals surfaced overnight across your search filters.</p>
          </div>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
            <Sparkles className="h-4 w-4" /> Run AI sweep
          </Button>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Kpi label="Deals scanned today" value={kpis.scanned.toLocaleString()} icon={Activity} accent="text-foreground" sub="across 87 sources" />
          <Kpi label="Green deals found" value={kpis.greens.toString()} icon={Target} accent="text-signal-green" sub="+3 vs yesterday" />
          <Kpi label="Average yield (NIY)" value={formatPct(kpis.avgYield, 2)} icon={TrendingUp} accent="text-foreground" sub="net initial" />
          <Kpi label="Highest score today" value={kpis.top.toString()} icon={Sparkles} accent="text-primary" sub="DealSignal score" />
          <Kpi label="Watchlisted deals" value={kpis.watched.toString()} icon={Bookmark} accent="text-foreground" sub="across portfolio" />
        </div>

        {/* Today's best */}
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

        {/* Today's best */}
        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-display text-2xl">Today's best deals</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Top 3 by DealSignal Score across your filters.</p>
            </div>
            <button className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              View all <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {best.map((d) => <DealCard key={d.id} deal={d} variant="feature" />)}
          </div>
        </section>

        {/* Filters + table */}
        <section className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-display text-2xl">All live opportunities</h2>
            <div className="text-xs text-muted-foreground font-mono tabular">{dealsQuery.isLoading ? "Loading deals" : `${filtered.length} of ${deals.length} deals`}</div>
          </div>
          {showDebugCounts && (
            <div className="text-[11px] text-muted-foreground font-mono tabular">
              total fetched: {deals.length} · visible: {filtered.length} · imported: {importedCount}
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
                <SelectItem value="All">All sources</SelectItem>
                {isSupabaseConfigured && <SelectItem value={ALL_REAL_DEALS_FILTER}>All real deals</SelectItem>}
                {sourceOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={rating} onValueChange={(v) => setRating(v as Rating | "all")}>
              <SelectTrigger className="h-9 w-[120px] bg-surface-2 border-border/60 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ratings</SelectItem>
                <SelectItem value="green">🟢 Green</SelectItem>
                <SelectItem value="amber">🟡 Amber</SelectItem>
                <SelectItem value="red">🔴 Red</SelectItem>
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
              <span className="text-xs text-muted-foreground">Sort</span>
              <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
                <SelectTrigger className="h-9 w-[130px] bg-surface-2 border-border/60 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="score">Highest score</SelectItem>
                  <SelectItem value="confidence">Highest confidence</SelectItem>
                  <SelectItem value="yield">Highest yield</SelectItem>
                  <SelectItem value="price">Lowest price</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

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

function Kpi({ label, value, sub, icon: Icon, accent }: { label: string; value: string; sub: string; icon: React.ComponentType<{ className?: string }>; accent: string }) {
  return (
    <div className="ds-card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
        <Icon className={cn("h-3.5 w-3.5 text-muted-foreground")} />
      </div>
      <div className={cn("font-mono text-2xl font-semibold tabular", accent)}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}
