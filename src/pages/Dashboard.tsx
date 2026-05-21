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
import { StrategyControl } from "@/components/StrategyControl";
import { StrategyOptimiserModal } from "@/components/StrategyOptimiserModal";
import { Activity, Target, TrendingUp, Bookmark, Sparkles, ArrowUpRight, SlidersHorizontal, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const [searchParams] = useSearchParams();
  const deals = dealsQuery.data ?? EMPTY_DEALS;
  const search = searchParams.get("q") ?? "";
  const firstName = (profile.data?.full_name || auth.user?.user_metadata?.full_name || auth.user?.email || "there").split(/\s|@/)[0];
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [region, setRegion] = useState("All UK");
  const [asset, setAsset] = useState<string>("All");
  const [minYield, setMinYield] = useState(0);
  const [rating, setRating] = useState<"all" | Rating>("all");
  const [source, setSource] = useState(isSupabaseConfigured ? ALL_REAL_DEALS_FILTER : "All");
  const [sort, setSort] = useState<"score" | "yield" | "price">("score");

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
    return filterAndSortDeals(deals, { region, asset, source, rating, minYield, search, sort }, weights);
  }, [deals, region, asset, source, minYield, rating, search, sort, weights]);

  const best = useMemo(() => [...deals].sort((a, b) => personalisedScore(b, weights) - personalisedScore(a, weights)).slice(0, 3), [deals, weights]);
  const sourceOptions = useMemo(() => buildSourceOptions(deals), [deals]);
  const needsReview = useMemo(() => deals.filter((deal) => deal.needsReview || (deal.isImported && deal.score <= 45)), [deals]);
  const importedCount = useMemo(() => deals.filter((deal) => deal.isImported || deal.importSourceName).length, [deals]);
  const showDebugCounts = import.meta.env.DEV || source !== "All" || search.length > 0;

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
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Sort</span>
              <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
                <SelectTrigger className="h-9 w-[130px] bg-surface-2 border-border/60 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="score">Highest score</SelectItem>
                  <SelectItem value="yield">Highest yield</SelectItem>
                  <SelectItem value="price">Lowest price</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

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
                {dealsQuery.isError ? "Could not load live deals. Please try again shortly." : deals.length === 0 ? "No real deals yet. Run an import to populate the dashboard." : "No deals match these filters."}
              </div>
            )}
          </div>
        </section>
      </div>
      <StrategyOptimiserModal open={strategyOpen} onOpenChange={setStrategyOpen} />
    </AppLayout>
  );
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
