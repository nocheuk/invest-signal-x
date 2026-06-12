import { STRATEGY_MODES, type StrategyModeId } from "@/lib/strategyModes";
import { cn } from "@/lib/utils";

export function StrategyModeSelector({ value, onChange }: { value: StrategyModeId; onChange: (value: StrategyModeId) => void }) {
  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-widest text-primary font-medium">Strategy mode</div>
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Strategy mode">
        {STRATEGY_MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            role="tab"
            aria-selected={value === mode.id}
            onClick={() => onChange(mode.id)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              value === mode.id
                ? "border-primary/40 bg-primary/15 text-primary"
                : "border-border/60 bg-surface-2/60 text-muted-foreground hover:border-primary/30 hover:text-foreground"
            )}
            title={mode.description}
          >
            {mode.shortLabel}
          </button>
        ))}
      </div>
    </div>
  );
}
