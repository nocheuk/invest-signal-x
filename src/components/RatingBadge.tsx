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
  amber: "bg-signal-amber-soft text-signal-amber border-signal-amber/30",
  red: "bg-signal-red-soft text-signal-red border-signal-red/30",
};

const classificationDots: Record<DealClassification, string> = {
  "verified-green": "bg-signal-green",
  "green-candidate": "bg-primary",
  amber: "bg-signal-amber",
  red: "bg-signal-red",
};

const classificationLabels: Record<DealClassification, string> = {
  "verified-green": "Verified Green",
  "green-candidate": "Green Candidate",
  amber: "Amber",
  red: "Red",
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
  const color = rating === "green" ? "from-signal-green to-emerald-400" : rating === "amber" ? "from-signal-amber to-yellow-400" : "from-signal-red to-rose-400";
  const sz = size === "sm" ? "h-9 w-9 text-xs" : size === "lg" ? "h-16 w-16 text-xl" : "h-12 w-12 text-base";
  return (
    <div className={cn("relative grid place-items-center rounded-full bg-gradient-to-br p-[1.5px]", color, sz)}>
      <div className="grid h-full w-full place-items-center rounded-full bg-surface-2">
        <span className="font-mono font-semibold tabular text-foreground">{score}</span>
      </div>
    </div>
  );
}
