import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import { ArrowRight, CalendarDays, Clock3, RadioTower, Search, Sparkles, Target, TrendingUp } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { DealCard } from "@/components/DealCard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ClassificationBadge } from "@/components/RatingBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildDashboardKpis } from "@/lib/dashboardKpis";
import { ALL_REAL_DEALS_FILTER, filterAndSortDeals } from "@/lib/dashboardFilters";
import { classifyDeal } from "@/lib/dealClassification";
import { buildFreshnessMetrics } from "@/lib/freshness";
import { EMPTY_AREA_INTELLIGENCE_INDEX, buildAreaIntelligenceIndex, getAreaIntelligenceFromIndex } from "@/lib/areaIntelligence";
import { top10ThisWeek, top25Opportunities } from "@/lib/investorShortlist";
import { useAuth } from "@/lib/auth";
import { useStrategy } from "@/lib/strategy";
import { useWatchlist } from "@/lib/watchlist";
import { useProfile } from "@/hooks/useProfile";
import { useRealDeals } from "@/hooks/useRealDeals";
import { LocationImportError, useLocationImport, type LocationImportResult } from "@/hooks/useLocationImport";
import { formatNationalScanTime, useNationalScanStatus } from "@/hooks/useNationalScanStatus";
import { isAdminUser } from "@/lib/admin";
import { dashboardDefaultsFromPreferences, getInvestorPreferences } from "@/lib/onboarding";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  return (
    <ErrorBoundary fallback={<DashboardFallback />}>
      <DashboardContent />
    </ErrorBoundary>
  );
}

