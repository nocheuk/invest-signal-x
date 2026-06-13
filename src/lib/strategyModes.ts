import type { Deal } from "@/lib/deals";

export type StrategyModeId =
  | "general-investment"
  | "high-street-conversion"
  | "auction-opportunities"
  | "high-yield-income"
  | "development-land"
  | "owner-occupier";

export type StrategyMode = {
  id: StrategyModeId;
  label: string;
  shortLabel: string;
  description: string;
};

export type StrategyModeMatch = {
  mode: StrategyMode;
  score: number;
  matches: boolean;
  tier: "best" | "match" | "none";
  reasons: string[];
  matchedSignals: string[];
  missingSignals: string[];
  missingDiligence: string[];
};

export type StrategyDiagnosticsEntry = {
  deal: Deal;
  score: number;
  tier: StrategyModeMatch["tier"];
  matchedSignals: string[];
  missingSignals: string[];
};

export type StrategyDiagnostics = {
  totalImportedDeals: number;
  score20Plus: number;
  score30Plus: number;
  score40Plus: number;
  score50Plus: number;
  entries: StrategyDiagnosticsEntry[];
  nearMisses: StrategyDiagnosticsEntry[];
};

export const STRATEGY_MODES: StrategyMode[] = [
  {
    id: "general-investment",
    label: "General Investment",
    shortLabel: "General",
    description: "Use DealSignal's standard opportunity ranking, scoring, confidence and acquisition brief signals.",
  },
  {
    id: "high-street-conversion",
    label: "High Street Upper-Floor Conversion",
    shortLabel: "High Street Conversion",
    description: "Find high street or town-centre buildings with upper-floor, mixed-use or residential conversion potential.",
  },
  {
    id: "auction-opportunities",
    label: "Auction Opportunities",
    shortLabel: "Auctions",
    description: "Prioritise auction-led acquisition opportunities.",
  },
  {
    id: "high-yield-income",
    label: "High Yield Income",
    shortLabel: "High Yield",
    description: "Prioritise income-led investments with strong visible yield.",
  },
  {
    id: "development-land",
    label: "Development / Land",
    shortLabel: "Development",
    description: "Prioritise land, development and planning-led opportunities.",
  },
  {
    id: "owner-occupier",
    label: "Owner-Occupier",
    shortLabel: "Owner-Occupier",
    description: "Prioritise buildings that may suit operating businesses buying for occupation.",
  },
] as const;

const GENERAL_MODE = STRATEGY_MODES[0];
const HIGH_STREET_MODE = STRATEGY_MODES[1];

const HIGH_STREET_DISCOVERY_THRESHOLD = 20;
const HIGH_STREET_BEST_THRESHOLD = 40;

const HIGH_STREET_SIGNALS: Array<{ label: string; pattern: RegExp; reason: string; weight: number }> = [
  { label: "high street", pattern: /\bhigh street\b/i, reason: "High street location mentioned", weight: 22 },
  { label: "town centre", pattern: /\btown centre\b|\bcity centre\b/i, reason: "Town-centre location mentioned", weight: 18 },
  { label: "retail with upper parts", pattern: /\bretail\b.*\bupper\b|\bupper\b.*\bretail\b|\bretail\b.*\bupper parts?\b/i, reason: "Retail with upper parts indicated", weight: 22 },
  { label: "upper floors", pattern: /\bupper parts?\b|\bupper floors?\b|\bself[- ]contained upper floors?\b|\baccommodation above\b/i, reason: "Upper-floor accommodation indicated", weight: 24 },
  { label: "vacant upper floors", pattern: /\bvacant upper\b|\bvacant accommodation\b|\bunderused upper\b|\bvacant possession\b|\bvp\b/i, reason: "Vacant or underused upper floors mentioned", weight: 24 },
  { label: "residential conversion", pattern: /\bresidential conversion\b|\bconversion potential\b|\bconvert(?:ed|ible)? to residential\b|\bretail and residential\b/i, reason: "Residential conversion potential mentioned", weight: 28 },
  { label: "development opportunity", pattern: /\bdevelopment potential\b|\bdevelopment opportunity\b|\bredevelopment\b|\bredevelopment potential\b|\bplanning potential\b|\bstpp\b/i, reason: "Development or planning potential mentioned", weight: 20 },
  { label: "mixed-use", pattern: /\bmixed[- ]use\b|\bmixed use\b/i, reason: "Mixed-use potential indicated", weight: 18 },
  { label: "former bank or department store", pattern: /\bformer bank\b|\bformer department store\b/i, reason: "Former bank or department-store format may suit upper-floor reuse", weight: 18 },
  { label: "Class E / permitted development", pattern: /\bclass e\b|\bpermitted development\b/i, reason: "Use-class or permitted-development signal mentioned", weight: 18 },
  { label: "upper access", pattern: /\brear access\b|\bself[- ]contained upper access\b|\bseparate access\b|\bself[- ]contained upper floors?\b/i, reason: "Access arrangement may support upper-floor conversion", weight: 18 },
  { label: "ancillary / storage above", pattern: /\bstock rooms?\b|\bancillary accommodation\b|\bstorage above\b/i, reason: "Ancillary, storage or stock-room space mentioned", weight: 12 },
];

