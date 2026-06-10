import { useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, FileText, RadioTower, ShieldAlert } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { buildInventoryAudit, formatInventoryAuditReport } from "@/lib/inventoryAudit";
import { buildDashboardKpis } from "@/lib/dashboardKpis";
import { IMPORT_SOURCE_OPTIONS } from "@/lib/dashboardFilters";
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
            </div>
          </div>
        </section>

        <section className="ds-card p-5 space-y-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Source Health</div>
            <h2 className="font-display text-2xl mt-1">Status and inventory quality</h2>
            <p className="text-sm text-muted-foreground mt-1">Per-source scan health, contribution, and opportunity quality from real imported data.</p>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[980px] rounded-md border border-border/60">
              <div className="grid grid-cols-[1.5fr_0.8fr_repeat(7,0.8fr)_1.4fr] gap-0 border-b border-border/60 bg-surface-2/70 px-3 py-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                <div>Source</div>
                <div>Status</div>
                <div>Total</div>
                <div>New today</div>
                <div>Contribution</div>
                <div>Top</div>
                <div>Strong</div>
                <div>Last inserted</div>
                <div>Duration</div>
                <div>Last success / notes</div>
              </div>
              {sourceHealth.map((row) => (
                <div key={row.source} className="grid grid-cols-[1.5fr_0.8fr_repeat(7,0.8fr)_1.4fr] gap-0 border-b border-border/40 px-3 py-3 text-sm last:border-b-0">
                  <div className="font-medium">{row.source}</div>
                  <div><SourceStatusBadge status={row.status} /></div>
                  <div className="font-mono tabular">{row.totalImportedDeals.toLocaleString()}</div>
                  <div className="font-mono tabular">{row.newDealsToday.toLocaleString()}</div>
                  <div className="font-mono tabular">{row.inventoryContributionPct.toFixed(1)}%</div>
                  <div className="font-mono tabular">{row.topOpportunityCount.toLocaleString()}</div>
                  <div className="font-mono tabular">{row.strongOpportunityCount.toLocaleString()}</div>
                  <div className="font-mono tabular">{row.lastInsertedCount.toLocaleString()}</div>
                  <div className="font-mono tabular">{formatScanDuration(row.lastScanDurationMs)}</div>
                  <div className="text-xs text-muted-foreground">
                    <div>{row.lastSuccessfulScan ? formatNationalScanTime(row.lastSuccessfulScan) : "No successful scan"}</div>
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
