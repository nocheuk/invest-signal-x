import type { Deal } from "@/lib/deals";
import { formatGBP, formatPct } from "@/lib/deals";
import { sourceLabel } from "@/lib/dashboardFilters";
import { getDealAnalysis } from "@/lib/dealAnalysis";
import { classificationLabel, classifyDeal } from "@/lib/dealClassification";
import { buildInvestmentThesis } from "@/lib/investmentThesis";
import { type ComparableEvidence, formatComparableMetric } from "@/lib/comparableEvidence";
import { buildFinancialAnalysis, formatFinancialMoney, formatFinancialPercent } from "@/lib/financialAnalysis";
import type { NationalRanking } from "@/lib/dailyOpportunityFeed";

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

export async function downloadDealMemoPdf(deal: Deal, options: { comparableEvidence?: ComparableEvidence | null; nationalRanking?: NationalRanking | null } = {}) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" }) as JsPdfDocument;
  const filename = buildMemoFilename(deal.title);
  const generatedAt = new Date();
  const imageDataUrl = deal.imageUrl ? await fetchImageAsDataUrl(deal.imageUrl).catch(() => undefined) : undefined;

  renderMemo(doc, deal, { generatedAt, imageDataUrl, comparableEvidence: options.comparableEvidence, nationalRanking: options.nationalRanking });
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
  return `dealsignal-investment-pack-${slug || "property"}.pdf`;
}

