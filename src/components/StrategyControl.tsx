import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useStrategy } from "@/lib/strategy";

export function StrategyControl({ onOpen }: { onOpen: () => void }) {
  const { name, weights } = useStrategy();
  const chips = [
    { label: "Yield", value: weights.yield },
    { label: "Risk Control", value: weights.risk },
    { label: "Demand", value: weights.demand },
  ];

  return (
    <div className="ds-card p-3 sm:p-4 flex flex-wrap items-center gap-3">
      <button
        onClick={onOpen}
        className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
      >
        <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
        <span className="text-muted-foreground">Your Strategy:</span>
        <span>{name}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </button>
      <span className="hidden md:inline text-[11px] text-muted-foreground">Scores optimised for your priorities</span>

      <div className="flex flex-wrap items-center gap-1.5 ml-auto">
        {chips.map((c) => (
          <span
            key={c.label}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface-2 border border-border/60 text-[11px] font-mono tabular"
          >
            <span className="text-muted-foreground">{c.label}</span>
            <span className="text-primary font-semibold">{c.value}%</span>
          </span>
        ))}
        <button
          onClick={onOpen}
          className="text-[11px] font-medium text-primary hover:underline ml-1"
        >
          Edit Strategy
        </button>
      </div>
    </div>
  );
}
