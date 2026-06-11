import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { AlertTriangle, ArrowRight, Check, Clock3, RadioTower, Search, Sparkles, Target, TrendingUp } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ClassificationBadge, ScorePill } from "@/components/RatingBadge";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildDashboardKpis } from "@/lib/dashboardKpis";
import { ALL_REAL_DEALS_FILTER, filterAndSortDeals, sourceLabel } from "@/lib/dashboardFilters";
import { classifyDeal, classificationLabel } from "@/lib/dealClassification";
import { buildFreshnessMetrics, formatAddedAgo, isNewThisWeek } from "@/lib/freshness";
import { EMPTY_AREA_INTELLIGENCE_INDEX, buildAreaIntelligenceIndex } from "@/lib/areaIntelligence";
import { buildComparableEvidence } from "@/lib/comparableEvidence";
import { top10ThisWeek, top25Opportunities, type RankedOpportunity } from "@/lib/investorShortlist";
import { useAuth } from "@/lib/auth";
import { matchReasons, personalisedScore, useStrategy } from "@/lib/strategy";
import { useWatchlist } from "@/lib/watchlist";
import { useProfile } from "@/hooks/useProfile";
import { useRealDeals } from "@/hooks/useRealDeals";
import { LocationImportError, useLocationImport, type LocationImportResult } from "@/hooks/useLocationImport";
import { formatNationalScanTime, useNationalScanStatus } from "@/hooks/useNationalScanStatus";
import { isAdminUser } from "@/lib/admin";
import { dashboardDefaultsFromPreferences, getInvestorPreferences, type InvestorPreferences } from "@/lib/onboarding";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { formatGBP, formatPct, type Deal } from "@/lib/deals";
import { buildInvestmentThesis } from "@/lib/investmentThesis";
import { buildFinancialAnalysis, formatFinancialMoney, formatFinancialPercent } from "@/lib/financialAnalysis";
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
  const [onboardingWarning, setOnboardingWarning] = useState<string | null>(null);
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
      return (week.length ? week : top25Opportunities(visibleDeals, deals, "balanced", areaIndex).slice(0, 10)).slice(0, 5);
    } catch (error) {
      console.error("Could not build dashboard shortlist", error);
      return [];
    }
  }, [areaIndex, deals, now, visibleDeals]);
  const greenCandidates = useMemo(() => visibleDeals.filter((deal) => classifyDeal(deal) === "green-candidate"), [visibleDeals]);
  const analystDeals = useMemo(() => visibleDeals.filter((deal) => classifyDeal(deal) !== "low-priority"), [visibleDeals]);
  const bestOpportunities = useMemo(() => mergeRankedDeals(shortlist, greenCandidates, analystDeals, areaIndex, deals).slice(0, 5), [analystDeals, areaIndex, deals, greenCandidates, shortlist]);
  const acquisitionBriefMatches = useMemo(() => rankAgainstAcquisitionBrief(analystDeals, investorPreferences, weights).slice(0, 5), [analystDeals, investorPreferences, weights]);
  const newThisWeekDeals = useMemo(() => analystDeals.filter((deal) => isNewThisWeek(deal, now)).sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()).slice(0, 5), [analystDeals, now]);
  const showLocationSearchCta = isSupabaseConfigured && locationQuery.trim().length > 0 && visibleDeals.length < 3;
  const canRunLiveLocationSearch = Boolean(auth.user && auth.session?.access_token);
  const canShowDebug = import.meta.env.DEV || isAdminUser(auth.user);
  const locationImportErrorDetail = locationImport.error instanceof LocationImportError ? locationImport.error.detail : undefined;
  const dashboardSearchParams = useMemo(() => ({
    q: search,
    location: locationQuery.trim(),
  }), [locationQuery, search]);

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
        {onboardingWarning && (
          <div className="rounded-lg border border-signal-amber/40 bg-signal-amber/10 px-4 py-3 text-sm text-muted-foreground">
            {onboardingWarning}
          </div>
        )}

        <section className="ds-card-elevated overflow-hidden p-5 md:p-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr] lg:items-end">
            <div>
              <div className="text-xs uppercase tracking-widest text-primary font-medium">Morning, {firstName}</div>
              <h1 className="mt-2 font-display text-4xl md:text-5xl">DealSignal Analyst Brief</h1>
              <p className="mt-3 max-w-3xl text-base text-muted-foreground">
                Today DealSignal analysed {kpis.totalDatabaseDeals.toLocaleString()} opportunities across England.
              </p>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Based on your acquisition brief, these are the {bestOpportunities.length} opportunities most worth your attention.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
              <BriefStat label="Total analysed" value={kpis.totalDatabaseDeals.toLocaleString()} />
              <BriefStat label="Top Opportunities" value={kpis.verifiedGreens.toLocaleString()} tone="green" />
              <BriefStat label="Strong Opportunities" value={kpis.greenCandidates.toLocaleString()} tone="primary" />
              <BriefStat label="New this week" value={freshness.newThisWeek.toLocaleString()} />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader
            eyebrow="Today's Best Opportunities"
            title={`Today, DealSignal found ${bestOpportunities.length} ${bestOpportunities.length === 1 ? "opportunity" : "opportunities"} worth your attention.`}
            description="Ranked from live imported data using score, confidence, yield, source freshness, area value, and your current strategy."
            action={<Button asChild variant="outline" size="sm" className="gap-2"><Link to="/deals?sort=score">Browse ranked list <ArrowRight className="h-3.5 w-3.5" /></Link></Button>}
          />
          {kpis.verifiedGreens === 0 && (
            <div className="rounded-lg border border-signal-amber/30 bg-signal-amber/10 px-4 py-3 text-sm text-muted-foreground">
              No Top Opportunities currently match your acquisition brief. Showing the strongest available opportunities instead.
            </div>
          )}
          <div className="grid gap-4 xl:grid-cols-2">
            {bestOpportunities.length > 0 ? bestOpportunities.map((item) => (
              <AnalystOpportunityCard key={item.deal.id} item={item} allDeals={deals} investorPreferences={investorPreferences} weights={weights} />
            )) : (
              <EmptyPanel loading={dealsQuery.isLoading} message="No analyst-ranked opportunities yet. Imports will populate this section as scans complete." />
            )}
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader
            eyebrow="Matches Your Acquisition Brief"
            title="Acquisition Brief Match"
            description={`These opportunities most closely match your locations, budget, asset types, yield targets, and investment strategy. ${briefDescription(investorPreferences)}`}
            action={<Button asChild variant="outline" size="sm" className="gap-2"><Link to="/onboarding?edit=1&returnTo=%2Fdashboard">Edit brief <ArrowRight className="h-3.5 w-3.5" /></Link></Button>}
          />
          <div className="grid gap-3">
            {acquisitionBriefMatches.length > 0 ? acquisitionBriefMatches.map((match) => (
              <BriefMatchRow key={match.deal.id} match={match} />
            )) : (
              <EmptyPanel loading={dealsQuery.isLoading} message="No deals match your acquisition brief in the current dashboard view." />
            )}
          </div>
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

        <section className="space-y-4">
          <SectionHeader
            eyebrow="New This Week"
            title="Fresh opportunities from the latest imports."
            description={`${freshness.newThisWeek.toLocaleString()} deals were imported in the last 7 days, including ${freshness.newGreenCandidates.toLocaleString()} Strong Opportunities.`}
            action={<Button asChild variant="outline" size="sm" className="gap-2"><Link to={dashboardDealsRoute({ ...dashboardSearchParams, freshness: "week" })}>View this week <ArrowRight className="h-3.5 w-3.5" /></Link></Button>}
          />
          <div className="grid gap-3">
            {newThisWeekDeals.length > 0 ? newThisWeekDeals.map((deal) => (
              <NewDealRow key={deal.id} deal={deal} />
            )) : (
              <EmptyPanel loading={dealsQuery.isLoading} message="No new deals in the current dashboard view this week." />
            )}
          </div>
        </section>

        <section className="ds-card p-5">
          <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Browse All Opportunities</div>
              <h2 className="font-display text-2xl mt-1">Open the full deal workbench when you need database-style browsing.</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                The dashboard stays focused on acquisition decisions. Full filters, source browsing, Requires Due Diligence, and lower-priority inventory live in All Deals.
              </p>
              <Button asChild className="mt-4 gap-2">
                <Link to={dashboardDealsRoute(dashboardSearchParams)}>Browse all opportunities <ArrowRight className="h-4 w-4" /></Link>
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="Top Opportunities" value={kpis.verifiedGreens.toLocaleString()} sub="Strict score and confidence" icon={Sparkles} accent="text-signal-green" to={dashboardDealsRoute({ ...dashboardSearchParams, classification: "verified-green" })} />
              <Kpi label="Strong Opportunities" value={kpis.greenCandidates.toLocaleString()} sub={`${kpis.verifiedGreens} top opportunities`} icon={Target} accent="text-primary" to={dashboardDealsRoute({ ...dashboardSearchParams, classification: "green-candidate" })} />
              <Kpi label="New Today" value={freshness.newToday.toLocaleString()} sub={`${freshness.newSourcesToday} source listings`} icon={Clock3} accent="text-signal-green" to={dashboardDealsRoute({ ...dashboardSearchParams, freshness: "today" })} />
              <Kpi label="Filtered Deals" value={visibleDeals.length.toLocaleString()} sub={`${kpis.importedDeals.toLocaleString()} imported`} icon={TrendingUp} accent="text-foreground" to={dashboardDealsRoute(dashboardSearchParams)} />
            </div>
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

