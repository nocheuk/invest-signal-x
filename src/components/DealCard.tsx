import { Link } from "react-router-dom";
import { Bookmark, MapPin, TrendingUp, AlertTriangle } from "lucide-react";
import type { Deal } from "@/lib/deals";
import { formatGBP, formatPct } from "@/lib/deals";
import { RatingBadge, ScorePill } from "@/components/RatingBadge";
import { useWatchlist } from "@/lib/watchlist";
import { cn } from "@/lib/utils";

export function DealCard({ deal, variant = "default" }: { deal: Deal; variant?: "default" | "feature" }) {
  const { isWatched, toggle } = useWatchlist();
  const watched = isWatched(deal.id);

  return (
    <Link
      to={`/deal/${deal.id}`}
      className={cn(
        "group relative ds-card-elevated overflow-hidden transition-all hover:border-primary/40 hover:-translate-y-0.5 block",
        variant === "feature" ? "p-0" : "p-0"
      )}
    >
      {/* Top visual */}
      <div className={cn("relative h-28 bg-gradient-to-br overflow-hidden ds-noise", deal.thumbnail)}>
        <div className="absolute inset-0 ds-grid-bg opacity-40" />
        <div className="absolute top-3 left-3">
          <RatingBadge rating={deal.rating} />
        </div>
        <button
          onClick={(e) => { e.preventDefault(); toggle(deal.id); }}
          className={cn(
            "absolute top-3 right-3 h-8 w-8 grid place-items-center rounded-full border transition-colors",
            watched ? "bg-primary/20 border-primary/40 text-primary" : "bg-surface/80 border-border text-muted-foreground hover:text-foreground"
          )}
          aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
        >
          <Bookmark className={cn("h-4 w-4", watched && "fill-current")} />
        </button>
        <div className="absolute -bottom-5 right-4">
          <ScorePill score={deal.score} rating={deal.rating} />
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="space-y-1 pr-12">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground uppercase tracking-wide">
            <span>{deal.assetType}</span>
            <span className="opacity-40">•</span>
            <span>{deal.source}</span>
          </div>
          <h3 className="font-semibold text-[15px] leading-tight">{deal.title}</h3>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />{deal.location}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/60">
          <Metric label="Guide" value={formatGBP(deal.guidePrice)} />
          <Metric label="NIY" value={deal.netInitialYield ? formatPct(deal.netInitialYield, 2) : "—"} />
          <Metric label="WAULT" value={deal.wault ? `${deal.wault.toFixed(1)}y` : "—"} />
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <TrendingUp className="h-3 w-3" /> {deal.tenant.length > 22 ? deal.tenant.slice(0, 20) + "…" : deal.tenant}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-signal-amber">
            <AlertTriangle className="h-3 w-3" /> {deal.mainRiskFlag}
          </div>
        </div>
      </div>
    </Link>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-sm font-semibold tabular">{value}</div>
    </div>
  );
}
