import { useMemo, useState } from "react";
import { Activity, FileText, RadioTower } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { buildInventoryAudit, formatInventoryAuditReport } from "@/lib/inventoryAudit";
import { buildDashboardKpis } from "@/lib/dashboardKpis";
import { useRealDeals } from "@/hooks/useRealDeals";
import { formatNationalScanTime, formatScanDuration, useNationalScanStatus } from "@/hooks/useNationalScanStatus";
import { useWatchlist } from "@/lib/watchlist";

export default function SourcesScans() {
  const { deals } = useRealDeals();
  const { ids, pipelineCounts } = useWatchlist();
  const scanStatus = useNationalScanStatus();
  const [report, setReport] = useState("");
  const inventory = useMemo(() => buildInventoryAudit({ deals, scanStatus: scanStatus.data }), [deals, scanStatus.data]);
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
                <p><span className="text-muted-foreground">Sources:</span> Rightmove Commercial + Acuitus + Eddisons + Allsop</p>
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
              <h2 className="font-display text-2xl">Source counts</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Total deals" value={kpis.totalDatabaseDeals} />
              <Metric label="Imported deals" value={inventory.totalImportedDeals} />
              <Metric label="Rightmove" value={inventory.rightmoveDeals} />
              <Metric label="Acuitus" value={inventory.acuitusDeals} />
              <Metric label="Eddisons" value={inventory.eddisonsDeals} />
              <Metric label="Allsop" value={inventory.allsopDeals} />
            </div>
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

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-border/60 bg-surface-2/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-lg font-semibold tabular">{typeof value === "number" ? value.toLocaleString() : value}</div>
    </div>
  );
}
