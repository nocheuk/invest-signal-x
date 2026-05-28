import type { Deal } from "@/lib/deals";
import { formatGBP, formatPct } from "@/lib/deals";
import { sourceLabel } from "@/lib/dashboardFilters";

type JsPdfDocument = {
  setProperties: (properties: Record<string, string>) => void;
  setFillColor: (...args: number[]) => void;
  rect: (...args: number[]) => void;
  setTextColor: (...args: number[]) => void;
  setFont: (fontName: string, fontStyle?: string) => void;
  setFontSize: (fontSize: number) => void;
  text: (text: string | string[], x: number, y: number, options?: Record<string, unknown>) => void;
  splitTextToSize: (text: string, maxWidth: number) => string[];
  addImage: (...args: unknown[]) => void;
  addPage: () => void;
  save: (filename: string) => void;
  internal: { pageSize: { getHeight: () => number; getWidth: () => number } };
};

export async function downloadDealMemoPdf(deal: Deal) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" }) as JsPdfDocument;
  const filename = buildMemoFilename(deal.title);
  const generatedAt = new Date();
  const imageDataUrl = deal.imageUrl ? await fetchImageAsDataUrl(deal.imageUrl).catch(() => undefined) : undefined;

  renderMemo(doc, deal, { generatedAt, imageDataUrl });
  doc.save(filename);
}

export function buildMemoFilename(title: string) {
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80);
  return `dealsignal-memo-${slug || "property"}.pdf`;
}

export function buildMemoSections(deal: Deal) {
  const reasons = deal.scoreReasons;
  return {
    summary: [
      ["Location", deal.location],
      ["Source", sourceLabel(deal)],
      ["Guide price", moneyOrUnavailable(deal.guidePrice)],
      ["NIY", percentOrUnavailable(deal.netInitialYield)],
      ["Gross yield", percentOrUnavailable(deal.grossYield)],
      ["Floor area", deal.sqft > 0 ? `${deal.sqft.toLocaleString()} sq ft` : "Not available"],
      ["Price per sqft", deal.pricePerSqft > 0 ? `${formatGBP(deal.pricePerSqft)} / sq ft` : "Not available"],
      ["DealSignal Score", `${deal.score}/100`],
      ["Data Confidence", deal.dataConfidenceScore !== undefined ? `${deal.dataConfidenceScore}/100 (${deal.confidenceLevel ?? "unknown"})` : "Not available"],
    ],
    positiveDrivers: reasons?.positiveDrivers?.length ? reasons.positiveDrivers : ["No positive drivers available from imported data yet."],
    risks: [
      deal.mainRiskFlag || "Needs review",
      ...(deal.redFlags ?? []),
      ...(reasons?.negativeDrivers ?? []),
    ].filter(Boolean),
    missingData: reasons?.missingDataWarnings?.length
      ? reasons.missingDataWarnings
      : deal.needsReview
        ? ["Needs review: key underwriting fields are missing or incomplete."]
        : ["No missing-data warnings recorded."],
    verify: reasons?.verifyBeforeTrusting?.length
      ? reasons.verifyBeforeTrusting
      : ["Confirm title, lease, rent, tenancy schedule and comparable evidence before relying on this memo."],
    sourceUrl: deal.sourceUrl || "Not available",
  };
}

function renderMemo(doc: JsPdfDocument, deal: Deal, options: { generatedAt: Date; imageDataUrl?: string }) {
  const page = { width: doc.internal.pageSize.getWidth(), height: doc.internal.pageSize.getHeight() };
  const margin = 16;
  let y = 16;
  const sections = buildMemoSections(deal);

  doc.setProperties({
    title: `DealSignal Memo - ${deal.title}`,
    subject: "Commercial property investment memo",
    author: "DealSignal",
    creator: "DealSignal",
  });

  doc.setFillColor(8, 14, 23);
  doc.rect(0, 0, page.width, 34, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("DealSignal", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Investment memo", margin, y + 6);
  doc.text(`Generated ${options.generatedAt.toLocaleDateString("en-GB")}`, page.width - margin, y, { align: "right" });
  y = 46;

  if (options.imageDataUrl) {
    try {
      doc.addImage(options.imageDataUrl, imageFormat(options.imageDataUrl), margin, y, page.width - margin * 2, 52, undefined, "FAST");
      y += 62;
    } catch {
      y += 2;
    }
  }

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  y = writeWrapped(doc, deal.title, margin, y, page.width - margin * 2, 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  y = writeWrapped(doc, deal.location, margin, y + 2, page.width - margin * 2, 5) + 6;

  y = writeKeyValueGrid(doc, sections.summary, margin, y, page.width - margin * 2);
  y += 6;
  y = writeListSection(doc, "Positive drivers", sections.positiveDrivers, margin, y, page);
  y = writeListSection(doc, "Risks and warnings", sections.risks.length ? sections.risks : ["No risks recorded yet."], margin, y, page);
  y = writeListSection(doc, "Missing data / needs review", sections.missingData, margin, y, page);
  y = writeListSection(doc, "Verify before relying", sections.verify, margin, y, page);

  y = ensureSpace(doc, y, 26, page, margin);
  sectionTitle(doc, "Source URL", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  writeWrapped(doc, sections.sourceUrl, margin, y, page.width - margin * 2, 4.5);

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("This memo is generated from imported source data only. Missing fields are not inferred.", margin, page.height - 10);
}

function writeKeyValueGrid(doc: JsPdfDocument, rows: string[][], x: number, y: number, width: number) {
  const colWidth = width / 3;
  rows.forEach(([label, value], index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const cellX = x + col * colWidth;
    const cellY = y + row * 17;
    doc.setFillColor(248, 250, 252);
    doc.rect(cellX, cellY, colWidth - 2, 13, "F");
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(label.toUpperCase(), cellX + 2, cellY + 4);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(String(value), cellX + 2, cellY + 9.5, { maxWidth: colWidth - 6 });
  });
  return y + Math.ceil(rows.length / 3) * 17;
}

function writeListSection(doc: JsPdfDocument, title: string, items: string[], x: number, y: number, page: { width: number; height: number }) {
  y = ensureSpace(doc, y, 28, page, x);
  sectionTitle(doc, title, x, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  for (const item of items) {
    y = ensureSpace(doc, y, 14, page, x);
    const lines = doc.splitTextToSize(`- ${item}`, page.width - x * 2);
    doc.text(lines, x, y);
    y += lines.length * 4.5 + 2;
  }
  return y + 2;
}

function sectionTitle(doc: JsPdfDocument, title: string, x: number, y: number) {
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(title, x, y);
}

function writeWrapped(doc: JsPdfDocument, text: string, x: number, y: number, width: number, lineHeight: number) {
  const lines = doc.splitTextToSize(text, width);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function ensureSpace(doc: JsPdfDocument, y: number, needed: number, page: { height: number }, margin: number) {
  if (y + needed < page.height - margin) return y;
  doc.addPage();
  return margin;
}

function moneyOrUnavailable(value: number) {
  return value > 0 ? formatGBP(value) : "Not available";
}

function percentOrUnavailable(value: number) {
  return value > 0 ? formatPct(value, 2) : "Not available";
}

async function fetchImageAsDataUrl(url: string) {
  const response = await fetch(url, { mode: "cors" });
  if (!response.ok) throw new Error("Image could not be loaded.");
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function imageFormat(dataUrl: string) {
  return dataUrl.includes("image/png") ? "PNG" : "JPEG";
}
