import { Link } from "react-router-dom";
import { Bookmark } from "lucide-react";
import type { Deal } from "@/lib/deals";
import { formatGBP, formatPct } from "@/lib/deals";
import { RatingBadge } from "@/components/RatingBadge";
import { useWatchlist } from "@/lib/watchlist";
import { useStrategy, personalisedScore } from "@/lib/strategy";
import { cn } from "@/lib/utils";

export function DealRow({ deal }: { deal: Deal }) {
  const { isWatched, toggle } = useWatchlist();
  const { weights } = useStrategy();
  const yourScore = personalisedScore(deal, weights);
  const watched = isWatched(deal.id);
  const sourceLabel = deal.importSourceName ?? (deal.isImported ? "Imported" : deal.source);

  return (
    <Link
      to={`/deal/${deal.id}`}
      className="group grid grid-cols-12 gap-3 items-center px-4 py-3 border-b border-border/40 hover:bg-surface-2/60 transition-colors text-sm"
    >
      {/* Score + rating */}
      <div className="col-span-3 sm:col-span-2 flex items-center gap-3">
        <div className={cn(
          "h-10 w-10 grid place-items-center rounded-lg font-mono font-semibold tabular shrink-0",
          deal.rating === "green" ? "bg-signal-green-soft text-signal-green" :
          deal.rating === "amber" ? "bg-signal-amber-soft text-signal-amber" :
          "bg-signal-red-soft text-signal-red"
        )}>
          {deal.score}
        </div>
        <div className="hidden sm:flex flex-col">
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Your</span>
          <span className="font-mono text-sm font-semibold tabular text-primary">{yourScore}</span>
        </div>
      </div>

      {/* Title */}
      <div className="col-span-9 sm:col-span-3 min-w-0">
        <div className="font-medium truncate group-hover:text-primary transition-colors">{deal.title}</div>
        <div className="text-[11px] text-muted-foreground truncate">{deal.location} · {deal.assetType} · {sourceLabel}</div>
        {deal.needsReview && <div className="text-[10px] uppercase tracking-wide text-signal-amber">Needs review</div>}
      </div>

      {/* Numbers — hidden on mobile */}
      <div className="hidden sm:block col-span-2 font-mono tabular text-right">{formatGBP(deal.guidePrice)}</div>
      <div className="hidden md:block col-span-1 font-mono tabular text-right">{deal.netInitialYield ? formatPct(deal.netInitialYield, 2) : "—"}</div>
      <div className="hidden md:block col-span-1 font-mono tabular text-right">{deal.wault ? `${deal.wault.toFixed(1)}y` : "—"}</div>
      <div className="hidden lg:block col-span-2 text-xs text-muted-foreground truncate">
        {deal.mainRiskFlag}
      </div>

      <div className="col-span-12 sm:col-span-1 flex justify-end">
        <button
          onClick={(e) => { e.preventDefault(); toggle(deal.id); }}
          className={cn(
            "h-8 w-8 grid place-items-center rounded-md transition-colors",
            watched ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
          aria-label="Toggle watchlist"
        >
          <Bookmark className={cn("h-4 w-4", watched && "fill-current")} />
        </button>
      </div>
    </Link>
  );
}
