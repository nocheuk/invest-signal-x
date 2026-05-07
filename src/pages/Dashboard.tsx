import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { ASSET_TYPES, REGIONS, formatPct, type Rating } from "@/lib/deals";
import { DealCard } from "@/components/DealCard";
import { DealRow } from "@/components/DealRow";
import { useWatchlist } from "@/lib/watchlist";
import { useStrategy, personalisedScore } from "@/lib/strategy";
import { useDeals } from "@/hooks/useDeals";
import { StrategyControl } from "@/components/StrategyControl";
import { StrategyOptimiserModal } from "@/components/StrategyOptimiserModal";
import { Activity, Target, TrendingUp, Bookmark, Sparkles, ArrowUpRight, SlidersHorizontal, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Hint } from "@/components/Hint";
import { cn } from "@/lib/utils";

const EMPTY_DEALS = [];

export default function Dashboard() {
  const { ids } = useWatchlist();
  const { weights } = useStrategy();
  const dealsQuery = useDeals();
  const deals = dealsQuery.data ?? EMPTY_DEALS;
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [region, setRegion] = useState("All UK");
  const [asset, setAsset] = useState<string>("All");
  const [minYield, setMinYield] = useState(0);
  const [rating, setRating] = useState<"all" | Rating>("all");
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
    let res = deals.filter(d =>
      (region === "All UK" || d.region === region) &&
      (asset === "All" || d.assetType === asset) &&
      (rating === "all" || d.rating === rating) &&
      (d.netInitialYield >= minYield)
    );
    if (sort === "score") res = [...res].sort((a, b) => personalisedScore(b, weights) - personalisedScore(a, weights));
    if (sort === "yield") res = [...res].sort((a, b) => b.netInitialYield - a.netInitialYield);
    if (sort === "price") res = [...res].sort((a, b) => a.guidePrice - b.guidePrice);
    return res;
  }, [deals, region, asset, minYield, rating, sort, weights]);

  const best = useMemo(() => [...deals].sort((a, b) => personalisedScore(b, weights) - personalisedScore(a, weights)).slice(0, 3), [deals, weights]);

  return (
    <AppLayout>
      <div className="container max-w-7xl py-8 space-y-8">
        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-primary font-medium">Today · 30 April 2026</div>
            <h1 className="font-display text-4xl mt-1">Good morning, Jane.</h1>
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
                {dealsQuery.isError ? "Could not load live deals. Please try again shortly." : "No deals match these filters. Loosen criteria to see more."}
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
