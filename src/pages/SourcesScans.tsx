import { useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, FileText, RadioTower, ShieldAlert } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { buildInventoryAudit, formatInventoryAuditReport } from "@/lib/inventoryAudit";
import { buildDashboardKpis } from "@/lib/dashboardKpis";
import { IMPORT_SOURCE_OPTIONS } from "@/lib/dashboardFilters";
import { classificationLabel, type DealClassification } from "@/lib/dealClassification";
import { buildSourceHealth, summarizeSourceHealth, type SourceHealthStatus } from "@/lib/sourceHealth";
import { useRealDeals } from "@/hooks/useRealDeals";
import { formatNationalScanTime, formatScanDuration, useNationalScanStatus } from "@/hooks/useNationalScanStatus";
import { useWatchlist } from "@/lib/watchlist";

export default function SourcesScans() {
  const { deals } = useRealDeals();
  const { ids, pipelineCounts } = useWatchlist();
  const scanStatus = useNationalScanStatus();
  const [report, setReport] = useState("");
  const inventory = useMemo(() => buildInventoryAudit({ deals, scanStatus: scanStatus.data }), [deals, scanStatus.data]);
  const sourceHealth = useMemo(() => buildSourceHealth({ deals, scanRuns: scanStatus.data?.sourceScanRuns ?? [] }), [deals, scanStatus.data?.sourceScanRuns]);
  const sourceHealthSummary = useMemo(() => summarizeSourceHealth(sourceHealth), [sourceHealth]);
  const kpis = useMemo(() => buildDashboardKpis({ allDeals: deals, filteredDeals: deals, watchlistIds: ids, pipelineCounts, totalDatabaseDeals: scanStatus.data?.totalDeals }), [deals, ids, pipelineCounts, scanStatus.data?.totalDeals]);
  const enrichmentMetrics = scanStatus.data?.enrichmentMetrics ?? { total: 0, enriched: 0, failed: 0, pending: 0, queueSize: 0, successRate: 0 };
  const enrichmentImpact = scanStatus.data?.enrichmentImpact;

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
                <p><span className="text-muted-foreground">Sources:</span> {IMPORT_SOURCE_OPTIONS.join(" + ")}</p>
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
            <p className="text-sm text-muted-foreground mt-1">Per-source scan health, contribution, and opportunity quality from real imported data.</p>
          </div>
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
              {sourceHealth.map((row) => (
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
        </section>

        <section className="ds-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h2 className="font-display text-2xl">Inventory contribution by source</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {IMPORT_SOURCE_OPTIONS.map((source) => (
              <Metric key={source} label={source} value={inventory.sourceCounts[source] ?? 0} />
            ))}
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

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-border/60 bg-surface-2/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-lg font-semibold tabular">{typeof value === "number" ? value.toLocaleString() : value}</div>
    </div>
  );
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
