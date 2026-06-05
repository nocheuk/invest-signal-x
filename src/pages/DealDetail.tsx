import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { formatGBP, formatPct } from "@/lib/deals";
import { useDeal } from "@/hooks/useDeals";
import { useDealSourceLinks } from "@/hooks/useDealSourceLinks";
import { ClassificationBadge, ScorePill } from "@/components/RatingBadge";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { Hint } from "@/components/Hint";
import { PIPELINE_STATUSES, type PipelineStatus, useWatchlist } from "@/lib/watchlist";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Bookmark, MapPin, Building2, AlertTriangle, ShieldCheck, TrendingUp, FileText, Layers, Search, ChartLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { downloadDealMemoPdf } from "@/lib/memoPdf";
import { getDealAnalysis } from "@/lib/dealAnalysis";
import { classifyDeal, greenCandidateReasons } from "@/lib/dealClassification";
import { formatAreaValue, getAreaIntelligence } from "@/lib/areaIntelligence";

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
  const { deal, data: allDeals = [], isLoading, isError } = useDeal(id);
  const sourceLinks = useDealSourceLinks(deal?.id);
  const { isWatched, notes, setNote, getPipelineStatus, setStatus, saveToPipeline } = useWatchlist();
  const [memoStatus, setMemoStatus] = useState<"idle" | "loading" | "error">("idle");

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
  const pipelineStatus = getPipelineStatus(deal.id) ?? "Saved";
  const dealAnalysis = getDealAnalysis(deal);
  const areaIntelligence = getAreaIntelligence(deal, allDeals);
  const classification = classifyDeal(deal);
  const candidateReasons = classification === "green-candidate" ? greenCandidateReasons(deal) : [];
  const handleDownloadMemo = async () => {
    setMemoStatus("loading");
    try {
      await downloadDealMemoPdf(deal);
      setMemoStatus("idle");
    } catch (error) {
      console.error("Could not generate memo PDF", error);
      setMemoStatus("error");
    }
  };

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
                  <ClassificationBadge classification={classification} />
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
              <HeroStat label="Passing rent" value={deal.passingRent ? `${formatGBP(deal.passingRent)} pa` : "Not available"} />
              <HeroStat label={<Hint term="NIY">NIY</Hint>} value={deal.netInitialYield ? formatPct(deal.netInitialYield, 2) : "—"} />
              <HeroStat label={<Hint term="WAULT">WAULT</Hint>} value={deal.wault ? `${deal.wault.toFixed(1)} yrs` : "—"} />
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  if (!watched) void saveToPipeline(deal.id);
                }}
                variant={watched ? "default" : "outline"}
                className={cn("gap-2", watched && "bg-primary text-primary-foreground hover:bg-primary/90")}
              >
                <Bookmark className={cn("h-4 w-4", watched && "fill-current")} />
                {watched ? "In pipeline" : "Save to Pipeline"}
              </Button>
              <Button onClick={() => void handleDownloadMemo()} disabled={memoStatus === "loading"} variant="outline" className="gap-2">
                <FileText className="h-4 w-4" />{memoStatus === "loading" ? "Generating memo..." : "Download memo (PDF)"}
              </Button>
            </div>
            {memoStatus === "error" && (
              <div className="mt-3 text-xs text-signal-red">Could not generate the memo PDF. Please try again.</div>
            )}
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

        {dealAnalysis && (
          <section className="ds-card p-6 space-y-4">
            <div>
              <h2 className="font-display text-2xl">Deal analysis</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Deterministic signals generated only from imported source data and underwriting fields.</p>
            </div>
            <p className="rounded-lg border border-border/60 bg-surface-2/40 p-4 text-sm leading-relaxed text-muted-foreground">
              {dealAnalysis.investmentSummary}
            </p>
            <div className="grid md:grid-cols-3 gap-3">
              <ReasonList title="Opportunity signals" items={dealAnalysis.opportunitySignals} fallback="No strong opportunity signal found yet." tone="primary" />
              <ReasonList title="Risk signals" items={dealAnalysis.riskSignals} fallback="No specific risk signal recorded yet." tone="amber" />
              <ReasonList title="Verify before trusting" items={deal.scoreReasons?.verifyBeforeTrusting ?? []} fallback="Standard title, lease and comparable checks still apply." tone="default" />
            </div>
          </section>
        )}

        <section className="ds-card p-6 space-y-4">
          <div>
            <h2 className="font-display text-2xl">Area Intelligence</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Local benchmarks are calculated only from imported DealSignal deals in the same city, postcode area or region.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <AreaIntelStat
              label="Yield"
              value={deal.netInitialYield ? formatPct(deal.netInitialYield, 2) : "Not available"}
              benchmarkLabel={areaIntelligence.stats ? `${areaIntelligence.stats.area} average` : "Area average"}
              benchmark={formatAreaValue(areaIntelligence.stats?.averageYield ?? null, "yield")}
              sample={areaIntelligence.stats?.dealCount ?? 0}
            />
            <AreaIntelStat
              label="£/sqft"
              value={deal.pricePerSqft ? `£${deal.pricePerSqft}` : "Not available"}
              benchmarkLabel={areaIntelligence.stats ? `${areaIntelligence.stats.area} average` : "Area average"}
              benchmark={formatAreaValue(areaIntelligence.stats?.averagePricePerSqft ?? null, "price")}
              sample={areaIntelligence.stats?.dealCount ?? 0}
            />
          </div>
          <ReasonList title="Area insights" items={areaIntelligence.insights} fallback="Limited area data" tone="primary" />
        </section>

        <section className="ds-card p-6 space-y-3">
          <h2 className="font-display text-2xl">Green classification</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Verified Green is deliberately strict: score at least 78 and confidence at least 80. Green Candidate keeps that strict tier intact, but surfaces imported deals with score at least 72, confidence at least 75, a guide price, and either yield or passing rent available.
          </p>
          {classification === "green-candidate" && (
            <ul className="space-y-1.5">
              {candidateReasons.map((reason) => (
                <li key={reason} className="flex items-start gap-2 text-xs text-primary">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

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

        <section className="ds-card p-6 space-y-3">
          <h2 className="font-display text-2xl">Verify before action</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            DealSignal is not financial advice and is not a valuation. Treat the score as a triage signal only. Verify the source listing, price, lease terms, tenancy, title, planning, condition and comparable evidence before making an offer.
          </p>
        </section>
        {/* Pipeline */}
        <div className="ds-card p-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl">Pipeline</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Track this opportunity privately from first save through offer or purchase.</p>
            </div>
            <Select
              value={pipelineStatus}
              onValueChange={(value) => {
                const nextStatus = value as PipelineStatus;
                void (watched ? setStatus(deal.id, nextStatus) : saveToPipeline(deal.id, nextStatus));
              }}
            >
              <SelectTrigger className="h-9 w-[190px] bg-surface-2 border-border/60 text-xs" aria-label="Pipeline status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Textarea
            value={note}
            onChange={(e) => void setNote(deal.id, e.target.value)}
            placeholder="Add a note — pricing target, viewing date, follow-up actions…"
            className="bg-surface-2 border-border/60 min-h-32 resize-none"
          />
          <div className="text-[11px] text-muted-foreground">Notes auto-save to your private pipeline item.</div>
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

function AreaIntelStat({ label, value, benchmarkLabel, benchmark, sample }: { label: string; value: string; benchmarkLabel: string; benchmark: string; sample: number }) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface-2/40 p-4 space-y-3">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="font-mono text-2xl font-semibold tabular mt-1">{value}</div>
      </div>
      <div className="flex items-end justify-between gap-3 border-t border-border/40 pt-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{benchmarkLabel}</div>
          <div className="font-mono text-lg font-semibold tabular mt-0.5">{benchmark}</div>
        </div>
        <div className="text-[11px] text-muted-foreground">{sample ? `${sample} local deals` : "No local sample"}</div>
      </div>
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

