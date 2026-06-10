import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Filter, Search } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { DealCard } from "@/components/DealCard";
import { DealRow } from "@/components/DealRow";
import { StrategyControl } from "@/components/StrategyControl";
import { StrategyOptimiserModal } from "@/components/StrategyOptimiserModal";
import { Hint } from "@/components/Hint";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ASSET_TYPES, REGIONS, type Rating } from "@/lib/deals";
import { classificationLabel, classifyDeal, type DealClassification } from "@/lib/dealClassification";
import { useStrategy } from "@/lib/strategy";
import { useWatchlist, PIPELINE_STATUSES, type PipelineStatus } from "@/lib/watchlist";
import { useRealDeals } from "@/hooks/useRealDeals";
import { buildSourceOptions, ALL_REAL_DEALS_FILTER, DEMO_SOURCE_FILTER, filterAndSortDeals } from "@/lib/dashboardFilters";
import { buildDashboardKpis } from "@/lib/dashboardKpis";
import { buildFreshnessMetrics, filterByFreshness, formatImportDate, sortNewestDeals, type FreshnessFilter } from "@/lib/freshness";
import { buildAreaIntelligenceIndex, EMPTY_AREA_INTELLIGENCE_INDEX, getAreaIntelligenceFromIndex } from "@/lib/areaIntelligence";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { dashboardDefaultsFromPreferences, getInvestorPreferences } from "@/lib/onboarding";

