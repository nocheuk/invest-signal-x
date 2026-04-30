import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useWatchlist } from "@/lib/watchlist";
import { DEALS, formatGBP, formatPct } from "@/lib/deals";
import { RatingBadge, ScorePill } from "@/components/RatingBadge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Bookmark, MapPin, Trash2, AlertTriangle, ArrowRight } from "lucide-react";

export default function Watchlist() {
  const { ids, notes, setNote, remove } = useWatchlist();
  const watched = DEALS.filter((d) => ids.includes(d.id));

  return (
    <AppLayout>
      <div className="container max-w-7xl py-8 space-y-6">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-primary font-medium">Watchlist</div>
            <h1 className="font-display text-4xl mt-1">Saved deals</h1>
            <p className="text-muted-foreground text-sm mt-1">{watched.length} {watched.length === 1 ? "deal" : "deals"} on your watchlist. Notes auto-save.</p>
          </div>
        </div>

        {watched.length === 0 ? (
          <div className="ds-card-elevated p-16 text-center">
            <div className="h-14 w-14 mx-auto rounded-full bg-primary/10 grid place-items-center text-primary mb-4">
              <Bookmark className="h-6 w-6" />
            </div>
            <h2 className="font-display text-2xl">Your watchlist is empty</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">Save deals from the dashboard to track them here, with notes and quick access to underwriting.</p>
            <Button asChild className="mt-6 gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <Link to="/dashboard">Browse deals <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {watched.map((d) => (
              <div key={d.id} className="ds-card-elevated p-5 space-y-4">
                <div className="flex items-start gap-4">
                  <ScorePill score={d.score} rating={d.rating} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <RatingBadge rating={d.rating} dot={false} />
                      <span className="text-[11px] text-muted-foreground">{d.assetType}</span>
                    </div>
                    <Link to={`/deal/${d.id}`} className="font-semibold hover:text-primary transition-colors block truncate">{d.title}</Link>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <MapPin className="h-3 w-3" />{d.location}
                    </div>
                  </div>
                  <button onClick={() => remove(d.id)} className="text-muted-foreground hover:text-signal-red transition-colors p-1" aria-label="Remove">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center">
                  <Stat label="Price" v={formatGBP(d.guidePrice)} />
                  <Stat label="NIY" v={d.netInitialYield ? formatPct(d.netInitialYield, 2) : "—"} />
                  <Stat label="WAULT" v={d.wault ? `${d.wault.toFixed(1)}y` : "—"} />
                  <Stat label="Score" v={d.score.toString()} />
                </div>

                <div className="flex items-center gap-1.5 text-xs text-signal-amber bg-signal-amber/10 rounded-lg px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{d.mainRiskFlag}</span>
                </div>

                <Textarea
                  placeholder="Notes — viewing booked, target price, contact…"
                  value={notes[d.id] || ""}
                  onChange={(e) => setNote(d.id, e.target.value)}
                  className="bg-surface-2 border-border/60 min-h-20 resize-none text-sm"
                />

                <Button asChild variant="outline" size="sm" className="w-full gap-2">
                  <Link to={`/deal/${d.id}`}>Open underwriting <ArrowRight className="h-3.5 w-3.5" /></Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function Stat({ label, v }: { label: string; v: string }) {
  return (
    <div className="bg-surface-2/60 rounded-lg p-2">
      <div className="text-[10px] uppercase text-muted-foreground tracking-wide">{label}</div>
      <div className="font-mono tabular text-sm font-semibold mt-0.5">{v}</div>
    </div>
  );
}
