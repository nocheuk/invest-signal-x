import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, RadioTower, Search } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ClassificationBadge } from "@/components/RatingBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StrategyModeSelector } from "@/components/StrategyModeSelector";
import { buildDashboardKpis } from "@/lib/dashboardKpis";
import { ALL_REAL_DEALS_FILTER, filterAndSortDeals, sourceLabel } from "@/lib/dashboardFilters";
import { classifyDeal } from "@/lib/dealClassification";
import { buildFreshnessMetrics } from "@/lib/freshness";
import { EMPTY_AREA_INTELLIGENCE_INDEX, buildAreaIntelligenceIndex } from "@/lib/areaIntelligence";
import { buildComparableEvidence } from "@/lib/comparableEvidence";
import { top25Opportunities, type RankedOpportunity } from "@/lib/investorShortlist";
import { useAuth } from "@/lib/auth";
import { personalisedScore, useStrategy } from "@/lib/strategy";
import { useWatchlist } from "@/lib/watchlist";
import { useProfile } from "@/hooks/useProfile";
import { useRealDeals } from "@/hooks/useRealDeals";
import { LocationImportError, useLocationImport, type LocationImportResult } from "@/hooks/useLocationImport";
import { formatNationalScanTime, useNationalScanStatus } from "@/hooks/useNationalScanStatus";
import { isAdminUser } from "@/lib/admin";
import { dashboardDefaultsFromPreferences, getInvestorPreferences, type InvestorPreferences } from "@/lib/onboarding";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { formatGBP, formatPct, type Deal } from "@/lib/deals";
import { useUsageTracking } from "@/lib/usageTracking";
import { buildAcquisitionReadiness } from "@/lib/acquisitionReadiness";
import { buildHighStreetConversionDiagnostics, isGeneralStrategyMode, scoreStrategyMode, strategyModeDescription, type StrategyModeId } from "@/lib/strategyModes";
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
  const { trackEvent } = useUsageTracking();
  const [searchParams] = useSearchParams();
  const [locationQuery, setLocationQuery] = useState("");
  const [locationEdited, setLocationEdited] = useState(false);
  const [locationImportResult, setLocationImportResult] = useState<LocationImportResult | null>(null);
  const [onboardingWarning, setOnboardingWarning] = useState<string | null>(null);
  const [strategyMode, setStrategyMode] = useState<StrategyModeId>("general-investment");
  const search = searchParams.get("q") ?? "";
  const now = useMemo(() => new Date(), []);
  const firstName = (profile.data?.full_name || auth.user?.user_metadata?.full_name || auth.user?.email || "there").split(/\s|@/)[0];
  const investorPreferences = useMemo(() => getInvestorPreferences(profile.data), [profile.data]);
  const onboardingDefaults = useMemo(() => dashboardDefaultsFromPreferences(investorPreferences), [investorPreferences]);

  useEffect(() => {
    if (!locationEdited && onboardingDefaults.locationQuery) setLocationQuery(onboardingDefaults.locationQuery);
  }, [locationEdited, onboardingDefaults.locationQuery]);

  useEffect(() => {
    const warning = sessionStorage.getItem("dealsignal:onboarding-warning");
    if (!warning) return;
    setOnboardingWarning(warning);
    sessionStorage.removeItem("dealsignal:onboarding-warning");
  }, []);

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
      strategyMode,
    }, weights);
  }, [deals, locationQuery, search, strategyMode, weights]);

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
      return top25Opportunities(visibleDeals, deals, "balanced", areaIndex).slice(0, 10);
    } catch (error) {
      console.error("Could not build dashboard shortlist", error);
      return [];
    }
  }, [areaIndex, deals, visibleDeals]);
  const greenCandidates = useMemo(() => visibleDeals.filter((deal) => classifyDeal(deal) === "green-candidate"), [visibleDeals]);
  const analystDeals = useMemo(() => visibleDeals.filter((deal) => classifyDeal(deal) !== "low-priority"), [visibleDeals]);
  const rankedOpportunityPool = useMemo(() => mergeRankedDeals(shortlist, greenCandidates, analystDeals, areaIndex, deals), [analystDeals, areaIndex, deals, greenCandidates, shortlist]);
  const rankedOpportunities = useMemo(() => rankedOpportunityPool.slice(0, 10), [rankedOpportunityPool]);
  const highStreetDiagnostics = useMemo(() => buildHighStreetConversionDiagnostics(deals), [deals]);
  const bestStrategyOpportunities = useMemo(
    () => rankedOpportunityPool.filter((item) => scoreStrategyMode(item.deal, "high-street-conversion").tier === "best").slice(0, 10),
    [rankedOpportunityPool],
  );
  const allStrategyOpportunities = useMemo(
    () => rankedOpportunityPool.filter((item) => scoreStrategyMode(item.deal, "high-street-conversion").score >= 20).slice(0, 10),
    [rankedOpportunityPool],
  );
  const showLocationSearchCta = isSupabaseConfigured && locationQuery.trim().length > 0 && visibleDeals.length < 3;
  const canRunLiveLocationSearch = Boolean(auth.user && auth.session?.access_token);
  const canShowDebug = import.meta.env.DEV || isAdminUser(auth.user);
  const locationImportErrorDetail = locationImport.error instanceof LocationImportError ? locationImport.error.detail : undefined;
  const dashboardSearchParams = useMemo(() => ({
    q: search,
    location: locationQuery.trim(),
    strategyMode,
  }), [locationQuery, search, strategyMode]);

  const runLiveLocationSearch = async () => {
    if (!locationQuery.trim()) return;
    setLocationImportResult(null);
    try {
      const result = await locationImport.mutateAsync({ locationQuery: locationQuery.trim() });
      setLocationImportResult(result);
      void trackEvent({ eventType: "ran_location_search", metadata: { location_query: locationQuery.trim(), imported: result.imported, refreshed: result.refreshed ?? result.existing } });
    } catch {
      // The mutation state renders the user-facing error.
    }
  };

  return (
    <AppLayout>
      <div className="container max-w-7xl py-6 space-y-5">
        {onboardingWarning && (
          <div className="rounded-lg border border-signal-amber/40 bg-signal-amber/10 px-4 py-3 text-sm text-muted-foreground">
            {onboardingWarning}
          </div>
        )}

        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-primary font-medium">Morning, {firstName}</div>
            <h1 className="mt-1 font-display text-3xl md:text-4xl">Acquisition desk</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {visibleDeals.length.toLocaleString()} current opportunities ranked for fast comparison.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to={dashboardDealsRoute(dashboardSearchParams)}>Open full workbench <ArrowRight className="h-3.5 w-3.5" /></Link>
          </Button>
        </header>

        <section className="ds-card p-3 space-y-2">
          <StrategyModeSelector value={strategyMode} onChange={setStrategyMode} />
          <p className="text-xs text-muted-foreground">{strategyModeDescription(strategyMode)}</p>
          {strategyMode === "high-street-conversion" && (
            <HighStreetStrategyDiagnostics diagnostics={highStreetDiagnostics} />
          )}
        </section>

        <details className="ds-card overflow-hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
            <div>
              <div className="text-xs uppercase tracking-widest text-primary font-medium">Analyst brief</div>
              <div className="mt-0.5 text-sm text-muted-foreground">
                {kpis.totalDatabaseDeals.toLocaleString()} opportunities analysed across England. Expand for context.
              </div>
            </div>
            <span className="text-xs text-primary">Details</span>
          </summary>
          <div className="border-t border-border/60 px-4 py-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <CompactStat label="Total analysed" value={kpis.totalDatabaseDeals.toLocaleString()} />
              <CompactStat label="Top opportunities" value={kpis.verifiedGreens.toLocaleString()} />
              <CompactStat label="Strong candidates" value={kpis.greenCandidates.toLocaleString()} />
              <CompactStat label="New this week" value={freshness.newThisWeek.toLocaleString()} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Acquisition brief: {briefDescription(investorPreferences)}
            </p>
          </div>
        </details>

        {strategyMode === "high-street-conversion" ? (
          <>
            <RankedOpportunitySection
              title="Best Strategy Opportunities"
              description="Highest-scoring High Street Conversion matches, still ranked by the existing DealSignal opportunity model."
              items={bestStrategyOpportunities}
              allDeals={deals}
              weights={weights}
              strategyMode={strategyMode}
              loading={dealsQuery.isLoading}
              empty="No high-confidence High Street Conversion matches yet. Review all strategy matches below."
            />
            <RankedOpportunitySection
              title="All Strategy Matches"
              description="Discovery tier showing High Street Conversion matches scoring 20+, including lower-signal near misses worth reviewing."
              items={allStrategyOpportunities}
              allDeals={deals}
              weights={weights}
              strategyMode={strategyMode}
              loading={dealsQuery.isLoading}
              empty="No High Street Conversion discovery matches yet."
            />
          </>
        ) : (
          <RankedOpportunitySection
            title="First 10 to compare"
            eyebrow="Ranked opportunities"
            description="Ranked by existing DealSignal score, confidence, source freshness, area value, and current strategy."
            items={rankedOpportunities}
            allDeals={deals}
            weights={weights}
            strategyMode={strategyMode}
            loading={dealsQuery.isLoading}
            empty="No ranked opportunities yet. Imports will populate this table as scans complete."
          />
        )}

        <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <div className="ds-card p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Quick location search</div>
                <h2 className="font-display text-xl mt-0.5">Filter acquisition desk</h2>
              </div>
              <span className="text-xs text-muted-foreground">{visibleDeals.length.toLocaleString()} matching</span>
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
                className="h-10 bg-surface-2 pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
          <p><span className="text-muted-foreground">Deals improved by enrichment:</span> {(data.enrichmentImpact?.dealsImproved ?? 0).toLocaleString()}</p>
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

function HighStreetStrategyDiagnostics({ diagnostics }: { diagnostics: ReturnType<typeof buildHighStreetConversionDiagnostics> }) {
  return (
    <div className="space-y-3 rounded-md border border-primary/20 bg-primary/5 p-3">
      <div>
        <div className="text-xs font-medium text-primary">High Street Conversion feed</div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Retail, town-centre, mixed-use and upper-floor conversion signals are prioritised. Discovery matches now include scores of 20+.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-5">
        <CompactStat label="Imported deals" value={diagnostics.totalImportedDeals.toLocaleString()} />
        <CompactStat label="Score 20+" value={diagnostics.score20Plus.toLocaleString()} />
        <CompactStat label="Score 30+" value={diagnostics.score30Plus.toLocaleString()} />
        <CompactStat label="Score 40+" value={diagnostics.score40Plus.toLocaleString()} />
        <CompactStat label="Score 50+" value={diagnostics.score50Plus.toLocaleString()} />
      </div>
      <details className="rounded-md border border-border/60 bg-background/60">
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-foreground">
          Top near-misses scoring 20-39 ({diagnostics.nearMisses.length})
        </summary>
        <div className="max-h-80 overflow-auto border-t border-border/60">
          {diagnostics.nearMisses.length > 0 ? (
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="bg-surface-2/60 text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Deal title</th>
                  <th className="px-3 py-2 font-medium">Source</th>
                  <th className="px-3 py-2 font-medium">Strategy score</th>
                  <th className="px-3 py-2 font-medium">Matching signals</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {diagnostics.nearMisses.map((entry) => (
                  <tr key={entry.deal.id}>
                    <td className="max-w-[280px] truncate px-3 py-2">
                      <Link to={`/deal/${entry.deal.id}`} className="hover:text-primary">{entry.deal.title}</Link>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{sourceLabel(entry.deal)}</td>
                    <td className="px-3 py-2 font-mono tabular">{entry.score}</td>
                    <td className="px-3 py-2 text-muted-foreground">{entry.matchedSignals.join(", ") || "No named signal"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-3 py-3 text-xs text-muted-foreground">No near misses in the current imported dataset.</div>
          )}
        </div>
      </details>
    </div>
  );
}

function RankedOpportunitySection({
  eyebrow = "Strategy feed",
  title,
  description,
  items,
  allDeals,
  weights,
  strategyMode,
  loading,
  empty,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  items: RankedOpportunity[];
  allDeals: Deal[];
  weights: ReturnType<typeof useStrategy>["weights"];
  strategyMode: StrategyModeId;
  loading: boolean;
  empty: string;
}) {
  return (
    <section className="ds-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-primary font-medium">{eyebrow}</div>
          <h2 className="font-display text-xl">{title}</h2>
        </div>
        <div className="max-w-2xl text-xs text-muted-foreground">{description}</div>
      </div>
      {items.length > 0 ? (
        <OpportunityDeskTable items={items} allDeals={allDeals} weights={weights} strategyMode={strategyMode} />
      ) : (
        <EmptyPanel loading={loading} message={empty} compact />
      )}
    </section>
  );
}

function OpportunityDeskTable({ items, allDeals, weights, strategyMode }: { items: RankedOpportunity[]; allDeals: Deal[]; weights: ReturnType<typeof useStrategy>["weights"]; strategyMode: StrategyModeId }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] text-left text-sm">
        <thead className="border-b border-border/60 bg-surface-2/60 text-[10px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium">Score</th>
            <th className="px-4 py-2 font-medium">Opportunity</th>
            <th className="px-4 py-2 font-medium">Yield</th>
            <th className="px-4 py-2 font-medium">Guide Price</th>
            <th className="px-4 py-2 font-medium">Due Diligence Status</th>
            <th className="px-4 py-2 font-medium">Strategy Fit</th>
            <th className="px-4 py-2 text-right font-medium">View Deal</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {items.map((item) => (
            <OpportunityDeskRow key={item.deal.id} item={item} allDeals={allDeals} weights={weights} strategyMode={strategyMode} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OpportunityDeskRow({ item, allDeals, weights, strategyMode }: { item: RankedOpportunity; allDeals: Deal[]; weights: ReturnType<typeof useStrategy>["weights"]; strategyMode: StrategyModeId }) {
  const deal = item.deal;
  const classification = classifyDeal(deal);
  const visibleYield = deal.netInitialYield || deal.grossYield;
  const comparableEvidence = buildComparableEvidence(deal, allDeals);
  const readiness = buildAcquisitionReadiness(deal, comparableEvidence);
  const strategyFit = isGeneralStrategyMode(strategyMode)
    ? Math.round(personalisedScore(deal, weights))
    : scoreStrategyMode(deal, strategyMode).score;
  const missing = readiness.missingLabels.slice(0, 3);

  return (
    <tr className="transition-colors hover:bg-primary/5">
      <td className="px-4 py-3 align-top">
        <div className={cn("font-mono text-lg font-semibold tabular", deal.score >= 78 ? "text-signal-green" : deal.score >= 72 ? "text-primary" : "text-foreground")}>{deal.score}</div>
      </td>
      <td className="max-w-[360px] px-4 py-3 align-top">
        <div className="flex flex-wrap items-center gap-2">
          <ClassificationBadge classification={classification} />
          <span className="text-xs text-muted-foreground">{sourceLabel(deal)}</span>
        </div>
        <Link to={`/deal/${deal.id}`} className="mt-1 block truncate font-semibold text-foreground hover:text-primary">{deal.title}</Link>
        <div className="truncate text-xs text-muted-foreground">{deal.location}</div>
      </td>
      <td className="px-4 py-3 align-top font-mono tabular">{visibleYield ? formatPct(visibleYield, 2) : "N/A"}</td>
      <td className="px-4 py-3 align-top font-mono tabular">{deal.guidePrice > 0 ? formatGBP(deal.guidePrice) : "N/A"}</td>
      <td className="px-4 py-3 align-top">
        <div className="text-xs font-medium text-foreground">{readiness.band}</div>
        <div className="mt-0.5 max-w-[190px] truncate text-[11px] text-muted-foreground">
          {missing.length ? `Missing: ${missing.join(", ")}` : "Core diligence fields present"}
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        <div className={cn("font-mono text-sm font-semibold tabular", strategyFit >= 72 && "text-primary")}>{strategyFit}%</div>
        <div className="text-[11px] text-muted-foreground">{strategyFit >= 72 ? "Strong fit" : "Moderate fit"}</div>
      </td>
      <td className="px-4 py-3 text-right align-top">
        <Button asChild variant="outline" size="sm">
          <Link to={`/deal/${deal.id}`}>View Deal</Link>
        </Button>
      </td>
    </tr>
  );
}

function CompactStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-surface/70 px-3 py-2">
      <div className="font-mono text-lg font-semibold tabular">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function EmptyPanel({ loading, message, compact = false }: { loading: boolean; message: string; compact?: boolean }) {
  return (
    <div className={cn("text-sm text-muted-foreground", compact ? "p-4" : "ds-card p-8")}>
      {loading ? "Loading opportunities..." : message}
    </div>
  );
}

function dashboardDealsRoute(params: { classification?: string; freshness?: string; q?: string; location?: string; strategyMode?: StrategyModeId }) {
  const searchParams = new URLSearchParams();
  if (params.classification) searchParams.set("classification", params.classification);
  if (params.freshness) searchParams.set("freshness", params.freshness);
  if (params.q?.trim()) searchParams.set("q", params.q.trim());
  if (params.location?.trim()) searchParams.set("location", params.location.trim());
  if (params.strategyMode && params.strategyMode !== "general-investment") searchParams.set("strategyMode", params.strategyMode);
  const query = searchParams.toString();
  return query ? `/deals?${query}` : "/deals";
}

function uniqueDeal(deal: { id: string }, index: number, array: { id: string }[]) {
  return array.findIndex((item) => item.id === deal.id) === index;
}

function mergeRankedDeals(shortlist: RankedOpportunity[], candidates: Deal[], visibleDeals: Deal[], areaIndex: typeof EMPTY_AREA_INTELLIGENCE_INDEX, allDeals: Deal[]) {
  const highLevelShortlist = shortlist.filter((item) => classifyDeal(item.deal) !== "low-priority");
  const candidateItems = candidates.map((deal) => {
    const existing = highLevelShortlist.find((item) => item.deal.id === deal.id);
    if (existing) return existing;
    return top25Opportunities([deal], allDeals, "balanced", areaIndex)[0];
  }).filter(Boolean) as RankedOpportunity[];
  const fallback = highLevelShortlist.length || candidateItems.length ? [] : top25Opportunities(visibleDeals, allDeals, "balanced", areaIndex).slice(0, 5);
  return [...highLevelShortlist, ...candidateItems, ...fallback]
    .filter((item) => classifyDeal(item.deal) !== "low-priority")
    .filter((item, index, array) => uniqueDeal(item.deal, index, array.map((entry) => entry.deal)))
    .sort((a, b) => b.shortlistScore - a.shortlistScore || b.deal.score - a.deal.score);
}

function briefDescription(preferences: InvestorPreferences) {
  const locations = preferences.targetLocations.length ? preferences.targetLocations.join(", ") : "England-wide";
  const assets = preferences.preferredAssetTypes.length ? preferences.preferredAssetTypes.slice(0, 3).join(", ") : "all asset types";
  const yieldTarget = preferences.yieldNotImportant ? "yield not prioritised" : `${preferences.minYieldTarget}%+ yield`;
  return `${preferences.strategy}; ${locations}; ${assets}; ${yieldTarget}; budget up to ${formatGBP(preferences.maxBudget)}.`;
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
