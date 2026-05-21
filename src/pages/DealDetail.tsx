import { Link, useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { COMPARABLES, formatGBP, formatPct } from "@/lib/deals";
import { useDeal } from "@/hooks/useDeals";
import { useDealSourceLinks } from "@/hooks/useDealSourceLinks";
import { ScorePill, RatingBadge } from "@/components/RatingBadge";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { Hint } from "@/components/Hint";
import { useWatchlist } from "@/lib/watchlist";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Bookmark, MapPin, Building2, Sparkles, AlertTriangle, ShieldCheck, TrendingUp, FileText, Layers, Search, ChartLine, Map as MapIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const WEIGHTS = [
  { key: "incomeQuality", label: "Yield & income quality", w: 30 },
  { key: "marketPricing", label: "Price & value signal", w: 20 },
  { key: "tenantSecurity", label: "Asset & location signal", w: 15 },
  { key: "upside", label: "Upside signal", w: 15 },
  { key: "riskExit", label: "Risk & data confidence", w: 20 },
] as const;

export default function DealDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { deal, isLoading, isError } = useDeal(id);
  const sourceLinks = useDealSourceLinks(deal?.id);
  const { isWatched, toggle, notes, setNote } = useWatchlist();

  if (isLoading) {
    return (
      <AppLayout>
        <div className="container py-20 text-center text-sm text-muted-foreground">Loading deal...</div>
      </AppLayout>
    );
  }

  if (!deal) {
    return (
      <AppLayout>
        <div className="container py-20 text-center">
          <p className="text-muted-foreground">{isError ? "Could not load this deal." : "Deal not found."}</p>
          <Button asChild variant="link"><Link to="/dashboard">Back to dashboard</Link></Button>
        </div>
      </AppLayout>
    );
  }

  const watched = isWatched(deal.id);
  const note = notes[deal.id] || "";

  return (
    <AppLayout>
      <div className="container max-w-7xl py-6 lg:py-8 space-y-6">
        <button onClick={() => navigate(-1)} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>

        {/* Hero card */}
        <div className={cn("ds-card-elevated overflow-hidden relative")}>
          <div className={cn("absolute inset-0 bg-gradient-to-br opacity-30", deal.thumbnail)} />
          <div className="absolute inset-0 ds-grid-bg opacity-40" />
          <div className="relative p-6 lg:p-8">
            <div className="flex items-start justify-between flex-wrap gap-6">
              <div className="space-y-3 max-w-2xl">
                <div className="flex items-center gap-2">
                  <RatingBadge rating={deal.rating} />
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">{deal.assetType} · {deal.source}</span>
                </div>
                <h1 className="font-display text-4xl lg:text-5xl tracking-tight">{deal.title}</h1>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />{deal.location} · {deal.region}</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">DealSignal Score</div>
                  <div className="font-display text-6xl text-gradient-primary leading-none mt-1">{deal.score}</div>
                  <div className="mt-2 flex justify-end">
                    <ConfidenceBadge level={deal.confidenceLevel} score={deal.dataConfidenceScore} />
                  </div>
                </div>
                <ScorePill score={deal.score} rating={deal.rating} size="lg" />
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <HeroStat label="Guide price" value={formatGBP(deal.guidePrice)} />
              <HeroStat label="Passing rent" value={deal.passingRent ? `${formatGBP(deal.passingRent)} pa` : "Vacant"} />
              <HeroStat label={<Hint term="NIY">NIY</Hint>} value={deal.netInitialYield ? formatPct(deal.netInitialYield, 2) : "—"} />
              <HeroStat label={<Hint term="WAULT">WAULT</Hint>} value={deal.wault ? `${deal.wault.toFixed(1)} yrs` : "—"} />
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <Button onClick={() => void toggle(deal.id)} variant={watched ? "default" : "outline"} className={cn("gap-2", watched && "bg-primary text-primary-foreground hover:bg-primary/90")}>
                <Bookmark className={cn("h-4 w-4", watched && "fill-current")} />
                {watched ? "Watching" : "Add to watchlist"}
              </Button>
              <Button variant="outline" className="gap-2"><FileText className="h-4 w-4" />Download memo (PDF)</Button>
              <Button variant="outline" className="gap-2"><Sparkles className="h-4 w-4" />Re-run AI analysis</Button>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-5">
          {/* Score breakdown */}
          <div className="ds-card p-6 lg:col-span-2 space-y-5">
            <div>
              <h2 className="font-display text-2xl">Score breakdown</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Weighted across five institutional underwriting categories.</p>
            </div>
            <div className="space-y-3">
              {WEIGHTS.map((c) => {
                const score = deal.scoreBreakdown[c.key];
                return (
                  <div key={c.key} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span>{c.label}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{c.w}%</span>
                      </div>
                      <span className="font-mono tabular text-sm font-semibold">{score}<span className="text-muted-foreground text-xs">/100</span></span>
                    </div>
                    <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                      <div className={cn(
                        "h-full rounded-full transition-all",
                        score >= 75 ? "bg-gradient-to-r from-signal-green to-emerald-400" :
                        score >= 55 ? "bg-gradient-to-r from-signal-amber to-yellow-400" :
                        "bg-gradient-to-r from-signal-red to-rose-400"
                      )} style={{ width: `${score}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Risk flags */}
          <div className="ds-card p-6 space-y-4">
            <h2 className="font-display text-2xl">Risk flags</h2>
            <div className="space-y-2">
              <RiskRow level={deal.rating === "red" ? "high" : deal.rating === "amber" ? "med" : "low"} label="Main risk" value={deal.mainRiskFlag} />
              <RiskRow level={deal.voidRiskScore > 50 ? "high" : deal.voidRiskScore > 25 ? "med" : "low"} label="Void / reletting" value={`${deal.voidRiskScore}/100`} />
              <RiskRow level={deal.exitYieldSensitivity === "High" ? "high" : deal.exitYieldSensitivity === "Moderate" ? "med" : "low"} label={<Hint term="Exit yield sensitivity">Exit sensitivity</Hint>} value={deal.exitYieldSensitivity} />
              <RiskRow level={deal.covenantStrength === "Weak" || deal.covenantStrength === "Vacant" ? "high" : deal.covenantStrength === "Moderate" ? "med" : "low"} label="Covenant" value={deal.covenantStrength} />
              {deal.auctionGuideRisk && (
                <RiskRow level={deal.auctionGuideRisk === "High" ? "high" : deal.auctionGuideRisk === "Moderate" ? "med" : "low"} label="Guide-price risk" value={deal.auctionGuideRisk} />
              )}
            </div>
            {deal.redFlags.length > 0 && (
              <div className="pt-3 border-t border-border/60">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">Hidden red flags</div>
                <ul className="space-y-1.5 text-xs">
                  {deal.redFlags.map((f, i) => (
                    <li key={i} className="flex items-start gap-2"><AlertTriangle className="h-3 w-3 text-signal-red shrink-0 mt-0.5" />{f}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {deal.scoreReasons && (
          <section className="ds-card p-6 space-y-4">
            <div>
              <h2 className="font-display text-2xl">Scoring notes</h2>
              <p className="text-xs text-muted-foreground mt-0.5">What DealSignal can verify from imported source data today.</p>
            </div>
            <div className="grid md:grid-cols-4 gap-3">
              <ReasonList title="Why this scored well" items={deal.scoreReasons.positiveDrivers} fallback="No strong positive drivers found yet." tone="primary" />
              <ReasonList title="Negative drivers" items={deal.scoreReasons.negativeDrivers} fallback="No extra negative drivers found yet." tone="red" />
              <ReasonList title="What is missing" items={deal.scoreReasons.missingDataWarnings} fallback="No major missing fields flagged." tone="amber" />
              <ReasonList title="Verify before trusting" items={deal.scoreReasons.verifyBeforeTrusting} fallback="Standard title, lease and comparable checks still apply." tone="default" />
            </div>
          </section>
        )}

        {/* Underwriting breakdown grid */}
        <section className="space-y-3">
          <h2 className="font-display text-2xl">Professional underwriting breakdown</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <UWCard icon={TrendingUp} title="Income quality" rows={[
              ["Gross yield", deal.grossYield ? formatPct(deal.grossYield, 2) : "—"],
              [<Hint term="NIY" key="niy">NIY</Hint>, deal.netInitialYield ? formatPct(deal.netInitialYield, 2) : "—"],
              [<Hint term="Reversionary yield" key="rev">Reversion</Hint>, deal.reversionaryYield ? formatPct(deal.reversionaryYield, 2) : "—"],
              [<Hint term="Rent sustainability" key="rs">Rent sustain.</Hint>, deal.rentSustainability],
            ]} />
            <UWCard icon={ShieldCheck} title="Tenant covenant" rows={[
              ["Tenant", deal.tenant.length > 18 ? deal.tenant.slice(0, 16) + "…" : deal.tenant],
              [<Hint term="Covenant strength" key="cs">Strength</Hint>, deal.covenantStrength],
              ["Health score", `${deal.tenantHealthScore}/100`],
            ]} />
            <UWCard icon={FileText} title="Lease security" rows={[
              [<Hint term="WAULT" key="w">WAULT</Hint>, deal.wault ? `${deal.wault.toFixed(1)}y` : "—"],
              ["Lease length", deal.leaseLength ? `${deal.leaseLength}y` : "—"],
              [<Hint term="Rent review" key="rr">Reviews</Hint>, deal.rentReview],
            ]} />
            <UWCard icon={Building2} title="Market pricing" rows={[
              ["Price", formatGBP(deal.guidePrice)],
              ["£ / sqft", `£${deal.pricePerSqft}`],
              ["Sqft", deal.sqft.toLocaleString()],
            ]} />
            <UWCard icon={Layers} title="Planning upside" rows={[
              [<Hint term="Planning upside" key="pu">Score</Hint>, `${deal.planningUpsideScore}/100`],
              ["Asset type", deal.assetType],
            ]} />
            <UWCard icon={AlertTriangle} title="Exit risk" rows={[
              [<Hint term="Void risk" key="vr">Void risk</Hint>, `${deal.voidRiskScore}/100`],
              [<Hint term="Exit yield sensitivity" key="ex">Exit cap</Hint>, deal.exitYieldSensitivity],
            ]} />
            <UWCard icon={ChartLine} title="Debt sensitivity" rows={[
              [<Hint term="Cashflow after debt" key="cf">CF after debt</Hint>, `${formatGBP(deal.cashflowAfterDebt)} pa`],
              [<Hint term="Return on equity" key="roe">RoE</Hint>, `${deal.returnOnEquity.toFixed(1)}%`],
            ]} />
            <UWCard icon={Search} title="Source" rows={[
              ["Channel", deal.source],
              ["Posted", new Date(deal.postedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })],
            ]} />
          </div>
        </section>

        {/* Smart investor insights */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-display text-2xl">What smart investors would notice</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <InsightCard label="Why this may be mispriced" tone="primary" body={deal.insights.mispricing} />
            <InsightCard label="What could go wrong" tone="amber" body={deal.insights.couldGoWrong} />
            <InsightCard label="What to ask the agent" tone="default" body={deal.insights.askAgent} />
            <InsightCard label="Negotiation angle" tone="primary" body={deal.insights.negotiation} />
          </div>
        </section>

        {sourceLinks.data && sourceLinks.data.length > 0 && (
          <section className="ds-card p-6 space-y-3">
            <h2 className="font-display text-2xl">Source attribution</h2>
            <div className="space-y-2">
              {sourceLinks.data.map((link) => (
                <div key={link.id} className="flex items-center justify-between gap-3 text-sm border-b border-border/40 last:border-0 py-2">
                  <span className="text-muted-foreground">Imported source</span>
                  {link.source_url ? (
                    <a href={link.source_url} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate max-w-md">
                      {link.source_url}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">No source URL recorded</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Comparables + map */}
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="ds-card p-6 lg:col-span-2 space-y-4">
            <div>
              <h2 className="font-display text-2xl">Comparable transactions</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Recent sales within sector and lot-size range.</p>
            </div>
            <div className="overflow-hidden">
              <div className="grid grid-cols-12 gap-3 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/60">
                <div className="col-span-5">Asset</div>
                <div className="col-span-3">Location</div>
                <div className="col-span-2 text-right">Price</div>
                <div className="col-span-2 text-right">Yield</div>
              </div>
              {COMPARABLES.default.map((c, i) => (
                <div key={i} className="grid grid-cols-12 gap-3 px-3 py-3 text-sm border-b border-border/30 last:border-0">
                  <div className="col-span-5">{c.title}<div className="text-[11px] text-muted-foreground">{c.date}</div></div>
                  <div className="col-span-3 text-muted-foreground text-xs self-center">{c.location}</div>
                  <div className="col-span-2 text-right font-mono tabular self-center">{formatGBP(c.price)}</div>
                  <div className="col-span-2 text-right font-mono tabular self-center">{c.yield.toFixed(2)}%</div>
                </div>
              ))}
            </div>
          </div>

          <div className="ds-card overflow-hidden">
            <div className="relative h-48 bg-surface-2 ds-grid-bg">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
              <div className="absolute inset-0 grid place-items-center">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
                  <div className="relative h-8 w-8 rounded-full bg-primary border-4 border-background grid place-items-center">
                    <MapPin className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 space-y-1">
              <div className="flex items-center gap-1.5 text-sm font-medium"><MapIcon className="h-3.5 w-3.5 text-primary" />{deal.location}</div>
              <div className="text-xs text-muted-foreground">{deal.region} · 12 comparable assets within 5 miles</div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="ds-card p-6 space-y-3">
          <h2 className="font-display text-2xl">Your notes</h2>
          <Textarea
            value={note}
            onChange={(e) => void setNote(deal.id, e.target.value)}
            placeholder="Add a note — pricing target, viewing date, follow-up actions…"
            className="bg-surface-2 border-border/60 min-h-32 resize-none"
          />
          <div className="text-[11px] text-muted-foreground">Notes auto-save to your watchlist.</div>
        </div>
      </div>
    </AppLayout>
  );
}

function HeroStat({ label, value }: { label: React.ReactNode; value: string }) {
  return (
    <div className="bg-surface-2/70 backdrop-blur border border-border/40 rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono text-lg font-semibold tabular mt-0.5">{value}</div>
    </div>
  );
}

function RiskRow({ level, label, value }: { level: "low" | "med" | "high"; label: React.ReactNode; value: React.ReactNode }) {
  const dot = level === "low" ? "bg-signal-green" : level === "med" ? "bg-signal-amber" : "bg-signal-red";
  return (
    <div className="flex items-center justify-between text-sm py-1">
      <div className="flex items-center gap-2 text-muted-foreground"><span className={cn("h-1.5 w-1.5 rounded-full", dot)} />{label}</div>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function UWCard({ icon: Icon, title, rows }: { icon: React.ComponentType<{ className?: string }>; title: string; rows: [React.ReactNode, React.ReactNode][] }) {
  return (
    <div className="ds-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" />{title}</div>
      <div className="space-y-1.5">
        {rows.map(([l, v], i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{l}</span>
            <span className="font-mono tabular font-medium">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InsightCard({ label, body, tone }: { label: string; body: string; tone: "primary" | "amber" | "default" }) {
  const accent = tone === "primary" ? "border-primary/30 bg-primary/5" : tone === "amber" ? "border-signal-amber/30 bg-signal-amber/5" : "border-border bg-surface-2/40";
  return (
    <div className={cn("rounded-xl border p-5", accent)}>
      <div className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">{label}</div>
      <p className="text-sm leading-relaxed mt-2">{body}</p>
    </div>
  );
}

function ReasonList({ title, items, fallback, tone }: { title: string; items: string[]; fallback: string; tone: "primary" | "amber" | "red" | "default" }) {
  const dot = tone === "primary" ? "bg-primary" : tone === "amber" ? "bg-signal-amber" : tone === "red" ? "bg-signal-red" : "bg-muted-foreground";
  const shown = items.length > 0 ? items : [fallback];

  return (
    <div className="rounded-lg border border-border/60 bg-surface-2/40 p-4 space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{title}</div>
      <ul className="space-y-1.5">
        {shown.map((item) => (
          <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
            <span className={cn("mt-1.5 h-1.5 w-1.5 rounded-full shrink-0", dot)} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
