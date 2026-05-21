import type { ConfidenceLevel } from "@/lib/deals";
import { cn } from "@/lib/utils";

export function ConfidenceBadge({ level, score, compact = false }: { level?: ConfidenceLevel; score?: number; compact?: boolean }) {
  const resolved = level ?? "low";
  const label = resolved === "high" ? "High confidence" : resolved === "medium" ? "Medium confidence" : "Low confidence";
  const tone = resolved === "high"
    ? "border-signal-green/30 bg-signal-green-soft text-signal-green"
    : resolved === "medium"
      ? "border-signal-amber/30 bg-signal-amber-soft text-signal-amber"
      : "border-signal-red/30 bg-signal-red-soft text-signal-red";

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide", tone)}>
      {compact ? label.replace(" confidence", "") : label}
      {typeof score === "number" && <span className="font-mono tabular opacity-80">{score}</span>}
    </span>
  );
}
