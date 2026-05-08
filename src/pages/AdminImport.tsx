import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { DEAL_IMPORT_HEADERS, importRowsToCsv, normalizeImportRow, parseDealCsv, type DealImportInput } from "@/lib/imports/dealImport";
import { CheckCircle2, FileSpreadsheet, Plus, ShieldCheck, TriangleAlert } from "lucide-react";

const EMPTY_MANUAL: DealImportInput = {
  title: "",
  location: "",
  region: "",
  assetType: "Retail",
  source: "Private treaty",
  guidePrice: undefined,
  passingRent: undefined,
  sqft: undefined,
  netInitialYield: undefined,
  tenant: "",
  covenantStrength: "Moderate",
  sourceUrl: "",
};

export default function AdminImport() {
  const [sourceName, setSourceName] = useState("Manual CSV import");
  const [csv, setCsv] = useState(DEAL_IMPORT_HEADERS.join(","));
  const [manual, setManual] = useState<DealImportInput>(EMPTY_MANUAL);
  const parsedRows = useMemo(() => parseDealCsv(csv), [csv]);
  const manualRow = useMemo(() => normalizeImportRow(manualToRaw(manual), 1), [manual]);
  const validRows = parsedRows.filter((row) => row.validationErrors.length === 0).length;
  const invalidRows = parsedRows.length - validRows;
  const command = `npm run import:deals -- --file ./imports/deals.csv --source-name "${sourceName || "Manual CSV import"}"`;

  const appendManualRow = () => {
    if (manualRow.validationErrors.length > 0) return;
    const nextCsv = importRowsToCsv([...parsedRows.map((row) => row.normalized), manualRow.normalized]);
    setCsv(nextCsv);
    setManual(EMPTY_MANUAL);
  };

  return (
    <AppLayout>
      <div className="container max-w-7xl py-8 space-y-6">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-primary font-medium">Admin</div>
            <h1 className="font-display text-4xl mt-1">Deal imports</h1>
            <p className="text-muted-foreground text-sm mt-1">Prepare and validate manual or CSV imports before running the service-role importer.</p>
          </div>
          <Badge variant="outline" className="gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Admin only
          </Badge>
        </div>

        <div className="grid lg:grid-cols-3 gap-5">
          <section className="ds-card p-5 space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl">CSV import</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Paste rows using the expected headers, then run the importer locally with a service-role key.</p>
              </div>
              <FileSpreadsheet className="h-5 w-5 text-primary" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sourceName" className="text-xs">Import source name</Label>
              <Input id="sourceName" value={sourceName} onChange={(event) => setSourceName(event.target.value)} className="bg-surface-2 border-border/60" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="csv" className="text-xs">CSV rows</Label>
              <Textarea id="csv" value={csv} onChange={(event) => setCsv(event.target.value)} className="bg-surface-2 border-border/60 min-h-72 font-mono text-xs" />
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <Metric label="Rows" value={parsedRows.length.toString()} />
              <Metric label="Valid" value={validRows.toString()} tone="good" />
              <Metric label="Invalid" value={invalidRows.toString()} tone={invalidRows ? "bad" : "default"} />
            </div>
          </section>

          <section className="ds-card p-5 space-y-4">
            <div>
              <h2 className="font-display text-2xl">Manual row</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Add one controlled row into the CSV buffer.</p>
            </div>

            <Field label="Title" value={manual.title} onChange={(value) => setManual((row) => ({ ...row, title: value }))} />
            <Field label="Location" value={manual.location} onChange={(value) => setManual((row) => ({ ...row, location: value }))} />
            <Field label="Guide price" value={manual.guidePrice?.toString() ?? ""} type="number" onChange={(value) => setManual((row) => ({ ...row, guidePrice: value ? Number(value) : undefined }))} />
            <Field label="Source URL" value={manual.sourceUrl ?? ""} onChange={(value) => setManual((row) => ({ ...row, sourceUrl: value }))} />
            <Field label="Tenant" value={manual.tenant ?? ""} onChange={(value) => setManual((row) => ({ ...row, tenant: value }))} />

            {manualRow.validationErrors.length > 0 ? (
              <div className="rounded-lg border border-signal-amber/40 bg-signal-amber/10 p-3 text-xs text-muted-foreground space-y-1">
                {manualRow.validationErrors.map((error) => <div key={error}>{error}</div>)}
              </div>
            ) : (
              <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Manual row is valid
              </div>
            )}

            <Button onClick={appendManualRow} disabled={manualRow.validationErrors.length > 0} className="w-full gap-2 bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4" /> Add row to CSV
            </Button>
          </section>
        </div>

        <section className="ds-card p-5 space-y-4">
          <div>
            <h2 className="font-display text-2xl">Import preview</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Validation runs in the browser. Database writes happen only through the service-role script.</p>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-12 gap-3 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/60">
                <div className="col-span-1">Row</div>
                <div className="col-span-3">Title</div>
                <div className="col-span-2">Location</div>
                <div className="col-span-2 text-right">Guide</div>
                <div className="col-span-2">Dedupe key</div>
                <div className="col-span-2">Status</div>
              </div>
              {parsedRows.map((row) => (
                <div key={row.rowNumber} className="grid grid-cols-12 gap-3 px-3 py-3 text-xs border-b border-border/30 last:border-0">
                  <div className="col-span-1 font-mono">{row.rowNumber}</div>
                  <div className="col-span-3 truncate">{row.normalized.title || "-"}</div>
                  <div className="col-span-2 truncate text-muted-foreground">{row.normalized.location || "-"}</div>
                  <div className="col-span-2 text-right font-mono">{row.normalized.guidePrice?.toLocaleString() ?? "-"}</div>
                  <div className="col-span-2 truncate text-muted-foreground">{row.dedupeKeys.sourceUrl || row.dedupeKeys.titlePostcode || row.dedupeKeys.titlePriceLocation || "-"}</div>
                  <div className="col-span-2">
                    {row.validationErrors.length === 0 ? (
                      <span className="inline-flex items-center gap-1 text-primary"><CheckCircle2 className="h-3 w-3" /> valid</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-signal-amber"><TriangleAlert className="h-3 w-3" /> {row.validationErrors.length} error</span>
                    )}
                  </div>
                </div>
              ))}
              {parsedRows.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No CSV rows yet.</div>}
            </div>
          </div>

          <div className="rounded-lg bg-surface-2 border border-border/60 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Run locally</div>
            <code className="text-xs break-all">{command}</code>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "good" | "bad" }) {
  const color = tone === "good" ? "text-primary" : tone === "bad" ? "text-signal-red" : "text-foreground";
  return (
    <div className="bg-surface-2/60 rounded-lg p-3">
      <div className="text-[10px] uppercase text-muted-foreground tracking-wide">{label}</div>
      <div className={`font-mono tabular text-xl font-semibold mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; type?: string; onChange: (value: string) => void }) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="bg-surface-2 border-border/60" />
    </div>
  );
}

function manualToRaw(row: DealImportInput) {
  return {
    title: row.title,
    location: row.location,
    guide_price: row.guidePrice?.toString() ?? "",
    source_url: row.sourceUrl ?? "",
    tenant: row.tenant ?? "",
    asset_type: row.assetType ?? "",
    source: row.source ?? "",
  };
}
