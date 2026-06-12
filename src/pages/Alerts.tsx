import { useState } from "react";
import { Bell, Pencil, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSavedAlerts, type SavedAlert, type SaveAlertInput } from "@/hooks/useSavedAlerts";
import { ASSET_TYPES } from "@/lib/deals";
import { defaultAlertName } from "@/lib/alerts";
import { useUsageTracking } from "@/lib/usageTracking";
import { cn } from "@/lib/utils";

const EMPTY_ALERT: SaveAlertInput = {
  name: "New investment alert",
  locationQuery: "",
  minYield: 0,
  maxPrice: 0,
  assetType: "All",
  minScore: 72,
  enabled: true,
};

export default function Alerts() {
  const savedAlerts = useSavedAlerts();
  const { trackEvent } = useUsageTracking();
  const [draft, setDraft] = useState<SaveAlertInput>(EMPTY_ALERT);
  const [editingId, setEditingId] = useState<string | null>(null);

  const save = async () => {
    const input = {
      ...draft,
      name: draft.name.trim() || defaultAlertName(draft),
      locationQuery: draft.locationQuery.trim(),
      assetType: draft.assetType || "All",
    };
    await savedAlerts.saveAlert(input);
    if (!editingId) void trackEvent({ eventType: "created_alert", metadata: { location_query: input.locationQuery, asset_type: input.assetType, min_score: input.minScore } });
    setDraft(EMPTY_ALERT);
    setEditingId(null);
  };

  const edit = (alert: SavedAlert) => {
    setEditingId(alert.id);
    setDraft({
      id: alert.id,
      name: alert.name,
      locationQuery: alert.locationQuery,
      minYield: alert.minYield,
      maxPrice: alert.maxPrice,
      assetType: alert.assetType,
      minScore: alert.minScore,
      enabled: alert.enabled,
    });
  };

  const toggle = async (alert: SavedAlert) => {
    await savedAlerts.saveAlert({
      id: alert.id,
      name: alert.name,
      locationQuery: alert.locationQuery,
      minYield: alert.minYield,
      maxPrice: alert.maxPrice,
      assetType: alert.assetType,
      minScore: alert.minScore,
      enabled: !alert.enabled,
    });
  };

  return (
    <AppLayout>
      <div className="container max-w-6xl py-8 space-y-8">
        <header>
          <div className="text-xs uppercase tracking-widest text-primary font-medium">Alerts</div>
          <h1 className="font-display text-4xl mt-1">My Alerts</h1>
          <p className="text-sm text-muted-foreground mt-2">Save investment criteria and receive batched matches from imported deals.</p>
        </header>

        <section className="ds-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h2 className="font-display text-2xl">{editingId ? "Edit alert" : "Create Alert"}</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <Field label="Name" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} placeholder="South Coast strong opportunities" />
            <Field label="Location" value={draft.locationQuery} onChange={(value) => setDraft({ ...draft, locationQuery: value })} placeholder="Bournemouth, Dorset, BH1..." />
            <label className="space-y-1.5 text-xs text-muted-foreground">
              Asset type
              <Select value={draft.assetType || "All"} onValueChange={(assetType) => setDraft({ ...draft, assetType })}>
                <SelectTrigger className="h-10 bg-surface-2 border-border/60"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ASSET_TYPES.map((assetType) => <SelectItem key={assetType} value={assetType}>{assetType}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <NumberField label="Min yield" value={draft.minYield} onChange={(minYield) => setDraft({ ...draft, minYield })} />
            <NumberField label="Max price" value={draft.maxPrice} onChange={(maxPrice) => setDraft({ ...draft, maxPrice })} />
            <NumberField label="Min score" value={draft.minScore} onChange={(minScore) => setDraft({ ...draft, minScore })} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void save()} disabled={savedAlerts.isSaving}>{editingId ? "Save changes" : "Create Alert"}</Button>
            {editingId && <Button type="button" variant="outline" onClick={() => { setEditingId(null); setDraft(EMPTY_ALERT); }}>Cancel</Button>}
          </div>
          {savedAlerts.error && <p className="text-xs text-signal-red">{savedAlerts.error.message}</p>}
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl">Saved alerts</h2>
          {savedAlerts.isLoading ? (
            <div className="ds-card p-6 text-sm text-muted-foreground">Loading alerts...</div>
          ) : savedAlerts.alerts.length === 0 ? (
            <div className="ds-card p-8 text-sm text-muted-foreground">No saved alerts yet. Create one from your target criteria.</div>
          ) : (
            <div className="grid gap-3">
              {savedAlerts.alerts.map((alert) => (
                <div key={alert.id} className="ds-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{alert.name}</span>
                        <span className={cn("rounded-md px-2 py-0.5 text-[10px] uppercase tracking-wide", alert.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{alert.enabled ? "Enabled" : "Disabled"}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {alert.locationQuery || "All locations"} · {alert.assetType || "All assets"} · min yield {alert.minYield || 0}% · max {alert.maxPrice ? `GBP ${alert.maxPrice.toLocaleString()}` : "any price"} · score {alert.minScore || 0}+
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        Last run: {alert.lastRunAt ? new Date(alert.lastRunAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Not run yet"} · matches found: {alert.matchesFound}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => void toggle(alert)} disabled={savedAlerts.isSaving}>{alert.enabled ? "Disable" : "Enable"}</Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => edit(alert)} className="gap-1.5"><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => void savedAlerts.deleteAlert(alert.id)} disabled={savedAlerts.isDeleting} className="gap-1.5"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="space-y-1.5 text-xs text-muted-foreground">
      {label}
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-10 bg-surface-2" />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="space-y-1.5 text-xs text-muted-foreground">
      {label}
      <Input type="number" value={value || ""} onChange={(event) => onChange(Number(event.target.value) || 0)} placeholder="Any" className="h-10 bg-surface-2" />
    </label>
  );
}
