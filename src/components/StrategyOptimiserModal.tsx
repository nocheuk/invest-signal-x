import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { PRESETS, PresetName, SLIDER_META, StrategyWeights, strategySummary, useStrategy } from "@/lib/strategy";
import { cn } from "@/lib/utils";
import { RotateCcw, Save } from "lucide-react";

export function StrategyOptimiserModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const strategy = useStrategy();
  const [name, setName] = useState(strategy.name);
  const [preset, setPreset] = useState<PresetName>(strategy.preset);
  const [weights, setWeights] = useState<StrategyWeights>(strategy.weights);

  useEffect(() => {
    if (open) {
      setName(strategy.name);
      setPreset(strategy.preset);
      setWeights(strategy.weights);
    }
  }, [open, strategy.name, strategy.preset, strategy.weights]);

  const summary = strategySummary(weights);

  const applyPreset = (p: PresetName) => {
    setPreset(p);
    setWeights(PRESETS[p]);
    setName((cur) => (Object.keys(PRESETS).includes(cur) ? p : cur));
  };

  const handleSave = () => {
    strategy.save({ name: name.trim() || preset, preset, weights });
    onOpenChange(false);
    toast.success("Strategy updated — deals re-ranked around your priorities.");
  };

  const handleReset = () => {
    setPreset("Balanced");
    setWeights(PRESETS.Balanced);
    setName("Balanced");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-surface border-border/60 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Optimise Your Deals</DialogTitle>
          <DialogDescription className="text-sm">
            Adjust what matters most. DealSignal will re-rank opportunities around your strategy.
          </DialogDescription>
        </DialogHeader>

        {/* Presets */}
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Presets</div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(PRESETS) as PresetName[]).map((p) => (
              <button
                key={p}
                onClick={() => applyPreset(p)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                  preset === p
                    ? "bg-primary/15 border-primary/50 text-primary"
                    : "bg-surface-2 border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 pt-2">
          {/* Sliders */}
          <div className="space-y-5">
            {SLIDER_META.map((m) => (
              <div key={m.key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">{m.label}</label>
                  <span className="font-mono text-xs tabular text-primary">{weights[m.key]}</span>
                </div>
                <Slider
                  value={[weights[m.key]]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={([v]) => {
                    setWeights((w) => ({ ...w, [m.key]: v }));
                  }}
                />
                <p className="text-[11px] text-muted-foreground">{m.helper}</p>
              </div>
            ))}
          </div>

          {/* Live summary */}
          <div className="ds-card p-4 space-y-4 h-fit sticky top-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Strategy Summary</div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Focus</div>
              <div className="font-display text-lg">{summary.focus}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Risk appetite</div>
              <div className="text-sm font-medium">{summary.riskAppetite}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">DealSignal will prioritise</div>
              <ul className="space-y-1">
                {summary.prioritised.map((p) => (
                  <li key={p} className="text-xs flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-signal-green" />{p}
                  </li>
                ))}
              </ul>
            </div>
            {summary.deprioritised.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">May be deprioritised</div>
                <ul className="space-y-1">
                  {summary.deprioritised.map((p) => (
                    <li key={p} className="text-xs flex items-center gap-2 text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-signal-amber" />{p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Name + actions */}
        <div className="flex flex-wrap items-end justify-between gap-3 pt-2 border-t border-border/60">
          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Strategy name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My Cashflow Hunt"
              className="bg-surface-2 border-border/60 h-9 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" /> Reset to Balanced
            </Button>
            <Button onClick={handleSave} className="gap-1.5 bg-primary hover:bg-primary/90">
              <Save className="h-3.5 w-3.5" /> Save Strategy
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