const STRATEGY_DILIGENCE: Array<{ label: string; pattern: RegExp }> = [
  { label: "upper floor access", pattern: /\bupper access\b|\bself-contained upper access\b|\bseparate access\b|\brear access\b/i },
  { label: "planning status", pattern: /\bplanning\b|\bpermitted development\b|\bprior approval\b/i },
  { label: "current use class", pattern: /\bclass e\b|\buse class\b|\ba1\b|\ba2\b|\ba3\b/i },
  { label: "floor plans", pattern: /\bfloor plans?\b|\bplans available\b/i },
  { label: "residential conversion feasibility", pattern: /\bresidential conversion\b|\bconvert(?:ed|ible)? to residential\b|\baccommodation above\b/i },
  { label: "EPC", pattern: /\bepc\b/i },
  { label: "title restrictions", pattern: /\btitle restriction\b|\brestrictive covenant\b|\blegal pack\b/i },
  { label: "fire escape / access", pattern: /\bfire escape\b|\bmeans of escape\b|\bescape route\b/i },
  { label: "vacant possession", pattern: /\bvacant possession\b|\bvp\b|\bvacant\b/i },
];

export function parseStrategyMode(value: string | null | undefined): StrategyModeId {
  return STRATEGY_MODES.some((mode) => mode.id === value) ? value as StrategyModeId : "general-investment";
}

export function strategyModeById(id: StrategyModeId) {
  return STRATEGY_MODES.find((mode) => mode.id === id) ?? GENERAL_MODE;
}

export function isGeneralStrategyMode(id: StrategyModeId) {
  return id === "general-investment";
}

export function scoreStrategyMode(deal: Deal, modeId: StrategyModeId): StrategyModeMatch {
  if (modeId === "general-investment") {
    return { mode: GENERAL_MODE, score: 100, matches: true, tier: "best", reasons: ["Uses DealSignal's standard investment scoring."], matchedSignals: [], missingSignals: [], missingDiligence: [] };
  }
  if (modeId === "high-street-conversion") return scoreHighStreetConversion(deal);
  return scorePlaceholderMode(deal, strategyModeById(modeId));
}

export function filterDealsForStrategyMode(deals: Deal[], modeId: StrategyModeId) {
  if (modeId === "general-investment") return deals;
  return deals
    .map((deal) => ({ deal, match: scoreStrategyMode(deal, modeId) }))
    .filter(({ match }) => match.matches)
    .sort((a, b) => b.match.score - a.match.score || b.deal.score - a.deal.score)
    .map(({ deal }) => deal);
}

export function strategyModeDescription(id: StrategyModeId) {
  return strategyModeById(id).description;
}

export function buildHighStreetConversionDiagnostics(deals: Deal[]): StrategyDiagnostics {
  const importedDeals = deals.filter((deal) => deal.isImported);
  const entries = importedDeals
    .map((deal) => {
      const match = scoreHighStreetConversion(deal);
      return {
        deal,
        score: match.score,
        tier: match.tier,
        matchedSignals: match.matchedSignals,
        missingSignals: match.missingSignals,
      };
    })
    .sort((a, b) => b.score - a.score || b.deal.score - a.deal.score);

  return {
    totalImportedDeals: importedDeals.length,
    score20Plus: entries.filter((entry) => entry.score >= 20).length,
    score30Plus: entries.filter((entry) => entry.score >= 30).length,
    score40Plus: entries.filter((entry) => entry.score >= 40).length,
    score50Plus: entries.filter((entry) => entry.score >= 50).length,
    entries,
    nearMisses: entries.filter((entry) => entry.score >= 20 && entry.score < 40).slice(0, 50),
  };
}