export function buildMemoSections(deal: Deal, options: { comparableEvidence?: ComparableEvidence | null; nationalRanking?: NationalRanking | null } = {}) {
  const reasons = deal.scoreReasons;
  const analysis = getDealAnalysis(deal);
  const thesis = buildInvestmentThesis(deal, { comparableEvidence: options.comparableEvidence });
  const financialAnalysis = buildFinancialAnalysis(deal);
  const verificationChecklist = memoVerificationChecklist(deal, thesis.verifyNext, reasons?.verifyBeforeTrusting ?? []);
  return {
    executiveSummary: [
      ["Property", deal.title],
      ["Location", deal.location],
      ["Guide price", moneyOrUnavailable(deal.guidePrice)],
      ["Source", sourceLabel(deal)],
      ["Opportunity label", classificationLabel(classifyDeal(deal))],
      ["Investor verdict", thesis.investorVerdict],
      ["Generated", new Date().toLocaleDateString("en-GB")],
    ],
    summary: [
      ["Location", deal.location],
      ["Source", sourceLabel(deal)],
      ["Guide price", moneyOrUnavailable(deal.guidePrice)],
      ["NIY", percentOrUnavailable(deal.netInitialYield)],
      ["Gross yield", percentOrUnavailable(deal.grossYield)],
      ["Floor area", deal.sqft > 0 ? `${deal.sqft.toLocaleString()} sq ft` : "Not available"],
      ["Price per sqft", deal.pricePerSqft > 0 ? `${formatGBP(deal.pricePerSqft)} / sq ft` : "Not available"],
      ["DealSignal Score", `${deal.score}/100`],
      ["Opportunity label", classificationLabel(classifyDeal(deal))],
      ["Data Confidence", deal.dataConfidenceScore !== undefined ? `${deal.dataConfidenceScore}/100 (${deal.confidenceLevel ?? "unknown"})` : "Not available"],
    ],
    investmentSummary: analysis.investmentSummary,
    investmentThesis: thesis,
    tenantLeaseIncome: memoTenantLeaseIncome(deal),
    nationalRanking: memoNationalRanking(options.nationalRanking),
    financialAnalysis: memoFinancialAnalysis(financialAnalysis),
    comparableEvidence: memoComparableEvidence(options.comparableEvidence),
    opportunitySignals: analysis.opportunitySignals.length ? analysis.opportunitySignals : ["No opportunity signal available from imported data yet."],
    riskSignals: analysis.riskSignals.length ? analysis.riskSignals : ["No specific risk signal recorded yet."],
    positiveDrivers: analysis.opportunitySignals.length ? analysis.opportunitySignals : ["No positive drivers available from imported data yet."],
    risks: analysis.riskSignals.length ? analysis.riskSignals : [
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
      : ["Confirm title, lease, rent, tenancy schedule and comparable evidence before relying on this investment pack."],
    verificationChecklist,
    disclaimer: [
      "DealSignal is not financial, investment, tax, legal or valuation advice.",
      "Imported source data may be incomplete, stale or inaccurate and must be verified before making offers.",
      "Financial analysis uses deterministic assumptions and available deal data only; it is not a forecast, valuation or guaranteed return.",
      "Users should verify source listings, tenancy, lease terms, title, planning, EPC, floor area, condition and comparable evidence independently.",
    ],
    sourceUrl: deal.sourceUrl || "Not available",
  };
}

function renderMemo(doc: JsPdfDocument, deal: Deal, options: { generatedAt: Date; imageDataUrl?: string; comparableEvidence?: ComparableEvidence | null; nationalRanking?: NationalRanking | null }) {
  const page = { width: doc.internal.pageSize.getWidth(), height: doc.internal.pageSize.getHeight() };
  const margin = 16;
  let y = 16;
  const sections = buildMemoSections(deal, { comparableEvidence: options.comparableEvidence, nationalRanking: options.nationalRanking });

  doc.setProperties({
    title: `DealSignal Investment Pack - ${deal.title}`,
    subject: "Commercial property investment pack",
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
  doc.text("Investment pack", margin, y + 6);
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

  sectionTitle(doc, "Executive Summary", margin, y);
  y = writeKeyValueGrid(doc, sections.executiveSummary, margin, y + 7, page.width - margin * 2);
  y += 6;
  y = ensureSpace(doc, y, 30, page, margin);
  sectionTitle(doc, "Investment Thesis", margin, y);
  y = writeWrapped(doc, sections.investmentSummary, margin, y + 7, page.width - margin * 2, 4.8) + 4;
  y = writeWrapped(doc, sections.investmentThesis.summary, margin, y + 7, page.width - margin * 2, 4.8) + 3;
  y = writeListSection(doc, "Why this is worth reviewing", sections.investmentThesis.whyInteresting, margin, y, page);
  y = writeListSection(doc, "Potential upside", sections.investmentThesis.potentialUpside, margin, y, page);
  y = writeListSection(doc, "Key risks", sections.investmentThesis.keyRisks, margin, y, page);
  y = writeListSection(doc, "Investor verdict", [`${sections.investmentThesis.investorVerdict} (${sections.investmentThesis.confidenceLevel} confidence)`], margin, y, page);
  y = writeListSection(doc, "National Ranking", sections.nationalRanking, margin, y, page);
  y = writeListSection(doc, "Tenant / Lease / Income", sections.tenantLeaseIncome, margin, y, page);
  y = writeListSection(doc, "Comparable Evidence", sections.comparableEvidence, margin, y, page);
  y = writeListSection(doc, "Financial Analysis", sections.financialAnalysis, margin, y, page);
  y = writeListSection(doc, "Opportunity signals", sections.opportunitySignals, margin, y, page);
  y = writeListSection(doc, "Risk signals", sections.riskSignals, margin, y, page);
  y = writeListSection(doc, "Missing data / needs review", sections.missingData, margin, y, page);
  y = writeListSection(doc, "What To Verify Next", sections.verificationChecklist, margin, y, page);
  y = writeListSection(doc, "Disclaimer", sections.disclaimer, margin, y, page);

  y = ensureSpace(doc, y, 26, page, margin);
  sectionTitle(doc, "Source URL", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  writeWrapped(doc, sections.sourceUrl, margin, y, page.width - margin * 2, 4.5);

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("This investment pack is generated from imported source data only. Missing fields are not inferred.", margin, page.height - 10);
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

function memoTenantLeaseIncome(deal: Deal) {
  const tenant = deal.tenant && deal.tenant !== "Unknown" ? deal.tenant : "Not available";
  const leaseExpiry = extractedString(deal, "leaseExpiryText") || "Not available";
  const rentReviews = extractedRentReviews(deal);
  const covenantNote = tenant === "Not available"
    ? "Tenant covenant not available from imported data."
    : deal.covenantStrength && deal.covenantStrength !== "Moderate"
      ? `Covenant strength recorded as ${deal.covenantStrength}; verify independently.`
      : "Tenant covenant not independently verified.";

  return [
    `Tenant: ${tenant}`,
    `Passing rent: ${deal.passingRent > 0 ? `${formatGBP(deal.passingRent)} pa` : "Not available"}`,
    `Lease expiry: ${leaseExpiry}`,
    `WAULT: ${deal.wault > 0 ? `${deal.wault.toFixed(1)} years` : "Not available"}`,
    `Lease length: ${deal.leaseLength > 0 ? `${deal.leaseLength.toFixed(1)} years` : "Not available"}`,
    `Rent reviews: ${rentReviews.length ? formatRentReviews(rentReviews) : deal.rentReview !== "None" ? deal.rentReview : "Not available"}`,
    `Covenant note: ${covenantNote}`,
  ];
}

function memoNationalRanking(ranking: NationalRanking | null | undefined) {
  if (!ranking) return ["National ranking was not available for this investment pack export."];
  return [
    `Rank: #${ranking.rank} of ${ranking.total} imported acquisition opportunities`,
    `Percentile: ${ranking.percentile}th`,
    `Top band: Top ${ranking.topPercent}% nationally`,
    `Feed score: ${ranking.rankingScore}/100`,
    `Investor verdict: ${ranking.verdict}`,
    ...ranking.whyMadeList.map((reason) => `Why it made the list: ${reason}`),
  ];
}

function memoFinancialAnalysis(analysis: ReturnType<typeof buildFinancialAnalysis>) {
  const hasGuidePrice = analysis.acquisitionCosts.guidePrice > 0;
  return [
    `Guide price: ${hasGuidePrice ? formatFinancialMoney(analysis.acquisitionCosts.guidePrice) : "Not available"}`,
    `SDLT: ${hasGuidePrice ? formatFinancialMoney(analysis.acquisitionCosts.sdlt) : "Not available"}`,
    `Legal fees: ${formatFinancialMoney(analysis.acquisitionCosts.legalFees)}`,
    `Survey fees: ${formatFinancialMoney(analysis.acquisitionCosts.surveyFees)}`,
    `Total acquisition cost: ${hasGuidePrice ? formatFinancialMoney(analysis.acquisitionCosts.totalAcquisitionCost) : "Not available"}`,
    `Annual rent: ${formatFinancialMoney(analysis.scenarios[0]?.annualRent ?? null)}`,
    ...analysis.scenarios.flatMap((scenario) => [
      `${scenario.name} cash required: ${hasGuidePrice ? formatFinancialMoney(scenario.cashRequired) : "Not available"}`,
      `${scenario.name} annual finance cost: ${hasGuidePrice ? formatFinancialMoney(scenario.annualFinanceCost) : "Not available"}`,
      `${scenario.name} estimated annual cashflow: ${formatFinancialMoney(scenario.annualNetCashflow)}`,
      `${scenario.name} cash-on-cash return: ${formatFinancialPercent(scenario.cashOnCashReturn)}`,
    ]),
  ];
}

function memoVerificationChecklist(deal: Deal, thesisVerify: string[], reasonVerify: string[]) {
  return uniqueStrings([
    ...thesisVerify,
    ...reasonVerify,
    "Ask the agent for tenancy schedule and arrears history",
    "Review legal pack and special conditions",
    "Confirm lease expiry, break clauses and WAULT",
    "Confirm passing rent and rent review clauses",
    "Check EPC and MEES compliance",
    "Review title, easements and restrictions",
    "Check planning constraints and permitted use",
    "Verify floor area against measured plans",
    "Verify source listing accuracy",
    deal.sourceUrl ? `Open source listing: ${deal.sourceUrl}` : "",
  ]).slice(0, 12);
}

function memoComparableEvidence(evidence: ComparableEvidence | null | undefined) {
  if (!evidence) return ["Comparable evidence was not included in this investment pack export."];
  if (evidence.isLimited) {
    return [
      `Cleaned sample size: ${evidence.cleanedSampleSize} usable imported comparable${evidence.cleanedSampleSize === 1 ? "" : "s"}`,
      `Raw local sample size: ${evidence.rawSampleSize} imported peer${evidence.rawSampleSize === 1 ? "" : "s"}`,
      `Excluded from benchmarks: ${evidence.excludedSampleSize} peer${evidence.excludedSampleSize === 1 ? "" : "s"}`,
      `This deal yield: ${formatComparableMetric(evidence.dealYield, "yield")}`,
      `This deal GBP/sqft: ${formatComparableMetric(evidence.dealPricePerSqft, "price")}`,
      "Comparable evidence limited: fewer than five usable local peers remain after excluding outliers, incomplete records and low-confidence data.",
      ...evidence.statements,
    ];
  }
  return [
    `Cleaned sample size: ${evidence.cleanedSampleSize} usable imported comparable${evidence.cleanedSampleSize === 1 ? "" : "s"}`,
    `Raw local sample size: ${evidence.rawSampleSize} imported peer${evidence.rawSampleSize === 1 ? "" : "s"}`,
    `Excluded from benchmarks: ${evidence.excludedSampleSize} peer${evidence.excludedSampleSize === 1 ? "" : "s"}`,
    `This deal yield: ${formatComparableMetric(evidence.dealYield, "yield")}`,
    `Local average yield: ${formatComparableMetric(evidence.averageYield, "yield")}`,
    `Yield difference: ${formatComparableMetric(evidence.yieldDifferencePercent, "percent")}`,
    `This deal GBP/sqft: ${formatComparableMetric(evidence.dealPricePerSqft, "price")}`,
    `Local average GBP/sqft: ${formatComparableMetric(evidence.averagePricePerSqft, "price")}`,
    `GBP/sqft difference: ${formatComparableMetric(evidence.pricePerSqftDifferencePercent, "percent")}`,
    ...evidence.statements,
  ];
}

function extractedString(deal: Deal, key: string) {
  const value = deal.enrichment?.extractedPayload?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function extractedRentReviews(deal: Deal) {
  const reviews = deal.enrichment?.extractedPayload?.rentReviews;
  if (!Array.isArray(reviews)) return [];
  return reviews
    .map((review) => {
      const year = Number((review as { year?: unknown }).year);
      const amount = Number((review as { amount?: unknown }).amount);
      if (!Number.isFinite(year) || !Number.isFinite(amount) || amount <= 0) return null;
      return { year, amount };
    })
    .filter((review): review is { year: number; amount: number } => Boolean(review));
}

function formatRentReviews(reviews: Array<{ year: number; amount: number }>) {
  return reviews.map((review) => `${review.year}: ${formatGBP(review.amount)} pa`).join("; ");
}

function uniqueStrings(items: string[]) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
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
