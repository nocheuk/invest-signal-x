import { cn } from "@/lib/utils";
import type { Rating } from "@/lib/deals";
import type { DealClassification } from "@/lib/dealClassification";

const styles: Record<Rating, string> = {
  green: "bg-signal-green-soft text-signal-green border-signal-green/30",
  amber: "bg-signal-amber-soft text-signal-amber border-signal-amber/30",
  red: "bg-signal-red-soft text-signal-red border-signal-red/30",
};

const labels: Record<Rating, string> = { green: "Green", amber: "Amber", red: "Red" };

export function RatingBadge({ rating, className, dot = true }: { rating: Rating; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide", styles[rating], className)}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", rating === "green" ? "bg-signal-green" : rating === "amber" ? "bg-signal-amber" : "bg-signal-red")} />}
      {labels[rating]}
    </span>
  );
}

const classificationStyles: Record<DealClassification, string> = {
  "verified-green": "bg-signal-green-soft text-signal-green border-signal-green/30",
  "green-candidate": "bg-primary/10 text-primary border-primary/30",
  "requires-due-diligence": "bg-signal-amber-soft text-signal-amber border-signal-amber/30",
  "low-priority": "bg-signal-red-soft text-signal-red border-signal-red/30",
};

const classificationDots: Record<DealClassification, string> = {
  "verified-green": "bg-signal-green",
  "green-candidate": "bg-primary",
  "requires-due-diligence": "bg-signal-amber",
  "low-priority": "bg-signal-red",
};

const classificationLabels: Record<DealClassification, string> = {
  "verified-green": "Top Opportunity",
  "green-candidate": "Strong Opportunity",
  "requires-due-diligence": "Requires Due Diligence",
  "low-priority": "Low Priority",
};

export function ClassificationBadge({ classification, className, dot = true }: { classification: DealClassification; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide", classificationStyles[classification], className)}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", classificationDots[classification])} />}
      {classificationLabels[classification]}
    </span>
  );
}

export function ScorePill({ score, rating, size = "md" }: { score: number; rating: Rating; size?: "sm" | "md" | "lg" }) {
  const color = rating === "green" ? "hsl(var(--signal-green))" : rating === "amber" ? "hsl(var(--signal-amber))" : "hsl(var(--signal-red))";
  const sz = size === "sm" ? "h-9 w-9 text-xs" : size === "lg" ? "h-16 w-16 text-xl" : "h-12 w-12 text-base";
  const safeScore = Math.max(0, Math.min(100, Math.round(score)));
  return (
    <div
      className={cn("relative grid place-items-center rounded-full p-[2px] shadow-lg shadow-black/30 transition-transform group-hover:scale-105", sz)}
      style={{ background: `conic-gradient(${color} ${safeScore * 3.6}deg, hsl(var(--border)) 0deg)` }}
      aria-label={`DealSignal score ${safeScore}`}
    >
      <div className="grid h-full w-full place-items-center rounded-full bg-surface-2/95 ring-1 ring-white/5">
        <span className="font-mono font-semibold tabular text-foreground">{score}</span>
      </div>
    </div>
  );
}