function BriefStat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "green" | "primary" }) {
  return (
    <div className="ds-glass px-3 py-3">
      <div className={cn("font-mono text-2xl font-semibold tabular", tone === "green" && "text-signal-green", tone === "primary" && "text-primary")}>{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function SectionHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="text-xs uppercase tracking-widest text-primary font-medium">{eyebrow}</div>
        <h2 className="font-display text-2xl md:text-3xl mt-1">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

function AnalystOpportunityCard({ item, allDeals, investorPreferences, weights }: { item: RankedOpportunity; allDeals: Deal[]; investorPreferences: InvestorPreferences; weights: ReturnType<typeof useStrategy>["weights"] }) {
  const deal = item.deal;
  const classification = classifyDeal(deal);
  const strategyScore = personalisedScore(deal, weights);
  const briefSignals = acquisitionBriefSignals(deal, investorPreferences);
  const comparableEvidence = buildComparableEvidence(deal, allDeals);
  const thesis = buildInvestmentThesis(deal, {
    areaIntelligence: item.areaIntelligence,
    comparableEvidence,
    strategyMatch: strategyScore,
    strategyReasons: briefSignals.positive,
  });
  const why = uniqueStrings([
    ...item.reasons,
    ...thesis.whyInteresting,
    ...briefSignals.positive,
  ]).slice(0, 4);
  const risks = uniqueStrings([
    ...thesis.keyRisks,
    ...(deal.scoreReasons?.missingDataWarnings ?? []),
    ...briefSignals.risks,
  ]).slice(0, 3);
  const visibleYield = deal.netInitialYield || deal.grossYield;
  const strategyMatch = Math.max(0, Math.min(100, strategyScore));
  const financialAnalysis = buildFinancialAnalysis(deal);
  const defaultFinanceScenario = financialAnalysis.scenarios.find((scenario) => scenario.name === "60% LTV") ?? financialAnalysis.scenarios[0];

  return (
    <Link to={`/deal/${deal.id}`} className="ds-card-elevated block p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ClassificationBadge classification={classification} />
            <span className="text-xs text-muted-foreground">{sourceLabel(deal)}</span>
          </div>
          <h3 className="mt-2 line-clamp-2 font-display text-xl">{deal.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{deal.location}</p>
        </div>
        <ScorePill score={deal.score} rating={deal.rating} />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-9">
        <Metric label="Opportunity" value={classificationLabel(classification)} emphasis={classification === "verified-green" || classification === "green-candidate"} />
        <Metric label="Guide price" value={deal.guidePrice > 0 ? formatGBP(deal.guidePrice) : "Not available"} />
        <Metric label="Yield" value={visibleYield ? formatPct(visibleYield, 2) : "Not available"} emphasis={Boolean(visibleYield)} />
        <Metric label="Cash required" value={formatFinancialMoney(defaultFinanceScenario.cashRequired)} />
        <Metric label="Cash-on-cash" value={formatFinancialPercent(defaultFinanceScenario.cashOnCashReturn)} emphasis={(defaultFinanceScenario.cashOnCashReturn ?? 0) >= 10} />
        <Metric label="Location" value={deal.location} />
        <Metric label="Source" value={sourceLabel(deal)} />
        <Metric label="Confidence" value={`${deal.dataConfidenceScore ?? 0}%`} emphasis={(deal.dataConfidenceScore ?? 0) >= 75} />
        <Metric label="Strategy match" value={`${strategyMatch}%`} emphasis={strategyMatch >= 72} />
      </div>

      <ScoreExplanation deal={deal} strategyScore={strategyMatch} />

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <SignalList title="Why DealSignal likes this" items={why} tone="positive" />
        <div className="grid gap-3">
          <SignalList title="Potential upside" items={thesis.potentialUpside.slice(0, 2)} tone="positive" />
          <SignalList title="Key Risks" items={risks.slice(0, 2)} tone="risk" />
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Investor verdict</div>
        <div className="mt-1 text-sm font-semibold text-foreground">{thesis.investorVerdict}</div>
        <div className="mt-1 text-xs font-medium text-primary">{comparableEvidence.shortEvidenceLine}</div>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{thesis.summary}</p>
      </div>
    </Link>
  );
}

function ScoreExplanation({ deal, strategyScore }: { deal: Deal; strategyScore: number }) {
  const positive = [
    { label: "Yield", value: Math.round((deal.scoreBreakdown.incomeQuality ?? 0) * 0.22) },
    { label: "Area Value", value: Math.round((deal.scoreBreakdown.marketPricing ?? 0) * 0.18) },
    { label: "Confidence", value: Math.round((deal.dataConfidenceScore ?? 0) * 0.12) },
    { label: "Strategy Match", value: Math.round(strategyScore * 0.1) },
  ].filter((item) => item.value > 0);
  const negative = [
    { label: "Missing Lease", value: !deal.leaseLength && !deal.wault ? -6 : 0 },
    { label: "Missing Tenant", value: !deal.tenant || deal.tenant === "Unknown" ? -4 : 0 },
    { label: "Low Confidence", value: (deal.dataConfidenceScore ?? 0) < 60 ? -8 : 0 },
  ].filter((item) => item.value < 0);

  return (
    <div className="mt-4 rounded-lg border border-border/60 bg-surface-2/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Score Explanation</div>
        <div className="font-mono text-sm font-semibold tabular">Score: {deal.score}</div>
      </div>
      <div className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">Contributors</div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {positive.map((item) => <span key={item.label} className="text-signal-green">+{item.value} {item.label}</span>)}
        {negative.map((item) => <span key={item.label} className="text-signal-amber">{item.value} {item.label}</span>)}
      </div>
    </div>
  );
}

function SignalList({ title, items, tone }: { title: string; items: string[]; tone: "positive" | "risk" }) {
  const Icon = tone === "positive" ? Check : AlertTriangle;
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      <ul className="mt-2 space-y-1.5">
        {(items.length ? items : [tone === "positive" ? "No strong positive signal recorded yet." : "No major risk signal recorded yet."]).map((item) => (
          <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
            <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", tone === "positive" ? "text-signal-green" : "text-signal-amber")} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BriefMatchRow({ match }: { match: BriefMatch }) {
  const deal = match.deal;
  return (
    <Link to={`/deal/${deal.id}`} className="rounded-lg border border-border/60 bg-surface/70 p-4 transition-colors hover:border-primary/40">
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ClassificationBadge classification={classifyDeal(deal)} />
            <span className="text-xs text-muted-foreground">{sourceLabel(deal)}</span>
          </div>
          <h3 className="mt-2 truncate font-semibold">{deal.title}</h3>
          <p className="text-xs text-muted-foreground">{deal.location}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            {match.reasons.map((reason) => <span key={reason} className="rounded-full border border-primary/30 bg-primary/5 px-2 py-1 text-primary">{reason}</span>)}
            {match.risks.map((reason) => <span key={reason} className="rounded-full border border-signal-amber/30 bg-signal-amber/10 px-2 py-1 text-signal-amber">{reason}</span>)}
          </div>
        </div>
        <div className="flex items-center gap-3 md:justify-end">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Match</div>
            <div className="font-mono text-xl font-semibold text-primary">{match.matchScore}%</div>
          </div>
          <ConfidenceBadge level={deal.confidenceLevel} score={deal.dataConfidenceScore} compact />
        </div>
      </div>
    </Link>
  );
}

function NewDealRow({ deal }: { deal: Deal }) {
  const visibleYield = deal.netInitialYield || deal.grossYield;
  return (
    <Link to={`/deal/${deal.id}`} className="rounded-lg border border-border/60 bg-surface/70 p-4 transition-colors hover:border-primary/40">
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-primary">{formatAddedAgo(deal.postedAt)}</span>
            <span className="text-xs text-muted-foreground">{sourceLabel(deal)}</span>
            <ClassificationBadge classification={classifyDeal(deal)} />
          </div>
          <h3 className="mt-2 truncate font-semibold">{deal.title}</h3>
          <p className="text-xs text-muted-foreground">{deal.location}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-right">
          <Metric label="Score" value={String(deal.score)} emphasis={deal.score >= 72} />
          <Metric label="Yield" value={visibleYield ? formatPct(visibleYield, 2) : "N/A"} emphasis={Boolean(visibleYield)} />
          <Metric label="Guide" value={deal.guidePrice > 0 ? formatGBP(deal.guidePrice) : "N/A"} />
        </div>
      </div>
    </Link>
  );
}

function EmptyPanel({ loading, message }: { loading: boolean; message: string }) {
  return (
    <div className="ds-card p-8 text-sm text-muted-foreground">
      {loading ? "Loading opportunities..." : message}
    </div>
  );
}

function Kpi({ label, value, sub, icon: Icon, accent, to }: { label: string; value: string; sub: string; icon: ComponentType<{ className?: string }>; accent: string; to: string }) {
  return (
    <Link to={to} onClick={() => logDealFilterDebug("dashboard-kpi-click", { label, to, searchParams: to.split("?")[1] ?? "" })} className="ds-glass p-4 space-y-3 text-left transition-all duration-300 hover:border-primary/40 hover:-translate-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className={cn("font-mono text-3xl font-semibold leading-none tabular md:text-[2rem]", accent)}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </Link>
  );
}

function Metric({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="min-w-0 rounded-md border border-border/50 bg-background/50 px-2.5 py-2">
      <div className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("truncate font-mono text-sm font-semibold tabular", emphasis && "text-signal-green")}>{value}</div>
    </div>
  );
}

function dashboardDealsRoute(params: { classification?: string; freshness?: string; q?: string; location?: string }) {
  const searchParams = new URLSearchParams();
  if (params.classification) searchParams.set("classification", params.classification);
  if (params.freshness) searchParams.set("freshness", params.freshness);
  if (params.q?.trim()) searchParams.set("q", params.q.trim());
  if (params.location?.trim()) searchParams.set("location", params.location.trim());
  const query = searchParams.toString();
  return query ? `/deals?${query}` : "/deals";
}

function logDealFilterDebug(event: string, payload: Record<string, unknown>) {
  if (!shouldLogDealFilterDebug()) return;
  console.debug(`[DealSignal filters] ${event}`, payload);
}

function shouldLogDealFilterDebug() {
  return (import.meta.env.DEV && import.meta.env.MODE !== "test") || localStorage.getItem("dealsignal:debug-filters") === "1";
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

type BriefMatch = {
  deal: Deal;
  matchScore: number;
  reasons: string[];
  risks: string[];
};

function rankAgainstAcquisitionBrief(deals: Deal[], preferences: InvestorPreferences, weights: ReturnType<typeof useStrategy>["weights"]): BriefMatch[] {
  return deals
    .map((deal) => {
      const signals = acquisitionBriefSignals(deal, preferences);
      const score = Math.round(personalisedScore(deal, weights) * 0.45 + deal.score * 0.25 + signals.score * 0.3);
      return {
        deal,
        matchScore: Math.max(0, Math.min(100, score)),
        reasons: uniqueStrings([...signals.positive, ...matchReasons(deal, weights)]).slice(0, 4),
        risks: uniqueStrings(signals.risks).slice(0, 3),
      };
    })
    .filter((match) => match.matchScore >= 45)
    .sort((a, b) => b.matchScore - a.matchScore || b.deal.score - a.deal.score);
}

function acquisitionBriefSignals(deal: Deal, preferences: InvestorPreferences) {
  const positive: string[] = [];
  const risks: string[] = [];
  let score = 35;
  const locationText = `${deal.location} ${deal.region} ${deal.title}`.toLowerCase();
  const matchingLocation = preferences.targetLocations.find((location) => locationText.includes(location.toLowerCase()));
  if (matchingLocation) {
    positive.push(`Matches target location: ${matchingLocation}`);
    score += 18;
  } else if (preferences.targetLocations.length) {
    risks.push("Outside your target locations");
  }
  if (deal.guidePrice > 0 && preferences.maxBudget > 0 && deal.guidePrice <= preferences.maxBudget && deal.guidePrice >= Math.max(0, preferences.minBudget)) {
    positive.push("Within your budget range");
    score += 14;
  } else if (deal.guidePrice > preferences.maxBudget && preferences.maxBudget > 0) {
    risks.push("Above your stated maximum budget");
  }
  if (preferences.preferredAssetTypes.some((asset) => deal.assetType.toLowerCase().includes(asset.toLowerCase()) || asset.toLowerCase().includes(deal.assetType.toLowerCase()))) {
    positive.push(`Preferred asset type: ${deal.assetType}`);
    score += 14;
  }
  const visibleYield = deal.netInitialYield || deal.grossYield;
  if (!preferences.yieldNotImportant && visibleYield >= preferences.minYieldTarget && preferences.minYieldTarget > 0) {
    positive.push(`Meets ${preferences.minYieldTarget}% yield target`);
    score += 14;
  }
  if (classifyDeal(deal) === "green-candidate" || classifyDeal(deal) === "verified-green") {
    positive.push(`${classificationLabel(classifyDeal(deal))} classification`);
    score += 12;
  }
  if ((deal.dataConfidenceScore ?? 0) >= 75) {
    positive.push("High confidence data");
    score += 8;
  }
  if (!deal.tenant || deal.tenant === "Unknown") risks.push("Tenant information unavailable");
  if (!deal.leaseLength && !deal.wault) risks.push("Lease information unavailable");
  return { score: Math.max(0, Math.min(100, score)), positive, risks };
}

function briefDescription(preferences: InvestorPreferences) {
  const locations = preferences.targetLocations.length ? preferences.targetLocations.join(", ") : "England-wide";
  const assets = preferences.preferredAssetTypes.length ? preferences.preferredAssetTypes.slice(0, 3).join(", ") : "all asset types";
  const yieldTarget = preferences.yieldNotImportant ? "yield not prioritised" : `${preferences.minYieldTarget}%+ yield`;
  return `${preferences.strategy}; ${locations}; ${assets}; ${yieldTarget}; budget up to ${formatGBP(preferences.maxBudget)}.`;
}

function uniqueStrings(items: string[]) {
  return [...new Set(items.filter(Boolean))];
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
