import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Bookmark, MapPin, Building2, AlertTriangle, ShieldCheck, TrendingUp, FileText, Layers, Search, ChartLine, ExternalLink, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { downloadDealMemoPdf } from "@/lib/memoPdf";
import { getDealAnalysis } from "@/lib/dealAnalysis";
import { classificationLabel, classifyDeal, greenCandidateReasons } from "@/lib/dealClassification";
import { getAreaIntelligence } from "@/lib/areaIntelligence";
import { buildComparableEvidence, formatComparableMetric } from "@/lib/comparableEvidence";
import { sourceLabel as getSourceLabel } from "@/lib/dashboardFilters";
import { buildInvestmentThesis } from "@/lib/investmentThesis";
import {
  DEFAULT_FINANCIAL_ASSUMPTIONS,
  buildFinancialAnalysis,
  formatFinancialMoney,
  formatFinancialPercent,
  type FinancialAssumptions,
  type FinanceScenario,
} from "@/lib/financialAnalysis";
import { getNationalRankingForDeal } from "@/lib/dailyOpportunityFeed";
import { useUsageTracking } from "@/lib/usageTracking";
import { buildAnalystScoreBreakdown } from "@/lib/analystScoreBreakdown";

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
  const { trackEvent } = useUsageTracking();
  const [memoStatus, setMemoStatus] = useState<"idle" | "loading" | "error">("idle");
  const [financialAssumptions, setFinancialAssumptions] = useState<FinancialAssumptions>(DEFAULT_FINANCIAL_ASSUMPTIONS);
  const trackedSourceUrl = deal?.sourceUrl ?? sourceLinks.data?.find((link) => link.source_url)?.source_url;

  useEffect(() => {
    if (!deal?.id) return;
    void trackEvent({ eventType: "opened_deal", dealId: deal.id, sourceUrl: trackedSourceUrl });
  }, [deal?.id, trackedSourceUrl, trackEvent]);

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
  const comparableEvidence = buildComparableEvidence(deal, allDeals);
  const nationalRanking = getNationalRankingForDeal(deal, allDeals);
  const investmentThesis = buildInvestmentThesis(deal, { areaIntelligence, comparableEvidence });
  const analystScoreBreakdown = buildAnalystScoreBreakdown(deal, { comparableEvidence });
  const classification = classifyDeal(deal);
  const candidateReasons = classification === "green-candidate" ? greenCandidateReasons(deal) : [];
  const primarySourceUrl = trackedSourceUrl;
  const sourceLabel = getSourceLabel(deal);
  const visibleYield = deal.netInitialYield || deal.grossYield;
  const pricePerSqft = deal.pricePerSqft || (deal.guidePrice > 0 && deal.sqft > 0 ? deal.guidePrice / deal.sqft : 0);
  const addedDate = new Date(deal.postedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const financialAnalysis = buildFinancialAnalysis(deal, financialAssumptions);

  const handleDownloadMemo = async () => {
    setMemoStatus("loading");
    try {
      await downloadDealMemoPdf(deal, { comparableEvidence, nationalRanking });
      void trackEvent({ eventType: "downloaded_investment_pack", dealId: deal.id, sourceUrl: primarySourceUrl });
      setMemoStatus("idle");
    } catch (error) {
      console.error("Could not generate investment pack", error);
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
        <div className={cn("ds-premium-panel overflow-hidden relative")}>
          <div className={cn("absolute inset-0 bg-gradient-to-br opacity-30", deal.thumbnail)} />
          {deal.imageUrl && <img src={deal.imageUrl} alt={deal.title} className="absolute inset-0 h-full w-full object-cover opacity-60" />}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
          <div className="absolute inset-0 ds-grid-bg opacity-30" />
          <div className="relative p-6 lg:p-8">
            <div className="flex items-start justify-between flex-wrap gap-6">
              <div className="space-y-3 max-w-2xl">
                <div className="flex items-center gap-2">
                  <ClassificationBadge classification={classification} className={classification === "green-candidate" ? "bg-primary/20 shadow-lg shadow-primary/20" : undefined} />
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
              <ActionButton
                onClick={() => {
                  if (!watched) {
                    void saveToPipeline(deal.id);
                  }
                }}
                active={watched}
                icon={Bookmark}
              >
                {watched ? "In pipeline" : "Save to Pipeline"}
              </ActionButton>
              <ActionButton onClick={() => void handleDownloadMemo()} disabled={memoStatus === "loading"} icon={FileText}>
                {memoStatus === "loading" ? "Generating pack..." : "Download Investment Pack"}
              </ActionButton>
              {primarySourceUrl && (
                <Button asChild variant="outline" className="gap-2 border-white/10 bg-surface-2/70 hover:border-primary/40 hover:bg-primary/10">
                  <a href={primarySourceUrl} target="_blank" rel="noreferrer" onClick={() => void trackEvent({ eventType: "opened_source_listing", dealId: deal.id, sourceUrl: primarySourceUrl })}>
                    <ExternalLink className="h-4 w-4" />Open Source Listing
                  </a>
                </Button>
              )}
            </div>
            {memoStatus === "error" && (
              <div className="mt-3 text-xs text-signal-red">Could not generate the investment pack. Please try again.</div>
            )}
          </div>
        </div>

        <section className="ds-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-primary font-medium">Investment Pack</div>
              <h2 className="mt-1 font-display text-2xl">A structured pack for investor review</h2>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Includes executive summary, investment thesis, tenant and lease data, cleaned comparable evidence, finance scenarios, verification checklist and disclaimer.
              </p>
            </div>
            <Button type="button" variant="outline" disabled={memoStatus === "loading"} onClick={() => void handleDownloadMemo()} className="gap-2">
              <FileText className="h-4 w-4" />
              {memoStatus === "loading" ? "Generating..." : "Download pack"}
            </Button>
          </div>
        </section>

        <section className="ds-glass p-5 lg:p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-widest text-primary font-medium">National Ranking</div>
              <h2 className="font-display text-2xl mt-1">Where this deal sits in the DealSignal feed</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Ranked nationally against imported acquisition opportunities using the existing score, confidence, yield, area value and diligence signals.</p>
            </div>
            {nationalRanking && (
              <div className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                Top {nationalRanking.topPercent}% nationally
              </div>
            )}
          </div>
          {nationalRanking ? (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <SnapshotMetric label="Rank" value={`#${nationalRanking.rank} of ${nationalRanking.total}`} />
                <SnapshotMetric label="Percentile" value={`${formatPercentile(nationalRanking.percentile)} percentile`} />
                <SnapshotMetric label="Top band" value={`Top ${nationalRanking.topPercent}%`} />
                <SnapshotMetric label="Feed score" value={`${nationalRanking.rankingScore}/100`} />
              </div>
              <ReasonList title="Why it made the list" items={nationalRanking.whyMadeList} fallback="High relative DealSignal rank." tone="primary" />
            </>
          ) : (
            <p className="rounded-lg border border-border/60 bg-surface-2/40 p-4 text-sm text-muted-foreground">
              This deal is not currently ranked in the national opportunity feed, usually because it is not an imported acquisition opportunity.
            </p>
          )}
        </section>

        <section className="ds-glass p-5 lg:p-6 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-widest text-primary font-medium">Investment Snapshot</div>
              <h2 className="font-display text-2xl mt-1">Key underwriting inputs</h2>
            </div>
            <ConfidenceBadge level={deal.confidenceLevel} score={deal.dataConfidenceScore} />
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
            <SnapshotMetric label="Guide price" value={deal.guidePrice > 0 ? formatGBP(deal.guidePrice) : "Not available"} />
            <SnapshotMetric label="Yield" value={visibleYield ? formatPct(visibleYield, 2) : "Not available"} />
            <SnapshotMetric label="Sq ft" value={deal.sqft ? deal.sqft.toLocaleString() : "Not available"} />
            <SnapshotMetric label="£/sqft" value={pricePerSqft ? formatGBP(Math.round(pricePerSqft)) : "Not available"} />
            <SnapshotMetric label="Source" value={sourceLabel} />
            <SnapshotMetric label="Added" value={addedDate} />
            <SnapshotMetric label="Confidence" value={deal.dataConfidenceScore !== undefined ? `${deal.dataConfidenceScore}/100` : "Not available"} />
          </div>
        </section>

        <section className="ds-premium-panel p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-widest text-primary font-medium">Financial Analysis</div>
              <h2 className="font-display text-2xl mt-1">Deal stack and return scenarios</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Deterministic estimate using guide price, passing rent and editable finance assumptions. Missing rent is not inferred.
              </p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            <SnapshotMetric label="Guide price" value={formatFinancialMoney(financialAnalysis.acquisitionCosts.guidePrice)} />
            <SnapshotMetric label="SDLT" value={formatFinancialMoney(financialAnalysis.acquisitionCosts.sdlt)} />
            <SnapshotMetric label="Legal fees" value={formatFinancialMoney(financialAnalysis.acquisitionCosts.legalFees)} />
            <SnapshotMetric label="Survey fees" value={formatFinancialMoney(financialAnalysis.acquisitionCosts.surveyFees)} />
            <SnapshotMetric label="Total acquisition" value={formatFinancialMoney(financialAnalysis.acquisitionCosts.totalAcquisitionCost)} />
          </div>
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            <AssumptionInput label="Interest rate" suffix="%" value={financialAssumptions.interestRatePct} onChange={(value) => updateFinancialAssumption(setFinancialAssumptions, "interestRatePct", value)} />
            <AssumptionInput label="Legal fees" value={financialAssumptions.legalFees} onChange={(value) => updateFinancialAssumption(setFinancialAssumptions, "legalFees", value)} />
            <AssumptionInput label="Survey fees" value={financialAssumptions.surveyFees} onChange={(value) => updateFinancialAssumption(setFinancialAssumptions, "surveyFees", value)} />
            <AssumptionInput label="Arrangement fee" suffix="%" value={financialAssumptions.arrangementFeePct} onChange={(value) => updateFinancialAssumption(setFinancialAssumptions, "arrangementFeePct", value)} />
            <AssumptionInput label="Void allowance" suffix="%" value={financialAssumptions.voidAllowancePct} onChange={(value) => updateFinancialAssumption(setFinancialAssumptions, "voidAllowancePct", value)} />
            <AssumptionInput label="Management" suffix="%" value={financialAssumptions.managementAllowancePct} onChange={(value) => updateFinancialAssumption(setFinancialAssumptions, "managementAllowancePct", value)} />
          </div>
          <div className="grid gap-3 xl:grid-cols-4">
            {financialAnalysis.scenarios.map((scenario) => (
              <FinanceScenarioCard key={scenario.name} scenario={scenario} />
            ))}
          </div>
          {financialAnalysis.scenarios.every((scenario) => scenario.missingRent) && (
            <div className="rounded-lg border border-signal-amber/30 bg-signal-amber-soft/20 px-4 py-3 text-xs text-signal-amber">
              Passing rent is missing, so DealSignal cannot calculate net cashflow or cash-on-cash return without inventing income.
            </div>
          )}
        </section>

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
          <section className="ds-glass p-6 space-y-4">
            <div>
              <h2 className="font-display text-2xl">Deal analysis</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Deterministic signals generated only from imported source data and underwriting fields.</p>
            </div>
            <p className="rounded-lg border border-border/60 bg-surface-2/40 p-4 text-sm leading-relaxed text-muted-foreground">
              {dealAnalysis.investmentSummary}
            </p>
            <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
              <ReasonList title="Opportunity signals" items={dealAnalysis.opportunitySignals} fallback="No strong opportunity signal found yet." tone="primary" />
              <ReasonList title="Risk signals" items={dealAnalysis.riskSignals} fallback="No specific risk signal recorded yet." tone="amber" />
              <ReasonList title="Missing data" items={deal.scoreReasons?.missingDataWarnings ?? []} fallback="No missing-data warning recorded." tone="red" />
              <ReasonList title="Verify before trusting" items={deal.scoreReasons?.verifyBeforeTrusting ?? []} fallback="Standard title, lease and comparable checks still apply." tone="default" />
            </div>
          </section>
        )}

        <section className="ds-premium-panel p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-widest text-primary font-medium">Investment Thesis</div>
              <h2 className="font-display text-2xl mt-1">Why this deal may make financial sense</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Generated deterministically from imported fields, area intelligence, scoring signals and missing-data warnings.</p>
            </div>
            <div className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {investmentThesis.investorVerdict}
            </div>
          </div>
          <p className="rounded-lg border border-border/60 bg-background/50 p-4 text-sm leading-relaxed text-muted-foreground">
            {investmentThesis.summary}
          </p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ReasonList title="Why it looks interesting" items={investmentThesis.whyInteresting} fallback="No strong opportunity signal found yet." tone="primary" />
            <ReasonList title="Potential upside" items={investmentThesis.potentialUpside} fallback="No calculated upside signal available yet." tone="primary" />
            <ReasonList title="Key risks" items={investmentThesis.keyRisks} fallback="No specific risk signal recorded yet." tone="amber" />
            <ReasonList title="What to verify next" items={investmentThesis.verifyNext} fallback="Standard title, lease and comparable checks still apply." tone="default" />
          </div>
          <div className="text-xs text-muted-foreground">Thesis confidence: {investmentThesis.confidenceLevel}</div>
        </section>

        <section className="ds-glass p-6 space-y-4">
          <div>
            <h2 className="font-display text-2xl">Comparable Evidence</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Benchmarks use imported DealSignal opportunities only, grouped by local area and asset type where the sample allows.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <SnapshotMetric label="This deal yield" value={formatComparableMetric(comparableEvidence.dealYield, "yield")} />
            <SnapshotMetric label="Local avg yield" value={formatComparableMetric(comparableEvidence.averageYield, "yield")} />
            <SnapshotMetric label="Yield difference" value={formatComparableMetric(comparableEvidence.yieldDifferencePercent, "percent")} />
            <SnapshotMetric label="Yield percentile" value={formatComparableMetric(comparableEvidence.yieldPercentileRank, "percentile")} />
            <SnapshotMetric label="This deal GBP/sqft" value={formatComparableMetric(comparableEvidence.dealPricePerSqft, "price")} />
            <SnapshotMetric label="Local avg GBP/sqft" value={formatComparableMetric(comparableEvidence.averagePricePerSqft, "price")} />
            <SnapshotMetric label="GBP/sqft difference" value={formatComparableMetric(comparableEvidence.pricePerSqftDifferencePercent, "percent")} />
            <SnapshotMetric label="Cleaned sample" value={`${comparableEvidence.cleanedSampleSize} usable comps`} />
            <SnapshotMetric label="Raw sample" value={`${comparableEvidence.rawSampleSize} imported peers`} />
            <SnapshotMetric label="Excluded" value={`${comparableEvidence.excludedSampleSize} outlier/incomplete`} />
          </div>
          {comparableEvidence.isLimited && (
            <div className="rounded-lg border border-signal-amber/30 bg-signal-amber-soft/20 px-4 py-3 text-xs text-signal-amber">
              Comparable evidence limited. Fewer than five usable local peers remain after excluding outliers, incomplete records and low-confidence data.
            </div>
          )}
          <ReasonList title="Evidence statements" items={comparableEvidence.statements} fallback="Comparable evidence is not available from imported DealSignal data yet." tone="primary" />
        </section>

        <section className="ds-premium-panel p-6 space-y-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-primary font-medium">Analyst Score Breakdown</div>
            <h2 className="font-display text-2xl mt-1">Why this scored highly</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{analystScoreBreakdown.explanation}</p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <ScoreContributorList title="Positive contributors" items={analystScoreBreakdown.positives} tone="positive" />
            <ScoreContributorList title="Negative contributors" items={analystScoreBreakdown.negatives} tone="negative" />
          </div>
        </section>


        <section className="ds-card p-6 space-y-3">
          <h2 className="font-display text-2xl">Diligence classification</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This deal is currently classified as {classificationLabel(classification)}. Top Opportunity remains deliberately strict: score at least 78 and confidence at least 80. Strong Opportunity keeps that strict tier intact, while Requires Due Diligence means the opportunity has usable acquisition data but still needs source documents, lease checks or comparable evidence. Low Priority is reserved for sparse or severe missing-data listings.
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
    <div className="bg-surface-2/80 backdrop-blur border border-white/10 rounded-lg p-3 shadow-lg shadow-black/20">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono text-lg font-semibold tabular mt-0.5">{value}</div>
    </div>
  );
}

