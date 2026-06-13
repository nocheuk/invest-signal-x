import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Edit3, Plus, Trash2 } from "lucide-react";
import { ASSET_TYPES, REGIONS, formatGBP } from "@/lib/deals";
import { EMPTY_BRIEF_INPUT, parseList, type AcquisitionBrief, type AcquisitionBriefInput } from "@/lib/acquisitionBriefs";
import { STRATEGY_MODES, type StrategyModeId } from "@/lib/strategyModes";
import { useAcquisitionBriefs } from "@/hooks/useAcquisitionBriefs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function AcquisitionBriefControl({ matchCount }: { matchCount: number }) {
  const { briefs, activeBrief, isLoading, isSaving, saveBrief, deleteBrief, selectBrief, error } = useAcquisitionBriefs();
  const [editingBrief, setEditingBrief] = useState<AcquisitionBrief | null>(null);
  const [creating, setCreating] = useState(false);
  const dialogOpen = creating || Boolean(editingBrief);

  return (
    <section className="ds-card p-3 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-primary font-medium">Acquisition brief</div>
          <h2 className="mt-0.5 font-display text-lg">{activeBrief?.name ?? "No active brief selected"}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {activeBrief ? `${matchCount.toLocaleString()} opportunities match your brief` : "Create a brief to rank opportunities against your exact buy-box."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setCreating(true)} className="gap-2">
            <Plus className="h-3.5 w-3.5" /> Create Brief
          </Button>
          {activeBrief && (
            <>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingBrief(activeBrief)} className="gap-2">
                <Edit3 className="h-3.5 w-3.5" /> Edit Brief
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => void deleteBrief(activeBrief.id)} className="gap-2">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-[260px_1fr]">
        <div>
          <label className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">Select Active Brief</label>
          <Select value={activeBrief?.id ?? ""} onValueChange={(id) => void selectBrief(id)} disabled={isLoading || briefs.length === 0}>
            <SelectTrigger className="h-9 bg-surface-2">
              <SelectValue placeholder={isLoading ? "Loading briefs..." : "No saved briefs"} />
            </SelectTrigger>
            <SelectContent>
              {briefs.map((brief) => (
                <SelectItem key={brief.id} value={brief.id}>{brief.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <BriefSummary brief={activeBrief} />
      </div>
      {error && <p className="text-xs text-signal-amber">Acquisition brief could not be saved. {error.message}</p>}

      <BriefDialog
        open={dialogOpen}
        brief={editingBrief}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditingBrief(null);
          }
        }}
        isSaving={isSaving}
        onSave={async (input) => {
          await saveBrief(input);
          setCreating(false);
          setEditingBrief(null);
        }}
      />
    </section>
  );
}

function BriefSummary({ brief }: { brief: AcquisitionBrief | null }) {
  if (!brief) return <div className="rounded-md border border-border/60 bg-surface/60 px-3 py-2 text-xs text-muted-foreground">No brief selected yet.</div>;
  const parts = [
    strategyLabel(brief.strategyMode),
    brief.regions.length ? brief.regions.join(", ") : "England-wide",
    brief.assetTypes.length ? brief.assetTypes.join(", ") : "All asset types",
    brief.budgetMax > 0 ? `up to ${formatGBP(brief.budgetMax)}` : "any budget",
    brief.yieldMin > 0 ? `${brief.yieldMin}%+ yield` : "no yield floor",
  ];
  return (
    <div className="rounded-md border border-border/60 bg-surface/60 px-3 py-2 text-xs text-muted-foreground">
      {parts.join(" · ")}
    </div>
  );
}