function DashboardContent() {
  const { dealsQuery, deals } = useRealDeals();
  const { ids, pipelineCounts } = useWatchlist();
  const { weights } = useStrategy();
  const auth = useAuth();
  const profile = useProfile();
  const nationalScanStatus = useNationalScanStatus();
  const locationImport = useLocationImport();
  const [searchParams] = useSearchParams();
  const [locationQuery, setLocationQuery] = useState("");
  const [locationEdited, setLocationEdited] = useState(false);
  const [locationImportResult, setLocationImportResult] = useState<LocationImportResult | null>(null);
  const search = searchParams.get("q") ?? "";
  const now = useMemo(() => new Date(), []);
  const firstName = (profile.data?.full_name || auth.user?.user_metadata?.full_name || auth.user?.email || "there").split(/\s|@/)[0];
  const onboardingDefaults = useMemo(() => dashboardDefaultsFromPreferences(getInvestorPreferences(profile.data)), [profile.data]);

  useEffect(() => {
    if (!locationEdited && onboardingDefaults.locationQuery) setLocationQuery(onboardingDefaults.locationQuery);
  }, [locationEdited, onboardingDefaults.locationQuery]);

  const visibleDeals = useMemo(() => {
    return filterAndSortDeals(deals, {
      region: "All UK",
      asset: "All",
      source: isSupabaseConfigured ? ALL_REAL_DEALS_FILTER : "All",
      rating: "all",
      confidence: "all",
      minYield: 0,
      maxPrice: 0,
      search,
      locationQuery,
      sort: "score",
    }, weights);
  }, [deals, locationQuery, search, weights]);

  const kpis = useMemo(() => buildDashboardKpis({
    allDeals: deals,
    filteredDeals: visibleDeals,
    watchlistIds: ids,
    pipelineCounts,
    totalDatabaseDeals: nationalScanStatus.data?.totalDeals,
  }), [deals, ids, nationalScanStatus.data?.totalDeals, pipelineCounts, visibleDeals]);

  const freshness = useMemo(() => buildFreshnessMetrics(visibleDeals, now), [now, visibleDeals]);
  const areaIndex = useMemo(() => {
    try {
      return buildAreaIntelligenceIndex(deals);
    } catch (error) {
      console.error("Could not build area intelligence index", error);
      return EMPTY_AREA_INTELLIGENCE_INDEX;
    }
  }, [deals]);
  const shortlist = useMemo(() => {
    try {
      const week = top10ThisWeek(visibleDeals, deals, now, "balanced", areaIndex);
      return (week.length ? week : top25Opportunities(visibleDeals, deals, "balanced", areaIndex).slice(0, 10)).slice(0, 3);
    } catch (error) {
      console.error("Could not build dashboard shortlist", error);
      return [];
    }
  }, [areaIndex, deals, now, visibleDeals]);
  const greenCandidates = useMemo(() => visibleDeals.filter((deal) => classifyDeal(deal) === "green-candidate"), [visibleDeals]);
  const heroDeals = shortlist.map((item) => item.deal).concat(greenCandidates).filter(uniqueDeal).slice(0, 3);
  const showLocationSearchCta = isSupabaseConfigured && locationQuery.trim().length > 0 && visibleDeals.length < 3;
  const canRunLiveLocationSearch = Boolean(auth.user && auth.session?.access_token);
  const canShowDebug = import.meta.env.DEV || isAdminUser(auth.user);
  const locationImportErrorDetail = locationImport.error instanceof LocationImportError ? locationImport.error.detail : undefined;

  const runLiveLocationSearch = async () => {
    if (!locationQuery.trim()) return;
    setLocationImportResult(null);
    try {
      setLocationImportResult(await locationImport.mutateAsync({ locationQuery: locationQuery.trim() }));
    } catch {
      // The mutation state renders the user-facing error.
    }
  };

  return (
    <AppLayout>
      <div className="container max-w-7xl py-8 space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-primary font-medium">DealSignal dashboard</div>
            <h1 className="font-display text-4xl md:text-5xl mt-1">Morning, {firstName}.</h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Your highest-signal commercial property opportunities, newest additions, and scan health in one place.
            </p>
          </div>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/deals">Open all deals <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </header>

        <section className="ds-card-elevated overflow-hidden">
          <div className="grid gap-6 p-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-xs uppercase tracking-widest text-primary font-medium">Top Opportunities This Week</span>
              </div>
              <h2 className="font-display text-3xl mt-3">Start with the deals worth opening first.</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Ranked from live imported data using score, confidence, yield, freshness, and area intelligence.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <HeroMetric label="Green Candidates" value={kpis.greenCandidates} />
                <HeroMetric label="New Today" value={freshness.newToday} />
                <HeroMetric label="New This Week" value={freshness.newThisWeek} />
              </div>
            </div>
            <div className="grid gap-3">
              {heroDeals.length > 0 ? heroDeals.map((deal) => (
                <Link key={deal.id} to={`/deal/${deal.id}`} className="rounded-lg border border-border/60 bg-surface-2/70 p-3 transition-colors hover:border-primary/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{deal.title}</div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">{deal.location}</div>
                    </div>
                    <ClassificationBadge classification={classifyDeal(deal)} />
                  </div>
                </Link>
              )) : (
                <div className="rounded-lg border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
                  {dealsQuery.isLoading ? "Loading top opportunities..." : "No top opportunities yet. Imports will populate this section."}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Green Candidates" value={kpis.greenCandidates.toLocaleString()} sub={`${kpis.verifiedGreens} verified green`} icon={Target} accent="text-primary" to="/deals?classification=green-candidate" />
          <Kpi label="New Today" value={freshness.newToday.toLocaleString()} sub={`${freshness.newSourcesToday} source listings`} icon={CalendarDays} accent="text-signal-green" to="/deals?freshness=today" />
          <Kpi label="New This Week" value={freshness.newThisWeek.toLocaleString()} sub={`${freshness.newGreenCandidates} new candidates`} icon={Clock3} accent="text-signal-amber" to="/deals?freshness=week" />
          <Kpi label="Filtered Deals" value={visibleDeals.length.toLocaleString()} sub={`${kpis.importedDeals.toLocaleString()} imported in database`} icon={TrendingUp} accent="text-foreground" to="/deals" />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <div className="ds-card p-5 space-y-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Quick location search</div>
              <h2 className="font-display text-2xl mt-1">Find deals by city, county, or postcode.</h2>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Location filter"
                value={locationQuery}
                onChange={(event) => {
                  setLocationEdited(true);
                  setLocationQuery(event.target.value);
                }}
                placeholder="Bournemouth, Poole, Southampton, BH1..."
                className="h-11 bg-surface-2 pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{visibleDeals.length.toLocaleString()} matching {visibleDeals.length === 1 ? "deal" : "deals"}</span>
              {locationQuery.trim() && <Button asChild variant="link" className="h-auto p-0 text-xs"><Link to={`/deals?location=${encodeURIComponent(locationQuery.trim())}`}>Open in All Deals</Link></Button>}
            </div>
            {showLocationSearchCta && (
              <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">Refresh live sources</div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {locationImport.isPending
                        ? `Scanning Rightmove Commercial and Acuitus for ${locationQuery.trim()}...`
                        : `Only ${visibleDeals.length} local ${visibleDeals.length === 1 ? "deal" : "deals"} found for ${locationQuery.trim()}.`}
                    </p>
                  </div>
                  <Button type="button" size="sm" disabled={locationImport.isPending || !canRunLiveLocationSearch} onClick={() => void runLiveLocationSearch()} className="gap-2">
                    <Search className="h-3.5 w-3.5" /> Search live sources
                  </Button>
                </div>
                {!canRunLiveLocationSearch && <div className="mt-2 text-[11px] text-muted-foreground">Sign in to search live sources.</div>}
                {locationImport.isError && (
                  <div className="mt-3 rounded-md border border-signal-amber/40 bg-signal-amber/10 px-3 py-2 text-xs text-muted-foreground">
                    {locationImport.error.message || "Live search is currently unavailable. Run manual import or try again later."}
                    {canShowDebug && locationImportErrorDetail && <div className="mt-1 font-mono text-[11px]">Detail: {locationImportErrorDetail}</div>}
                  </div>
                )}
                {locationImportResult && (
                  <div className="mt-3 rounded-md border border-primary/30 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                    Scanned Rightmove Commercial and Acuitus. Added {locationImportResult.imported} new deals, refreshed {locationImportResult.refreshed ?? locationImportResult.existing} existing deals.
                  </div>
                )}
              </div>
            )}
          </div>

          <NationalScanSummary isLoading={nationalScanStatus.isLoading} isError={nationalScanStatus.isError} data={nationalScanStatus.data} />
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Green Candidates</div>
              <h2 className="font-display text-2xl">High-potential imported opportunities</h2>
            </div>
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link to="/deals?classification=green-candidate">View all <ArrowRight className="h-3.5 w-3.5" /></Link>
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {greenCandidates.slice(0, 3).map((deal) => (
              <DealCard key={deal.id} deal={deal} areaIntelligence={getAreaIntelligenceFromIndex(deal, areaIndex)} />
            ))}
            {greenCandidates.length === 0 && (
              <div className="ds-card p-8 text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
                No Green Candidates in the current dashboard view yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

function NationalScanSummary({ isLoading, isError, data }: { isLoading: boolean; isError: boolean; data: ReturnType<typeof useNationalScanStatus>["data"] }) {
  return (
    <div className="ds-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Last scan status</div>
          <h2 className="font-display text-2xl mt-1">National scan</h2>
        </div>
        <RadioTower className="h-5 w-5 text-primary" />
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading national scan status...</p>
      ) : isError ? (
        <p className="text-sm text-signal-amber">Could not load national scan status.</p>
      ) : data ? (
        <div className="space-y-2 text-sm">
          <p><span className="text-muted-foreground">Last national scan:</span> {formatNationalScanTime(data.finishedAt)}</p>
          <p><span className="text-muted-foreground">Next scheduled scan:</span> daily at 6am UK time</p>
          <p><span className="text-muted-foreground">Sources:</span> Rightmove Commercial + Acuitus + Eddisons + Allsop</p>
          {data.locationsScanned.length > 0 && <p className="text-xs text-muted-foreground">Last run locations: {data.locationsScanned.join(", ")}</p>}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">National scan has not run yet.</p>
      )}
      <Button asChild variant="outline" size="sm" className="gap-2">
        <Link to="/sources">Open Sources / Scans <ArrowRight className="h-3.5 w-3.5" /></Link>
      </Button>
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="ds-glass min-w-24 px-3 py-2">
      <div className="font-mono text-xl font-semibold tabular text-foreground">{value.toLocaleString()}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function Kpi({ label, value, sub, icon: Icon, accent, to }: { label: string; value: string; sub: string; icon: ComponentType<{ className?: string }>; accent: string; to: string }) {
  return (
    <Link to={to} className="ds-glass p-4 space-y-3 text-left transition-all duration-300 hover:border-primary/40 hover:-translate-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className={cn("font-mono text-3xl font-semibold leading-none tabular md:text-[2rem]", accent)}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </Link>
  );
}

function uniqueDeal(deal: { id: string }, index: number, array: { id: string }[]) {
  return array.findIndex((item) => item.id === deal.id) === index;
}

function DashboardFallback() {
  return (
    <AppLayout>
      <div className="container max-w-7xl py-8">
        <div className="ds-card p-6">
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Dashboard</div>
          <h1 className="font-display text-2xl mt-2">Dashboard could not finish loading</h1>
          <p className="text-sm text-muted-foreground mt-2">The live deal feed is temporarily unavailable. Please refresh the page, or try again shortly.</p>
        </div>
      </div>
    </AppLayout>
  );
}