function ScoreContributorList({
  title,
  items,
  tone,
}: {
  title: string;
  items: ReturnType<typeof buildAnalystScoreBreakdown>["positives"];
  tone: "positive" | "negative";
}) {
  const dot = tone === "positive" ? "bg-signal-green" : "bg-signal-amber";
  const valueClass = tone === "positive" ? "text-signal-green" : "text-signal-amber";
  return (
    <div className="rounded-lg border border-border/60 bg-surface-2/40 p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{title}</div>
      <div className="mt-3 space-y-3">
        {items.length ? items.map((item) => (
          <div key={`${item.label}-${item.detail}`} className="grid grid-cols-[auto_1fr] gap-2 text-sm">
            <span className={cn("mt-2 h-1.5 w-1.5 rounded-full", dot)} />
            <div>
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{item.label}</span>
                <span className={cn("font-mono text-xs font-semibold tabular", valueClass)}>
                  {item.value > 0 ? `+${item.value}` : item.value}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
            </div>
          </div>
        )) : (
          <p className="text-xs text-muted-foreground">No major {tone === "positive" ? "positive" : "negative"} contributors recorded.</p>
        )}
      </div>
    </div>
  );
}

function SnapshotMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-surface-2/60 p-3 transition-colors hover:border-primary/30">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 break-words font-mono text-sm font-semibold tabular">{value}</div>
    </div>
  );
}