function BriefDialog({ open, brief, isSaving, onOpenChange, onSave }: {
  open: boolean;
  brief: AcquisitionBrief | null;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: AcquisitionBriefInput) => Promise<void>;
}) {
  const [draft, setDraft] = useState<AcquisitionBriefInput>(EMPTY_BRIEF_INPUT);
  const [regionsText, setRegionsText] = useState("");
  const [preferredText, setPreferredText] = useState("");
  const [excludedText, setExcludedText] = useState("");

  useEffect(() => {
    const next = brief ?? EMPTY_BRIEF_INPUT;
    setDraft({ ...next, isActive: true });
    setRegionsText(next.regions.join(", "));
    setPreferredText(next.keywordsPreferred.join(", "));
    setExcludedText(next.keywordsExcluded.join(", "));
  }, [brief, open]);

  const selectedAssetTypes = useMemo(() => new Set(draft.assetTypes), [draft.assetTypes]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{brief ? "Edit Brief" : "Create Brief"}</DialogTitle>
          <DialogDescription>Define the buy-box DealSignal should use for match scoring. This does not change acquisition scoring.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Name">
            <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          </Field>
          <Field label="Strategy mode">
            <select
              value={draft.strategyMode}
              onChange={(event) => setDraft({ ...draft, strategyMode: event.target.value as StrategyModeId })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {STRATEGY_MODES.map((mode) => <option key={mode.id} value={mode.id}>{mode.shortLabel}</option>)}
            </select>
          </Field>
          <Field label="Regions">
            <Input list="brief-regions" value={regionsText} onChange={(event) => setRegionsText(event.target.value)} placeholder="London, Dorset, South West" />
            <datalist id="brief-regions">{REGIONS.filter((region) => region !== "All UK").map((region) => <option key={region} value={region} />)}</datalist>
          </Field>
          <Field label="Yield min (%)">
            <Input type="number" min="0" step="0.1" value={draft.yieldMin || ""} onChange={(event) => setDraft({ ...draft, yieldMin: Number(event.target.value) })} />
          </Field>
          <Field label="Budget min">
            <Input type="number" min="0" value={draft.budgetMin || ""} onChange={(event) => setDraft({ ...draft, budgetMin: Number(event.target.value) })} />
          </Field>
          <Field label="Budget max">
            <Input type="number" min="0" value={draft.budgetMax || ""} onChange={(event) => setDraft({ ...draft, budgetMax: Number(event.target.value) })} />
          </Field>
          <Field label="Floor area min">
            <Input type="number" min="0" value={draft.floorAreaMin || ""} onChange={(event) => setDraft({ ...draft, floorAreaMin: Number(event.target.value) })} />
          </Field>
          <Field label="Floor area max">
            <Input type="number" min="0" value={draft.floorAreaMax || ""} onChange={(event) => setDraft({ ...draft, floorAreaMax: Number(event.target.value) })} />
          </Field>
          <Field label="Keywords preferred">
            <Input value={preferredText} onChange={(event) => setPreferredText(event.target.value)} placeholder="upper floors, town centre" />
          </Field>
          <Field label="Keywords excluded">
            <Input value={excludedText} onChange={(event) => setExcludedText(event.target.value)} placeholder="leasehold, industrial" />
          </Field>
        </div>

        <div>
          <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Asset types</div>
          <div className="flex flex-wrap gap-2">
            {ASSET_TYPES.map((asset) => (
              <button
                key={asset}
                type="button"
                onClick={() => {
                  const next = selectedAssetTypes.has(asset)
                    ? draft.assetTypes.filter((item) => item !== asset)
                    : [...draft.assetTypes, asset];
                  setDraft({ ...draft, assetTypes: next });
                }}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs transition-colors",
                  selectedAssetTypes.has(asset) ? "border-primary/40 bg-primary/15 text-primary" : "border-border/60 bg-surface-2 text-muted-foreground",
                )}
              >
                {asset}
              </button>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            type="button"
            disabled={isSaving}
            onClick={() => void onSave({
              ...draft,
              regions: parseList(regionsText),
              keywordsPreferred: parseList(preferredText),
              keywordsExcluded: parseList(excludedText),
              isActive: true,
            })}
          >
            {isSaving ? "Saving..." : "Save Brief"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function strategyLabel(id: StrategyModeId) {
  return STRATEGY_MODES.find((mode) => mode.id === id)?.shortLabel ?? "General Investment";
}
