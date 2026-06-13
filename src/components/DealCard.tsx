import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bookmark, MapPin, TrendingUp, AlertTriangle, Sparkles } from "lucide-react";
import type { Deal } from "@/lib/deals";
import { formatGBP, formatPct } from "@/lib/deals";
import { ClassificationBadge, ScorePill } from "@/components/RatingBadge";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { useWatchlist } from "@/lib/watchlist";
import { useStrategy, personalisedScore, matchReasons } from "@/lib/strategy";
import { sourceLabel as getSourceLabel } from "@/lib/dashboardFilters";
import { getDealAnalysis } from "@/lib/dealAnalysis";
import { classificationLabel, classifyDeal, greenCandidateReasons } from "@/lib/dealClassification";
import { formatAddedAgo } from "@/lib/freshness";
import { formatAreaDelta, type AreaIntelligence } from "@/lib/areaIntelligence";
import { buildAcquisitionReadiness } from "@/lib/acquisitionReadiness";
import { isGeneralStrategyMode, scoreStrategyMode, type StrategyModeId } from "@/lib/strategyModes";
import { cn } from "@/lib/utils";

export function DealCard({ deal, variant = "default", areaIntelligence, strategyMode = "general-investment" }: { deal: Deal; variant?: "default" | "feature"; areaIntelligence?: AreaIntelligence; strategyMode?: StrategyModeId }) {
  const { isWatched, getPipelineStatus, saveToPipeline } = useWatchlist();
  const { weights } = useStrategy();
  const yourScore = personalisedScore(deal, weights);
  const reasons = matchReasons(deal, weights);
  const analysis = getDealAnalysis(deal);
  const watched = isWatched(deal.id);
  const pipelineStatus = getPipelineStatus(deal.id);
  const sourceLabel = getSourceLabel(deal);
  const cardReasons = analysis.opportunitySignals.length > 0 ? analysis.opportunitySignals.slice(0, 2) : reasons;
  const riskSignals = analysis.riskSignals.slice(0, 2);
  const classification = classifyDeal(deal);
  const candidateReasons = classification === "green-candidate" ? greenCandidateReasons(deal) : [];
  const diligenceLabel = classification === "requires-due-diligence" || classification === "low-priority" ? classificationLabel(classification) : deal.mainRiskFlag;
  const [imageAvailable, setImageAvailable] = useState(Boolean(deal.imageUrl));
  const tenantLabel = deal.tenant && deal.tenant !== "Unknown" ? deal.tenant : "Tenant not available";
  const addedAgo = deal.isImported || deal.importSourceName ? formatAddedAgo(deal.postedAt) : "";
  const visibleYield = deal.netInitialYield || deal.grossYield;
  const pricePerSqft = deal.pricePerSqft || (deal.guidePrice > 0 && deal.sqft > 0 ? deal.guidePrice / deal.sqft : 0);
  const readiness = buildAcquisitionReadiness(deal);
  const missingReadiness = readiness.missingLabels.slice(0, 3);
  const strategyModeMatch = isGeneralStrategyMode(strategyMode) ? null : scoreStrategyMode(deal, strategyMode);

  useEffect(() => {
    setImageAvailable(Boolean(deal.imageUrl));
  }, [deal.imageUrl]);

  return (
    <Link
      to={`/deal/${deal.id}`}
      className={cn(
        "group relative ds-card-elevated overflow-hidden transition-all duration-300 hover:border-primary/50 hover:-translate-y-1 hover:shadow-[0_24px_70px_-24px_hsl(var(--primary)/0.45)] block",
        variant === "feature" ? "p-0" : "p-0"
      )}
    >
      {/* Top visual */}
      <div data-testid="deal-card-media" className={cn("relative h-32 bg-gradient-to-br overflow-hidden ds-noise", deal.thumbnail)}>
        {deal.imageUrl && imageAvailable && (
          <img
            src={deal.imageUrl}
            alt={deal.title}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            onError={() => setImageAvailable(false)}
          />
        )}
        <div className={cn("absolute inset-0 ds-grid-bg opacity-40", deal.imageUrl && imageAvailable && "bg-background/20")} />
        <div className="absolute top-3 left-3 max-w-[calc(100%-4.5rem)]">
          <ClassificationBadge classification={classification} className={classification === "green-candidate" ? "bg-primary/20 shadow-lg shadow-primary/20" : undefined} />
        </div>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!watched) void saveToPipeline(deal.id);
          }}
          className={cn(
            "absolute top-3 right-3 h-8 w-8 grid place-items-center rounded-full border transition-colors",
            watched ? "bg-primary/20 border-primary/40 text-primary" : "bg-surface/80 border-border text-muted-foreground hover:text-foreground"
          )}
          aria-label={watched ? `Saved to pipeline as ${pipelineStatus ?? "New"}` : "Save to Pipeline bookmark"}
        >
          <Bookmark className={cn("h-4 w-4", watched && "fill-current")} />
        </button>
        <div data-testid="deal-card-score-badge" className="absolute bottom-3 right-3">
          <ScorePill score={deal.score} rating={deal.rating} />
        </div>
      </div>

      <div className="p-4 space-y-3.5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground uppercase tracking-wide">
            <span>{deal.assetType}</span>
            <span className="opacity-40">•</span>
            <span className="truncate">{sourceLabel}</span>
          </div>
          {addedAgo && <div className="text-[11px] text-primary">{addedAgo}</div>}
          <h3 className="font-semibold text-[15px] leading-tight transition-colors group-hover:text-primary-glow">{deal.title}</h3>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />{deal.location}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-lg border border-white/10 bg-surface-2/60 p-2.5">
          <Metric label="Guide" value={deal.guidePrice > 0 ? formatGBP(deal.guidePrice) : "Not available"} />
          <Metric label="Yield" value={visibleYield ? formatPct(visibleYield, 2) : "Not available"} emphasis={Boolean(visibleYield)} />
          <Metric label="£/sqft" value={pricePerSqft ? formatGBP(Math.round(pricePerSqft)) : "Not available"} />
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase tracking-wide">
            <Sparkles className="h-3 w-3 text-primary" /> Your Score
          </div>
          <div className="font-mono text-sm font-semibold tabular text-primary">{yourScore}</div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] text-muted-foreground">Confidence</div>
          <ConfidenceBadge level={deal.confidenceLevel} score={deal.dataConfidenceScore} compact />
        </div>

        <div className="rounded-lg border border-border/60 bg-surface-2/50 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] text-muted-foreground">Due diligence status</div>
            <div className="text-xs font-semibold text-primary">{readiness.band}</div>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {missingReadiness.length ? `Missing: ${missingReadiness.join(", ")}` : readiness.band}
          </div>
        </div>

        {areaIntelligence?.stats && (
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-[11px]">
            <AreaMetric label="Yield vs area" value={formatAreaDelta(areaIntelligence.yieldDelta, "yield")} />
            <AreaMetric label="£/sqft vs area" value={formatAreaDelta(areaIntelligence.pricePerSqftDelta, "price")} />
          </div>
        )}

        {cardReasons.length > 0 && (
          <ul className="space-y-1 pt-1">
            {cardReasons.map((r) => (
              <li key={r} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                <span className="mt-1 h-1 w-1 rounded-full bg-primary shrink-0" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        )}

        {candidateReasons.length > 0 && (
          <div className="rounded-md border border-primary/30 bg-primary/10 px-2.5 py-2 text-[11px] text-primary">
            Strong Opportunity: {candidateReasons.slice(0, 2).join("; ")}.
          </div>
        )}

        {strategyModeMatch?.matches && (
          <div className="rounded-md border border-primary/30 bg-primary/10 px-2.5 py-2 text-[11px] text-primary">
            <div className="font-medium">Why this fits the strategy</div>
            <div className="mt-1 text-primary/90">{strategyModeMatch.reasons.slice(0, 2).join("; ")}.</div>
          </div>
        )}

        {riskSignals.length > 0 && (
          <div className="text-[11px] text-signal-amber">
            Risks: {riskSignals.join(", ")}
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <TrendingUp className="h-3 w-3" /> {tenantLabel.length > 22 ? tenantLabel.slice(0, 20) + "..." : tenantLabel}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-signal-amber">
            <AlertTriangle className="h-3 w-3" /> {diligenceLabel}
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!pipelineStatus) void saveToPipeline(deal.id);
          }}
          className={cn(
            "w-full rounded-md border px-3 py-2 text-xs transition-colors",
            pipelineStatus
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-border/60 bg-surface-2 text-muted-foreground hover:text-foreground"
          )}
        >
          {pipelineStatus ? `Pipeline: ${pipelineStatus}` : "Save to Pipeline"}
        </button>
      </div>
    </Link>
  );
}

function Metric({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("font-mono text-sm font-semibold tabular", emphasis && "text-signal-green")}>{value}</div>
    </div>
  );
}

function AreaMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-[11px] font-semibold tabular">{value}</div>
    </div>
  );
}