export default function AllDeals() {
  const { dealsQuery, deals } = useRealDeals();
  const profile = useProfile();
  const { ids, pipelineItems, pipelineCounts } = useWatchlist();
  const { weights } = useStrategy();
  const [searchParams] = useSearchParams();
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [region, setRegion] = useState("All UK");
  const [asset, setAsset] = useState("All");
  const [source, setSource] = useState(isSupabaseConfigured ? ALL_REAL_DEALS_FILTER : "All");
  const [rating, setRating] = useState<"all" | Rating | DealClassification>(parseClassificationParam(searchParams.get("classification")));
  const [confidence, setConfidence] = useState<"all" | "high" | "medium" | "low">("all");
  const [pipelineStatus, setPipelineStatus] = useState<"all" | PipelineStatus>("all");
  const [freshnessFilter, setFreshnessFilter] = useState<FreshnessFilter>((searchParams.get("freshness") as FreshnessFilter) ?? "all");
  const [sort, setSort] = useState<"score" | "yield" | "price" | "confidence" | "newest">("score");
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [locationQuery, setLocationQuery] = useState(searchParams.get("location") ?? "");
  const [minYield, setMinYield] = useState(0);
  const [maxPrice, setMaxPrice] = useState(0);
  const now = useMemo(() => new Date(), []);
  const onboardingDefaults = useMemo(() => dashboardDefaultsFromPreferences(getInvestorPreferences(profile.data)), [profile.data]);

  useEffect(() => {
    if (!searchParams.get("location") && onboardingDefaults.locationQuery) setLocationQuery(onboardingDefaults.locationQuery);
    if (
      !searchParams.get("asset") &&
      onboardingDefaults.assetType &&
      onboardingDefaults.assetType !== "All" &&
      ASSET_TYPES.includes(onboardingDefaults.assetType as typeof ASSET_TYPES[number])
    ) {
      setAsset(onboardingDefaults.assetType);
    }
    if (onboardingDefaults.minYield) setMinYield(onboardingDefaults.minYield);
  }, [onboardingDefaults.assetType, onboardingDefaults.locationQuery, onboardingDefaults.minYield, searchParams]);

  useEffect(() => {
    setRating(parseClassificationParam(searchParams.get("classification")));
    setFreshnessFilter(parseFreshnessParam(searchParams.get("freshness")));
    setLocationQuery(searchParams.get("location") ?? onboardingDefaults.locationQuery ?? "");
    setSearch(searchParams.get("q") ?? "");
  }, [onboardingDefaults.locationQuery, searchParams]);

  const sourceOptions = useMemo(() => {
    const options = buildSourceOptions(deals);
    return isSupabaseConfigured ? options.filter((option) => option !== DEMO_SOURCE_FILTER && option !== "All") : options;
  }, [deals]);
  const filtered = useMemo(() => {
    const base = filterAndSortDeals(deals, { region, asset, source, rating, confidence, minYield, maxPrice, search, locationQuery, sort }, weights);
    const fresh = filterByFreshness(base, freshnessFilter, now);
    if (pipelineStatus === "all") return fresh;
    return fresh.filter((deal) => pipelineItems[deal.id]?.status === pipelineStatus);
  }, [asset, confidence, deals, freshnessFilter, locationQuery, maxPrice, minYield, now, pipelineItems, pipelineStatus, rating, region, search, sort, source, weights]);
  const kpis = useMemo(() => buildDashboardKpis({ allDeals: deals, filteredDeals: filtered, watchlistIds: ids, pipelineCounts }), [deals, filtered, ids, pipelineCounts]);
  const freshness = useMemo(() => buildFreshnessMetrics(filtered, now), [filtered, now]);
  const recentlyAdded = useMemo(() => sortNewestDeals(filtered.filter((deal) => deal.isImported || deal.importSourceName)).slice(0, 6), [filtered]);
  const dueDiligenceDeals = useMemo(() => filtered.filter((deal) => classifyDeal(deal) === "requires-due-diligence").slice(0, 6), [filtered]);
  const areaIndex = useMemo(() => {
    try {
      return buildAreaIntelligenceIndex(deals);
    } catch {
      return EMPTY_AREA_INTELLIGENCE_INDEX;
    }
  }, [deals]);

  return (
    <AppLayout>
      <div className="container max-w-7xl py-8 space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-primary font-medium">All Deals</div>
            <h1 className="font-display text-4xl mt-1">Deal workbench</h1>
            <p className="text-sm text-muted-foreground mt-2">Search, filter, sort, and review the full imported opportunity set.</p>
          </div>
          <StrategyControl onOptimise={() => setStrategyOpen(true)} />
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <MiniMetric label="Filtered deals" value={filtered.length} sub={`${kpis.importedDeals.toLocaleString()} imported`} />
          <MiniMetric label="Strong Opportunities" value={kpis.greenCandidates} sub={`${kpis.verifiedGreens} top opportunities`} />
          <MiniMetric label="New Today" value={freshness.newToday} sub={`${freshness.newThisWeek} this week`} />
          <MiniMetric label="Average Yield" value={`${kpis.averageYield.toFixed(1)}%`} sub={`${kpis.yieldSampleSize} samples`} />
        </section>

        <section className="ds-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            <h2 className="font-display text-xl">Advanced filters</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <FilterInput icon={<Search className="h-4 w-4" />} label="Global search" value={search} onChange={setSearch} placeholder="Title, tenant, asset type, source..." />
            <FilterInput icon={<Search className="h-4 w-4" />} label="Location" value={locationQuery} onChange={setLocationQuery} placeholder="Bournemouth, Dorset, BH1..." />
            <FilterSelect label="Region" value={region} onValueChange={setRegion} options={REGIONS} />
            <FilterSelect label="Asset type" value={asset} onValueChange={setAsset} options={ASSET_TYPES} />
            <FilterSelect label="Source" value={source} onValueChange={setSource} options={sourceOptions} />
            <FilterSelect label="Classification" value={rating} onValueChange={(value) => setRating(value as typeof rating)} options={["all", "verified-green", "green-candidate", "requires-due-diligence", "low-priority"]} />
            <FilterSelect label="Confidence" value={confidence} onValueChange={(value) => setConfidence(value as typeof confidence)} options={["all", "high", "medium", "low"]} />
            <FilterSelect label="Pipeline" value={pipelineStatus} onValueChange={(value) => setPipelineStatus(value as typeof pipelineStatus)} options={["all", ...PIPELINE_STATUSES]} />
            <FilterSelect label="Freshness" value={freshnessFilter} onValueChange={(value) => setFreshnessFilter(value as FreshnessFilter)} options={["all", "today", "week", "green-candidates-week", "sources-today"]} />
            <FilterSelect label="Sort" value={sort} onValueChange={(value) => setSort(value as typeof sort)} options={["score", "newest", "yield", "price", "confidence"]} />
            <NumberFilter label="Min yield" value={minYield} onChange={setMinYield} />
            <NumberFilter label="Max price" value={maxPrice} onChange={setMaxPrice} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => {
              setRegion("All UK");
              setAsset("All");
              setSource(isSupabaseConfigured ? ALL_REAL_DEALS_FILTER : "All");
              setRating("all");
              setConfidence("all");
              setPipelineStatus("all");
              setFreshnessFilter("all");
              setSearch("");
              setLocationQuery("");
              setMinYield(0);
              setMaxPrice(0);
            }}>
              Clear filters
            </Button>
            {locationQuery && <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">Location: {locationQuery}</span>}
            {rating !== "all" && <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">{filterChipLabel(rating)}</span>}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <FeatureList title="Recently Added" deals={recentlyAdded} empty="No recently added imported deals match these filters." areaIndex={areaIndex} />
          <FeatureList title="Requires Due Diligence" deals={dueDiligenceDeals} empty="No diligence-required deals match these filters." areaIndex={areaIndex} />
        </section>

        <section className="ds-card overflow-hidden">
          <div className="grid grid-cols-12 gap-3 items-center px-4 py-2.5 bg-surface-2/60 border-b border-border/60 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            <div className="col-span-3 sm:col-span-2">Score / Your</div>
            <div className="col-span-9 sm:col-span-3">Deal</div>
            <div className="hidden sm:block col-span-2 text-right">Guide</div>
            <div className="hidden md:block col-span-1 text-right"><Hint term="NIY">NIY</Hint></div>
            <div className="hidden md:block col-span-1 text-right"><Hint term="WAULT">WAULT</Hint></div>
            <div className="hidden lg:block col-span-2">Main risk</div>
            <div className="col-span-12 sm:col-span-1 text-right">Save</div>
          </div>
          {filtered.map((deal) => <DealRow key={deal.id} deal={deal} />)}
          {filtered.length === 0 && (
            <div className="p-12 text-center text-sm text-muted-foreground">
              {dealsQuery.isError ? "Could not load live deals. Please try again shortly." : locationQuery ? "No deals found in this location." : "No deals match these filters."}
            </div>
          )}
        </section>
      </div>
      <StrategyOptimiserModal open={strategyOpen} onOpenChange={setStrategyOpen} />
    </AppLayout>
  );
}

function FeatureList({ title, deals, empty, areaIndex }: { title: string; deals: ReturnType<typeof useRealDeals>["deals"]; empty: string; areaIndex: ReturnType<typeof buildAreaIntelligenceIndex> }) {
  return (
    <div className="space-y-3">
      <h2 className="font-display text-2xl">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
        {deals.map((deal) => (
          <div key={deal.id} className="space-y-2">
            <DealCard deal={deal} areaIntelligence={getAreaIntelligenceFromIndex(deal, areaIndex)} />
            {title === "Recently Added" && <div className="text-[11px] text-muted-foreground">Imported {formatImportDate(deal.postedAt)}</div>}
          </div>
        ))}
        {deals.length === 0 && <div className="ds-card p-6 text-sm text-muted-foreground">{empty}</div>}
      </div>
    </div>
  );
}

function MiniMetric({ label, value, sub }: { label: string; value: number | string; sub: string }) {
  return (
    <div className="ds-glass p-4" data-testid={`metric-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 font-mono text-2xl font-semibold tabular">{typeof value === "number" ? value.toLocaleString() : value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function FilterInput({ icon, label, value, onChange, placeholder }: { icon: ReactNode; label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="space-y-1.5 text-xs text-muted-foreground">
      {label}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>
        <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-10 bg-surface-2 pl-9" />
      </div>
    </label>
  );
}

function NumberFilter({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="space-y-1.5 text-xs text-muted-foreground">
      {label}
      <Input type="number" value={value || ""} onChange={(event) => onChange(Number(event.target.value) || 0)} placeholder="Any" className="h-10 bg-surface-2" />
    </label>
  );
}

function FilterSelect({ label, value, onValueChange, options }: { label: string; value: string; onValueChange: (value: string) => void; options: string[] }) {
  return (
    <label className="space-y-1.5 text-xs text-muted-foreground">
      {label}
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-10 bg-surface-2 border-border/60">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => <SelectItem key={option} value={option}>{formatOption(option)}</SelectItem>)}
        </SelectContent>
      </Select>
    </label>
  );
}

function formatOption(value: string) {
  if (value === "verified-green") return "Top Opportunity";
  if (value === "green-candidate") return "Strong Opportunity";
  if (value === "green-candidates-week") return "Strong Opportunities This Week";
  return value.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function parseClassificationParam(value: string | null): "all" | Rating | DealClassification {
  if (
    value === "green" ||
    value === "amber" ||
    value === "red" ||
    value === "verified-green" ||
    value === "green-candidate" ||
    value === "requires-due-diligence" ||
    value === "low-priority"
  ) return value;
  if (value === "top-opportunity") return "verified-green";
  if (value === "strong-opportunity") return "green-candidate";
  return "all";
}

function parseFreshnessParam(value: string | null): FreshnessFilter {
  if (value === "today" || value === "week" || value === "green-candidates-week" || value === "sources-today") return value;
  return "all";
}

function filterChipLabel(value: "all" | Rating | DealClassification) {
  if (value === "all") return "";
  if (value === "verified-green" || value === "green-candidate" || value === "requires-due-diligence" || value === "low-priority") {
    return classificationLabel(value);
  }
  return formatOption(value);
}
