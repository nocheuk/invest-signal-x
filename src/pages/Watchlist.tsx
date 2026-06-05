import { Link } from "react-router-dom";
import { ArrowRight, Bookmark, MapPin, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { RatingBadge, ScorePill } from "@/components/RatingBadge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatGBP, formatPct } from "@/lib/deals";
import { PIPELINE_STATUSES, type PipelineStatus, useWatchlist } from "@/lib/watchlist";
import { useRealDeals } from "@/hooks/useRealDeals";

export default function Watchlist() {
  const { ids, notes, setNote, remove, error, getPipelineStatus, setStatus, pipelineCounts } = useWatchlist();
  const { dealsQuery, deals } = useRealDeals();
  const watched = deals.filter((deal) => ids.includes(deal.id));
  const grouped = PIPELINE_STATUSES.map((status) => ({
    status,
    deals: watched.filter((deal) => (getPipelineStatus(deal.id) ?? "Saved") === status),
  }));
  const activeOpportunities = pipelineCounts.Reviewing + pipelineCounts["Viewing Booked"] + pipelineCounts["Offer Submitted"];

  return (
    <AppLayout>
      <div className="container max-w-7xl py-8 space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-primary font-medium">Pipeline</div>
            <h1 className="font-display text-4xl mt-1">My Pipeline</h1>
            <p className="text-sm text-muted-foreground mt-2">Track saved deals from first review through offer and purchase. Notes are private to your account.</p>
            {error && <p className="text-xs text-signal-red mt-1">{error}</p>}
          </div>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/deals">Browse all deals <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <Metric label="Total saved" value={ids.length} />
          <Metric label="Active opportunities" value={activeOpportunities} />
          <Metric label="Offers submitted" value={pipelineCounts["Offer Submitted"]} />
          <Metric label="Purchased" value={pipelineCounts.Purchased} />
        </section>

        {dealsQuery.isLoading ? (
          <div className="ds-card p-8 text-sm text-muted-foreground">Loading pipeline...</div>
        ) : watched.length === 0 ? (
          <div className="ds-card-elevated p-16 text-center">
            <div className="h-14 w-14 mx-auto rounded-full bg-primary/10 grid place-items-center text-primary mb-4">
              <Bookmark className="h-6 w-6" />
            </div>
            <h2 className="font-display text-2xl">Your pipeline is empty</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">Save deals from the dashboard or All Deals page to track status, notes, and next steps here.</p>
            <Button asChild className="mt-6 gap-2">
              <Link to="/deals">Browse deals <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        ) : (
          <section className="grid gap-4 xl:grid-cols-3 2xl:grid-cols-6">
            {grouped.map(({ status, deals: statusDeals }) => (
              <div key={status} className="ds-card p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">{status}</h2>
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground">{statusDeals.length}</span>
                </div>
                <div className="space-y-3">
                  {statusDeals.map((deal) => (
                    <PipelineCard
                      key={deal.id}
                      deal={deal}
                      note={notes[deal.id] || ""}
                      status={getPipelineStatus(deal.id) ?? "Saved"}
                      onStatus={(value) => void setStatus(deal.id, value)}
                      onNote={(value) => void setNote(deal.id, value)}
                      onRemove={() => void remove(deal.id)}
                    />
                  ))}
                  {statusDeals.length === 0 && <div className="rounded-md border border-dashed border-border/70 p-4 text-xs text-muted-foreground">No deals in this stage.</div>}
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </AppLayout>
  );
}

function PipelineCard({
  deal,
  note,
  status,
  onStatus,
  onNote,
  onRemove,
}: {
  deal: ReturnType<typeof useRealDeals>["deals"][number];
  note: string;
  status: PipelineStatus;
  onStatus: (status: PipelineStatus) => void;
  onNote: (note: string) => void;
  onRemove: () => void;
}) {
  return (
    <article className="rounded-lg border border-border/60 bg-surface-2/60 p-3 space-y-3">
      <div className="flex items-start gap-3">
        <ScorePill score={deal.score} rating={deal.rating} />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <RatingBadge rating={deal.rating} dot={false} />
            <span className="text-[11px] text-muted-foreground">{deal.assetType}</span>
          </div>
          <Link to={`/deal/${deal.id}`} className="block truncate text-sm font-semibold transition-colors hover:text-primary">{deal.title}</Link>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />{deal.location}
          </div>
        </div>
        <button type="button" onClick={onRemove} className="p-1 text-muted-foreground transition-colors hover:text-signal-red" aria-label={`Remove ${deal.title} from pipeline`}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Price" value={formatGBP(deal.guidePrice)} />
        <Stat label="Yield" value={deal.netInitialYield ? formatPct(deal.netInitialYield, 2) : "N/A"} />
        <Stat label="Score" value={deal.score.toString()} />
      </div>
      <Select value={status} onValueChange={(value) => onStatus(value as PipelineStatus)}>
        <SelectTrigger className="h-9 bg-background/70 border-border/60 text-xs" aria-label={`Pipeline status for ${deal.title}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PIPELINE_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
        </SelectContent>
      </Select>
      <Textarea
        placeholder="Notes - viewing booked, target price, contact..."
        value={note}
        onChange={(event) => onNote(event.target.value)}
        className="min-h-20 resize-none bg-background/70 text-sm"
      />
    </article>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="ds-glass p-4">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 font-mono text-2xl font-semibold tabular">{value.toLocaleString()}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-background/70 p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate font-mono text-xs font-semibold tabular">{value}</div>
    </div>
  );
}