function AssumptionInput({ label, value, suffix, onChange }: { label: string; value: number; suffix?: string; onChange: (value: number) => void }) {
  return (
    <label className="space-y-1.5 rounded-lg border border-border/60 bg-surface-2/40 p-3">
      <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-8 bg-background/70 font-mono text-sm"
        />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </label>
  );
}

function FinanceScenarioCard({ scenario }: { scenario: FinanceScenario }) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface-2/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{scenario.name}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{scenario.ltv ? `${Math.round(scenario.ltv * 100)}% loan-to-value` : "No debt"}</div>
        </div>
        <div className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
          {formatFinancialPercent(scenario.cashOnCashReturn)}
        </div>
      </div>
      <div className="mt-4 space-y-2 text-xs">
        <FinanceRow label="Cash required" value={formatFinancialMoney(scenario.cashRequired)} />
        <FinanceRow label="Annual rent" value={formatFinancialMoney(scenario.annualRent)} />
        <FinanceRow label="Finance cost" value={formatFinancialMoney(scenario.annualFinanceCost)} />
        <FinanceRow label="Net cashflow" value={formatFinancialMoney(scenario.annualNetCashflow)} />
        <FinanceRow label="Net yield" value={formatFinancialPercent(scenario.netYield)} />
        <FinanceRow label="Cash-on-cash" value={formatFinancialPercent(scenario.cashOnCashReturn)} />
      </div>
    </div>
  );
}

function FinanceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium tabular">{value}</span>
    </div>
  );
}

function updateFinancialAssumption(
  setFinancialAssumptions: React.Dispatch<React.SetStateAction<FinancialAssumptions>>,
  key: keyof FinancialAssumptions,
  value: number
) {
  setFinancialAssumptions((current) => ({ ...current, [key]: Number.isFinite(value) ? value : 0 }));
}

function ActionButton({
  children,
  icon: Icon,
  active,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      variant={active ? "default" : "outline"}
      className={cn(
        "gap-2 transition-all hover:-translate-y-0.5",
        active
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "border-white/10 bg-surface-2/70 hover:border-primary/40 hover:bg-primary/10"
      )}
    >
      <Icon className={cn("h-4 w-4", active && "fill-current")} />
      {children}
    </Button>
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

function formatPercentile(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
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

