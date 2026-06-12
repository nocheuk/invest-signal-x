import { useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, FileText, RadioTower, ShieldAlert } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { isAdminUser } from "@/lib/admin";
import { useAuth } from "@/lib/auth";
import { buildInventoryAudit, formatInventoryAuditReport } from "@/lib/inventoryAudit";
import { buildDashboardKpis } from "@/lib/dashboardKpis";
import { IMPORT_SOURCE_OPTIONS } from "@/lib/dashboardFilters";
import { classificationLabel, type DealClassification } from "@/lib/dealClassification";
import { buildSourceHealth, investorSourceStatus, splitInvestorSourceRows, summarizeSourceHealth, type InvestorSourceStatus, type SourceHealthRow, type SourceHealthStatus } from "@/lib/sourceHealth";
import { buildSourceOpportunityAudit } from "@/lib/sourceOpportunityAudit";
import { useRealDeals } from "@/hooks/useRealDeals";
import { formatNationalScanTime, formatScanDuration, useNationalScanStatus } from "@/hooks/useNationalScanStatus";
import { useFeedbackUsageAdmin, type FeedbackUsageAdminData } from "@/hooks/useFeedbackUsageAdmin";
import { useWatchlist } from "@/lib/watchlist";

export default function SourcesScans() {
  const auth = useAuth();
  const { deals } = useRealDeals();
  const { ids, pipelineCounts } = useWatchlist();
  const scanStatus = useNationalScanStatus();
  const [report, setReport] = useState("");
  const [showMonitoredSources, setShowMonitoredSources] = useState(false);
  const inventory = useMemo(() => buildInventoryAudit({ deals, scanStatus: scanStatus.data }), [deals, scanStatus.data]);
  const sourceHealth = useMemo(() => buildSourceHealth({ deals, scanRuns: scanStatus.data?.sourceScanRuns ?? [] }), [deals, scanStatus.data?.sourceScanRuns]);
  const sourceHealthSummary = useMemo(() => summarizeSourceHealth(sourceHealth), [sourceHealth]);
  const investorRows = useMemo(() => splitInvestorSourceRows(sourceHealth), [sourceHealth]);
  const sourceAudit = useMemo(() => buildSourceOpportunityAudit(), []);
  const kpis = useMemo(() => buildDashboardKpis({ allDeals: deals, filteredDeals: deals, watchlistIds: ids, pipelineCounts, totalDatabaseDeals: scanStatus.data?.totalDeals }), [deals, ids, pipelineCounts, scanStatus.data?.totalDeals]);
  const enrichmentMetrics = scanStatus.data?.enrichmentMetrics ?? { total: 0, enriched: 0, failed: 0, pending: 0, queueSize: 0, successRate: 0 };
  const enrichmentImpact = scanStatus.data?.enrichmentImpact;
  const showTechnicalDiagnostics = isAdminUser(auth.user) || sourceDiagnosticsEnabled();
  const feedbackUsage = useFeedbackUsageAdmin(showTechnicalDiagnostics);
  const latestSourceUpdate = latestSuccessfulScan(sourceHealth);

  return (
    <AppLayout>
      <div className="container max-w-7xl py-8 space-y-8">
        <header>
          <div className="text-xs uppercase tracking-widest text-primary font-medium">Sources / Scans</div>
          <h1 className="font-display text-4xl mt-1">Import health and inventory</h1>
          <p className="text-sm text-muted-foreground mt-2">National scan status, source counts, cycle progress, and admin-safe diagnostics.</p>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="ds-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <RadioTower className="h-4 w-4 text-primary" />
              <h2 className="font-display text-2xl">National scan status</h2>
            </div>
            {scanStatus.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading national scan status...</p>
            ) : scanStatus.isError ? (
              <p className="text-sm text-signal-amber">Could not load national scan status.</p>
            ) : scanStatus.data ? (
              <div className="grid gap-2 text-sm">
                <p><span className="text-muted-foreground">Last national scan:</span> {formatNationalScanTime(scanStatus.data.finishedAt)}</p>
                <p><span className="text-muted-foreground">Next scheduled scan:</span> daily at 6am UK time</p>
                <p><span className="text-muted-foreground">Sources:</span> {showTechnicalDiagnostics ? IMPORT_SOURCE_OPTIONS.join(" + ") : activeSourceNames(investorRows.visibleRows).join(" + ") || "Sources being monitored"}</p>
                <p><span className="text-muted-foreground">Last run locations:</span> {scanStatus.data.locationsScanned.length ? scanStatus.data.locationsScanned.join(", ") : "Not available"}</p>
                <p><span className="text-muted-foreground">Queue:</span> {scanStatus.data.totalConfiguredLocations} locations, next index {scanStatus.data.nextIndex}</p>
                <p><span className="text-muted-foreground">Cycle progress:</span> {scanStatus.data.scanCycleProgress}% · {scanStatus.data.locationsCompletedInCurrentCycle}/{scanStatus.data.totalConfiguredLocations} completed</p>
                <p><span className="text-muted-foreground">Last successful duration:</span> {scanStatus.data.lastSuccessfulScanDurationMs ? formatScanDuration(scanStatus.data.lastSuccessfulScanDurationMs) : "Not available"}</p>
                <p><span className="text-muted-foreground">Last scan inserted:</span> {scanStatus.data.lastScanInsertedCount.toLocaleString()}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">National scan has not run yet.</p>
            )}
          </div>

          <div className="ds-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <h2 className="font-display text-2xl">Source health</h2>
            </div>
            {showTechnicalDiagnostics ? (
              <div className="grid grid-cols-2 gap-3">
                <Metric label="Healthy" value={sourceHealthSummary.Healthy} />
                <Metric label="Warning" value={sourceHealthSummary.Warning} />
                <Metric label="Blocked" value={sourceHealthSummary.Blocked} />
                <Metric label="Disabled" value={sourceHealthSummary.Disabled} />
                <Metric label="Total deals" value={kpis.totalDatabaseDeals} />
                <Metric label="Imported deals" value={inventory.totalImportedDeals} />
                <Metric label="Deals enriched" value={enrichmentMetrics.enriched} />
                <Metric label="Enrichment success" value={`${enrichmentMetrics.successRate}%`} />
                <Metric label="Enrichment queue" value={enrichmentMetrics.queueSize} />
                <Metric label="Classification uplift" value={enrichmentImpact?.classificationUplift ?? 0} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Metric label="Active sources" value={investorRows.visibleRows.filter((row) => investorSourceStatus(row) === "Active").length} />
                <Metric label="Monitored sources" value={sourceHealth.length} />
                <Metric label="Total opportunities" value={inventory.totalImportedDeals} />
                <Metric label="New today" value={sourceHealth.reduce((total, row) => total + row.newDealsToday, 0)} />
                <Metric label="Last updated" value={latestSourceUpdate ? formatNationalScanTime(latestSourceUpdate) : "Not available"} />
                <Metric label="Deals enriched" value={enrichmentMetrics.enriched} />
              </div>
            )}
          </div>
        </section>

        {scanStatus.data && enrichmentImpact && (
          <section className="ds-card p-5 space-y-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Enrichment Impact</div>
              <h2 className="font-display text-2xl mt-1">Data quality and classification movement</h2>
              <p className="text-sm text-muted-foreground mt-1">Compares current enriched deals against their original raw import payloads.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <Metric label="Total enriched" value={enrichmentImpact.totalEnriched} />
              <Metric label="Tenant found" value={enrichmentImpact.tenantFound} />
              <Metric label="Rent found" value={enrichmentImpact.rentFound} />
              <Metric label="Lease found" value={enrichmentImpact.leaseFound} />
              <Metric label="WAULT found" value={enrichmentImpact.waultFound} />
              <Metric label="EPC found" value={enrichmentImpact.epcFound} />
              <Metric label="Area found" value={enrichmentImpact.areaFound} />
              <Metric label="Deals improved" value={enrichmentImpact.dealsImproved} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-md border border-border/60 bg-surface-2/60 p-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Classification movement</div>
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {movementRows(enrichmentImpact.movementMatrix).map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-3">
                      <span>{row.label}</span>
                      <span className="font-mono text-foreground">{row.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-md border border-border/60 bg-surface-2/60 p-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Source-level impact</div>
                <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                  {enrichmentImpact.sourceImpact.slice(0, 6).map((source) => (
                    <div key={source.source} className="grid grid-cols-[1.4fr_0.7fr_0.7fr_0.7fr] gap-2">
                      <span className="font-medium text-foreground">{source.source}</span>
                      <span>{source.successRate}% success</span>
                      <span>{source.dealsImproved} improved</span>
                      <span>{source.classificationUplift} uplift</span>
                    </div>
                  ))}
                  {enrichmentImpact.sourceImpact.length === 0 && <div>No enrichment impact recorded yet.</div>}
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="ds-card p-5 space-y-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Source Health</div>
            <h2 className="font-display text-2xl mt-1">Status and inventory quality</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {showTechnicalDiagnostics
                ? "Per-source scan health, contribution, and technical schedule diagnostics from real imported data."
                : "Active and monitored source coverage from real imported opportunity data."}
            </p>
          </div>
          {showTechnicalDiagnostics ? (
            <TechnicalSourceTable rows={sourceHealth} />
          ) : (
            <InvestorSourceList
              rows={investorRows.visibleRows}
              monitoredRows={investorRows.monitoredRows}
              showMonitoredSources={showMonitoredSources}
              onToggleMonitored={() => setShowMonitoredSources((value) => !value)}
            />
          )}
        </section>

        {showTechnicalDiagnostics && (
          <section className="ds-card p-5 space-y-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Feedback and Usage</div>
              <h2 className="font-display text-2xl mt-1">Product learning diagnostics</h2>
              <p className="text-sm text-muted-foreground mt-1">Latest user feedback and first-party event counts for admin review.</p>
            </div>
            {feedbackUsage.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading feedback and usage...</p>
            ) : feedbackUsage.isError ? (
              <p className="text-sm text-signal-amber">Feedback and usage data is not available for this user.</p>
            ) : (
              <FeedbackUsageDiagnostics data={feedbackUsage.data} />
            )}
          </section>
        )}

        {showTechnicalDiagnostics && (
          <section className="ds-card p-5 space-y-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Source Opportunity Audit</div>
              <h2 className="font-display text-2xl mt-1">Expansion priority</h2>
              <p className="text-sm text-muted-foreground mt-1">Ranked from dry-runs, live page checks, parser output, and estimated unique acquisition inventory.</p>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[900px] rounded-md border border-border/60">
                <div className="grid grid-cols-[1.3fr_repeat(4,0.7fr)_0.9fr_0.8fr_1fr] gap-0 border-b border-border/60 bg-surface-2/70 px-3 py-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <div>Source</div>
                  <div>Total</div>
                  <div>Acq.</div>
                  <div>Overlap</div>
                  <div>Unique</div>
                  <div>Blocker</div>
                  <div>Difficulty</div>
                  <div>Recommendation</div>
                </div>
                {sourceAudit.map((row) => (
                  <div key={row.source} className="grid grid-cols-[1.3fr_repeat(4,0.7fr)_0.9fr_0.8fr_1fr] gap-0 border-b border-border/40 px-3 py-3 text-sm last:border-b-0">
                    <div className="font-medium">{row.source}</div>
                    <div className="font-mono tabular">{row.estimatedTotalListings.toLocaleString()}</div>
                    <div className="font-mono tabular">{row.estimatedCommercialAcquisitionListings.toLocaleString()}</div>
                    <div className="font-mono tabular">{row.estimatedOverlapPct}%</div>
                    <div className="font-mono tabular">{row.estimatedUniqueOpportunityPotential.toLocaleString()}</div>
                    <div>{row.currentBlockingReason}</div>
                    <div>{row.engineeringDifficulty}</div>
                    <div>{row.recommendation}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="ds-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h2 className="font-display text-2xl">Inventory contribution by source</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {(showTechnicalDiagnostics ? IMPORT_SOURCE_OPTIONS : activeSourceNames(investorRows.visibleRows)).map((source) => (
              <Metric key={source} label={source} value={inventory.sourceCounts[source] ?? 0} />
            ))}
            {!showTechnicalDiagnostics && investorRows.visibleRows.length === 0 && (
              <div className="text-sm text-muted-foreground">No source inventory has been imported yet.</div>
            )}
          </div>
        </section>

        <section className="ds-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Inventory audit</div>
              <h2 className="font-display text-2xl mt-1">Classification diagnostics</h2>
            </div>
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setReport(formatInventoryAuditReport(inventory))}>
              <FileText className="h-3.5 w-3.5" /> Generate inventory report
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Metric label="Top Opportunities" value={inventory.verifiedGreens} />
            <Metric label="Strong Opportunities" value={inventory.greenCandidates} />
            <Metric label="Requires Due Diligence" value={inventory.requiresDueDiligence} />
            <Metric label="Low Priority" value={inventory.lowPriority} />
            <Metric label="Added today" value={inventory.addedToday} />
            <Metric label="Added this week" value={inventory.addedThisWeek} />
            <Metric label="Locations completed" value={`${inventory.locationsCompletedInCurrentCycle}/${inventory.totalConfiguredLocations}`} />
            <Metric label="Scan progress" value={scanStatus.data ? `${scanStatus.data.scanCycleProgress}%` : "N/A"} />
          </div>
          {report && <pre className="max-h-80 overflow-auto rounded-md bg-surface-2 p-4 text-xs text-muted-foreground whitespace-pre-wrap">{report}</pre>}
        </section>
      </div>
    </AppLayout>
  );
}

function SourceStatusBadge({ status }: { status: SourceHealthStatus }) {
  const Icon = status === "Healthy" ? CheckCircle2 : status === "Blocked" ? ShieldAlert : AlertTriangle;
  const className = status === "Healthy"
    ? "border-signal-green/40 bg-signal-green/10 text-signal-green"
    : status === "Blocked"
      ? "border-red-500/40 bg-red-500/10 text-red-300"
      : status === "Disabled"
        ? "border-muted-foreground/30 bg-muted/30 text-muted-foreground"
        : "border-signal-amber/40 bg-signal-amber/10 text-signal-amber";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${className}`}>
      <Icon className="h-3 w-3" />
      {status}
    </span>
  );
}

function FeedbackUsageDiagnostics({ data }: { data: FeedbackUsageAdminData }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <div className="rounded-md border border-border/60 bg-surface-2/60 p-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Latest feedback</div>
        <div className="mt-3 space-y-3">
          {data.latestFeedback.length ? data.latestFeedback.map((item) => (
            <div key={item.id} className="rounded-md border border-border/50 bg-background/40 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{formatEventLabel(item.type)}</span>
                <span className="text-xs text-muted-foreground">{formatNationalScanTime(item.created_at)}</span>
              </div>
              <p className="mt-2 text-muted-foreground">{item.message}</p>
              <div className="mt-2 text-xs text-muted-foreground">
                {item.current_page}{item.deal_id ? ` · Deal ${item.deal_id}` : ""}{item.source_url ? ` · ${item.source_url}` : ""}
              </div>
            </div>
          )) : (
            <p className="text-sm text-muted-foreground">No feedback submitted yet.</p>
          )}
        </div>
      </div>
      <div className="space-y-4">
        <UsageCountPanel title="Most common events" rows={data.eventCounts.map((row) => ({ label: formatEventLabel(row.eventType), count: row.count }))} />
        <UsageCountPanel title="Most opened deals" rows={data.mostOpenedDeals.map((row) => ({ label: row.dealId, count: row.count }))} />
        <UsageCountPanel title="Most downloaded investment packs" rows={data.mostDownloadedInvestmentPacks.map((row) => ({ label: row.dealId, count: row.count }))} />
      </div>
    </div>
  );
}

function UsageCountPanel({ title, rows }: { title: string; rows: Array<{ label: string; count: number }> }) {
  return (
    <div className="rounded-md border border-border/60 bg-surface-2/60 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="mt-3 space-y-1 text-sm">
        {rows.length ? rows.slice(0, 8).map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <span className="truncate text-muted-foreground">{row.label}</span>
            <span className="font-mono font-semibold tabular">{row.count.toLocaleString()}</span>
          </div>
        )) : (
          <div className="text-muted-foreground">No events recorded yet.</div>
        )}
      </div>
    </div>
  );
}

function InvestorSourceList({
  rows,
  monitoredRows,
  showMonitoredSources,
  onToggleMonitored,
}: {
  rows: SourceHealthRow[];
  monitoredRows: SourceHealthRow[];
  showMonitoredSources: boolean;
  onToggleMonitored: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <div className="min-w-[760px] rounded-md border border-border/60">
          <div className="grid grid-cols-[1.5fr_0.9fr_repeat(4,0.9fr)] gap-0 border-b border-border/60 bg-surface-2/70 px-3 py-2 text-[10px] uppercase tracking-wide text-muted-foreground">
            <div>Source</div>
            <div>Status</div>
            <div>Total opportunities</div>
            <div>New today</div>
            <div>Last updated</div>
            <div>Opportunity quality</div>
          </div>
          {rows.length > 0 ? rows.map((row) => (
            <div key={row.source} className="grid grid-cols-[1.5fr_0.9fr_repeat(4,0.9fr)] gap-0 border-b border-border/40 px-3 py-3 text-sm last:border-b-0">
              <div className="font-medium">{row.source}</div>
              <div><InvestorSourceStatusBadge status={investorSourceStatus(row)} /></div>
              <div className="font-mono tabular">{row.totalImportedDeals.toLocaleString()}</div>
              <div className="font-mono tabular">{row.newDealsToday.toLocaleString()}</div>
              <div>{row.lastSuccessfulScan ? formatNationalScanTime(row.lastSuccessfulScan) : "Not available"}</div>
              <div className="text-xs text-muted-foreground">
                {row.topOpportunityCount.toLocaleString()} top / {row.strongOpportunityCount.toLocaleString()} strong
              </div>
            </div>
          )) : (
            <div className="px-3 py-5 text-sm text-muted-foreground">No source inventory has been imported yet.</div>
          )}
        </div>
      </div>

      {monitoredRows.length > 0 && (
        <div className="rounded-md border border-border/60 bg-surface-2/50 p-3">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 text-left text-sm font-medium"
            onClick={onToggleMonitored}
          >
            <span>Additional sources being monitored</span>
            <span className="text-xs text-muted-foreground">{monitoredRows.length} additional sources being monitored</span>
          </button>
          {showMonitoredSources && (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {monitoredRows.map((row) => (
                <div key={row.source} className="flex items-center justify-between gap-3 rounded-md border border-border/50 bg-background/30 px-3 py-2 text-sm">
                  <span className="font-medium">{row.source}</span>
                  <InvestorSourceStatusBadge status={investorSourceStatus(row)} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TechnicalSourceTable({ rows }: { rows: SourceHealthRow[] }) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[980px] rounded-md border border-border/60">
        <div className="grid grid-cols-[1.4fr_0.8fr_0.9fr_repeat(7,0.75fr)_1fr_1.3fr] gap-0 border-b border-border/60 bg-surface-2/70 px-3 py-2 text-[10px] uppercase tracking-wide text-muted-foreground">
          <div>Source</div>
          <div>Status</div>
          <div>Schedule</div>
          <div>Total</div>
          <div>New today</div>
          <div>Contribution</div>
          <div>Top</div>
          <div>Strong</div>
          <div>Last inserted</div>
          <div>Duration</div>
          <div>Failures</div>
          <div>Last success / notes</div>
        </div>
        {rows.map((row) => (
          <div key={row.source} className="grid grid-cols-[1.4fr_0.8fr_0.9fr_repeat(7,0.75fr)_1fr_1.3fr] gap-0 border-b border-border/40 px-3 py-3 text-sm last:border-b-0">
            <div className="font-medium">{row.source}</div>
            <div><SourceStatusBadge status={row.status} /></div>
            <div className="text-xs">
              <div className={row.isDue ? "text-signal-green" : "text-muted-foreground"}>{row.isDue ? "Due" : "Not due"}</div>
              <div className="text-muted-foreground capitalize">{row.scheduleGroup}</div>
            </div>
            <div className="font-mono tabular">{row.totalImportedDeals.toLocaleString()}</div>
            <div className="font-mono tabular">{row.newDealsToday.toLocaleString()}</div>
            <div className="font-mono tabular">{row.inventoryContributionPct.toFixed(1)}%</div>
            <div className="font-mono tabular">{row.topOpportunityCount.toLocaleString()}</div>
            <div className="font-mono tabular">{row.strongOpportunityCount.toLocaleString()}</div>
            <div className="font-mono tabular">{row.lastInsertedCount.toLocaleString()}</div>
            <div className="font-mono tabular">{formatScanDuration(row.lastScanDurationMs)}</div>
            <div className="font-mono tabular">{row.consecutiveFailures.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">
              <div>{row.lastSuccessfulScan ? formatNationalScanTime(row.lastSuccessfulScan) : "No successful scan"}</div>
              <div className="mt-1">
                {row.isDue ? "Eligible now" : `Next eligible: ${formatNationalScanTime(row.nextEligibleScanAt)}`}
              </div>
              {!row.isDue && <div className="text-signal-amber">{row.cooldownReason}</div>}
              {row.warningReasons.length > 0 && <div className="mt-1 text-signal-amber">{row.warningReasons.join("; ")}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InvestorSourceStatusBadge({ status }: { status: InvestorSourceStatus }) {
  const className = status === "Active"
    ? "border-signal-green/40 bg-signal-green/10 text-signal-green"
    : status === "Limited data"
      ? "border-signal-amber/40 bg-signal-amber/10 text-signal-amber"
      : "border-primary/30 bg-primary/10 text-primary";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${className}`}>
      {status}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-border/60 bg-surface-2/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-lg font-semibold tabular">{typeof value === "number" ? value.toLocaleString() : value}</div>
    </div>
  );
}

function latestSuccessfulScan(rows: SourceHealthRow[]) {
  return rows
    .map((row) => row.lastSuccessfulScan)
    .filter(Boolean)
    .sort((a, b) => new Date(String(b)).getTime() - new Date(String(a)).getTime())[0] ?? null;
}

function activeSourceNames(rows: SourceHealthRow[]) {
  return rows.map((row) => row.source);
}

function formatEventLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function sourceDiagnosticsEnabled() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("dealsignal:source-diagnostics") === "1";
}

function movementRows(matrix: Record<DealClassification, Record<DealClassification, number>>) {
  const rows: Array<{ label: string; value: number }> = [];
  for (const [from, destinations] of Object.entries(matrix) as Array<[DealClassification, Record<DealClassification, number>]>) {
    for (const [to, value] of Object.entries(destinations) as Array<[DealClassification, number]>) {
      if (!value) continue;
      rows.push({ label: `${classificationLabel(from)} -> ${classificationLabel(to)}`, value });
    }
  }
  return rows.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}