function scoreHighStreetConversion(deal: Deal): StrategyModeMatch {
  const text = dealStrategyText(deal);
  const reasons: string[] = [];
  let score = 0;

  for (const signal of HIGH_STREET_SIGNALS) {
    if (signal.pattern.test(text)) {
      score += signal.weight;
      reasons.push(signal.reason);
    }
  }

  if (deal.assetType === "Retail" || deal.assetType === "Mixed-use") {
    score += 14;
    reasons.push(`${deal.assetType} asset type fits high-street conversion screening`);
  }

  if (deal.assetType === "Industrial" && score < 45) score = Math.max(0, score - 30);
  if (deal.assetType === "Land" && !/\bhigh street\b|\btown centre\b|\bresidential conversion\b|\bmixed[- ]use\b/i.test(text)) score = Math.max(0, score - 25);

  const missingDiligence = STRATEGY_DILIGENCE
    .filter((item) => !item.pattern.test(text))
    .map((item) => item.label);

  const uniqueReasons = unique(reasons).slice(0, 5);
  const matchedSignals = HIGH_STREET_SIGNALS.filter((signal) => signal.pattern.test(text)).map((signal) => signal.label);
  const missingSignals = HIGH_STREET_SIGNALS.filter((signal) => !signal.pattern.test(text)).map((signal) => signal.label);
  const safeScore = Math.min(100, score);
  return {
    mode: HIGH_STREET_MODE,
    score: safeScore,
    matches: safeScore >= HIGH_STREET_DISCOVERY_THRESHOLD && uniqueReasons.length > 0,
    tier: safeScore >= HIGH_STREET_BEST_THRESHOLD ? "best" : safeScore >= HIGH_STREET_DISCOVERY_THRESHOLD ? "match" : "none",
    reasons: uniqueReasons,
    matchedSignals,
    missingSignals,
    missingDiligence,
  };
}

function scorePlaceholderMode(deal: Deal, mode: StrategyMode): StrategyModeMatch {
  const score = mode.id === "auction-opportunities" && deal.source === "Auction"
    ? 70
    : mode.id === "high-yield-income" && (deal.netInitialYield || deal.grossYield) >= 8
      ? 70
      : mode.id === "development-land" && (deal.assetType === "Land" || deal.planningUpsideScore >= 70)
        ? 70
        : mode.id === "owner-occupier" && deal.tenant === "Unknown"
          ? 55
          : 0;
  return {
    mode,
    score,
    matches: score >= 50,
    tier: score >= 50 ? "best" : "none",
    reasons: score >= 50 ? [`${mode.shortLabel} signal detected from existing deal fields.`] : [],
    matchedSignals: score >= 50 ? [mode.shortLabel] : [],
    missingSignals: score >= 50 ? [] : [mode.shortLabel],
    missingDiligence: [],
  };
}

function dealStrategyText(deal: Deal) {
  return [
    deal.title,
    deal.location,
    deal.region,
    deal.assetType,
    deal.source,
    deal.tenant,
    deal.mainRiskFlag,
    ...(deal.redFlags ?? []),
    ...(deal.scoreReasons?.positiveDrivers ?? []),
    ...(deal.scoreReasons?.negativeDrivers ?? []),
    ...(deal.scoreReasons?.missingDataWarnings ?? []),
    ...(deal.scoreReasons?.verifyBeforeTrusting ?? []),
    ...(deal.analysis?.opportunitySignals ?? []),
    ...(deal.analysis?.riskSignals ?? []),
    deal.analysis?.investmentSummary,
    deal.enrichment?.investmentSummary,
    deal.enrichment?.vatInfo,
    deal.enrichment?.epcRating,
    deal.enrichment?.auctionInfo ? JSON.stringify(deal.enrichment.auctionInfo) : "",
    deal.enrichment?.extractedPayload ? JSON.stringify(deal.enrichment.extractedPayload) : "",
    deal.insights?.mispricing,
    deal.insights?.askAgent,
    deal.insights?.couldGoWrong,
    deal.insights?.negotiation,
  ].filter(Boolean).join(" ");
}

function unique(items: string[]) {
  return Array.from(new Set(items));
}
