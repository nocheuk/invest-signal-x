import type { ConfidenceLevel, Deal, Rating } from "@/lib/deals";

export type ScoreReasons = NonNullable<Deal["scoreReasons"]>;

export type DealScoringInput = Pick<
  Deal,
  | "title"
  | "location"
  | "assetType"
  | "source"
  | "guidePrice"
  | "passingRent"
  | "sqft"
  | "grossYield"
  | "netInitialYield"
  | "reversionaryYield"
  | "tenant"
  | "wault"
  | "leaseLength"
  | "pricePerSqft"
  | "planningUpsideScore"
  | "voidRiskScore"
  | "exitYieldSensitivity"
  | "postedAt"
> & {
  importSourceName?: string;
  importSourceType?: string;
  sourceUrl?: string;
  descriptionText?: string;
};

export type ScoredDeal = {
  dealSignalScore: number;
  dataConfidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  scoreCap: number;
  rating: Rating;
  needsReview: boolean;
  grossYield: number;
  netInitialYield: number;
  pricePerSqft: number;
  scoreBreakdown: Deal["scoreBreakdown"];
  mainRiskFlag: string;
  reasons: ScoreReasons;
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const round = (value: number) => Math.round(clamp(value));

export function confidenceCapForScore(dataConfidenceScore: number | undefined) {
  const confidence = Number.isFinite(dataConfidenceScore) ? Number(dataConfidenceScore) : 100;
  if (confidence < 45) return 59;
  if (confidence < 75) return 74;
  return 100;
}

export function confidenceLevelForScore(dataConfidenceScore: number | undefined): ConfidenceLevel {
  const confidence = Number.isFinite(dataConfidenceScore) ? Number(dataConfidenceScore) : 0;
  if (confidence >= 75) return "high";
  if (confidence >= 45) return "medium";
  return "low";
}

export function applyConfidenceCap(score: number, dataConfidenceScore: number | undefined) {
  return round(Math.min(score, confidenceCapForScore(dataConfidenceScore)));
}

export function ratingFromScoreAndConfidence(score: number, dataConfidenceScore: number | undefined): Rating {
  const confidence = Number.isFinite(dataConfidenceScore) ? Number(dataConfidenceScore) : 100;
  if (confidence >= 75 && score >= 78) return "green";
  if (score >= 60) return "amber";
  return "red";
}

export function scoreImportedDeal(input: DealScoringInput): ScoredDeal {
  const guidePrice = safeNumber(input.guidePrice);
  const passingRent = safeNumber(input.passingRent);
  const sqft = safeNumber(input.sqft);
  const calculatedGrossYield = guidePrice > 0 && passingRent > 0 ? (passingRent / guidePrice) * 100 : 0;
  const grossYield = safeNumber(input.grossYield) || calculatedGrossYield;
  const netInitialYield = safeNumber(input.netInitialYield) || grossYield;
  const reversionaryYield = safeNumber(input.reversionaryYield);
  const pricePerSqft = safeNumber(input.pricePerSqft) || (guidePrice > 0 && sqft > 0 ? guidePrice / sqft : 0);
  const sourceName = `${input.importSourceName ?? ""} ${input.importSourceType ?? ""} ${input.source}`.toLowerCase();
  const description = `${input.title} ${input.location} ${input.assetType} ${input.descriptionText ?? ""}`.toLowerCase();
  const isAuctionSource = input.source === "Auction" || sourceName.includes("auction") || sourceName.includes("acuitus");

  const reasons: ScoreReasons = {
    positiveDrivers: [],
    negativeDrivers: [],
    missingDataWarnings: [],
    verifyBeforeTrusting: [],
  };

  if (guidePrice <= 0) {
    reasons.missingDataWarnings.push("Guide price missing");
    reasons.missingDataWarnings.push("Passing rent missing");
    reasons.missingDataWarnings.push("Tenant covenant unknown");
    reasons.missingDataWarnings.push("Lease length/WAULT missing");
    reasons.missingDataWarnings.push("No comparable evidence yet");
    reasons.verifyBeforeTrusting.push("Confirm guide price or asking price from the source listing");
    reasons.verifyBeforeTrusting.push("Verify rent roll, lease terms, tenant covenant and title documents");

    return {
      dealSignalScore: 0,
      dataConfidenceScore: 18,
      confidenceLevel: "low",
      scoreCap: 59,
      rating: "red",
      needsReview: true,
      grossYield,
      netInitialYield,
      pricePerSqft,
      scoreBreakdown: { incomeQuality: 0, tenantSecurity: 15, marketPricing: 0, upside: 20, riskExit: 10 },
      mainRiskFlag: "Needs review",
      reasons,
    };
  }

  if (netInitialYield >= 8) reasons.positiveDrivers.push(`${netInitialYield.toFixed(1)}% yield above 8%`);
  else if (netInitialYield >= 6.5) reasons.positiveDrivers.push(`${netInitialYield.toFixed(1)}% income yield available`);
  if (guidePrice > 0 && sqft > 0) reasons.positiveDrivers.push("Guide price and floor area available");
  if (isAuctionSource && guidePrice > 0 && netInitialYield > 0) reasons.positiveDrivers.push("Auction source includes investment yield");
  if (reversionaryYield > netInitialYield && netInitialYield > 0) reasons.positiveDrivers.push("Reversionary yield suggests income upside");
  if (descriptionMatches(description, ["development", "planning", "refurb", "reversion", "asset management", "vacant possession"])) {
    reasons.positiveDrivers.push("Description suggests potential asset management upside");
  }

  if (passingRent <= 0) reasons.missingDataWarnings.push("Passing rent missing");
  if (!input.tenant || input.tenant === "Unknown") reasons.missingDataWarnings.push("Tenant covenant unknown");
  if (safeNumber(input.wault) <= 0 && safeNumber(input.leaseLength) <= 0) reasons.missingDataWarnings.push("Lease length/WAULT missing");
  if (sqft <= 0) reasons.missingDataWarnings.push("Floor area missing");
  if (!input.sourceUrl) reasons.missingDataWarnings.push("Source URL missing");
  reasons.missingDataWarnings.push("No comparable evidence yet");

  if (passingRent <= 0) reasons.negativeDrivers.push("Income cannot be verified without passing rent");
  if (netInitialYield >= 11) reasons.negativeDrivers.push("Very high yield may signal covenant, location or lease risk");
  if (safeNumber(input.voidRiskScore) >= 60) reasons.negativeDrivers.push("Elevated void or reletting risk");
  if (input.exitYieldSensitivity === "High") reasons.negativeDrivers.push("High exit yield sensitivity");

  reasons.verifyBeforeTrusting.push("Verify rent roll, lease length and tenant covenant before relying on the score");
  reasons.verifyBeforeTrusting.push("Check title, EPC, arrears, occupational lease and any special auction conditions");
  reasons.verifyBeforeTrusting.push("Benchmark pricing against recent comparable transactions");

  const incomeQuality = scoreIncome(netInitialYield, passingRent, isAuctionSource);
  const marketPricing = scoreValue(guidePrice, pricePerSqft, sqft);
  const assetLocation = scoreAssetLocation(input.assetType, input.location, description);
  const upside = scoreUpside(netInitialYield, reversionaryYield, safeNumber(input.planningUpsideScore), description);
  const dataConfidenceScore = scoreDataConfidence({
    guidePrice,
    passingRent,
    sqft,
    netInitialYield,
    pricePerSqft,
    tenant: input.tenant,
    wault: safeNumber(input.wault),
    leaseLength: safeNumber(input.leaseLength),
    sourceUrl: input.sourceUrl,
    location: input.location,
    assetType: input.assetType,
    postedAt: input.postedAt,
    isAuctionSource,
  });
  const riskAndConfidence = round(dataConfidenceScore * 0.75 + (100 - safeNumber(input.voidRiskScore)) * 0.25);

  const rawScore = round(
    incomeQuality * 0.3 +
      marketPricing * 0.2 +
      assetLocation * 0.15 +
      upside * 0.15 +
      riskAndConfidence * 0.2
  );
  const cappedScore = applyConfidenceCap(rawScore, dataConfidenceScore);
  const confidenceLevel = confidenceLevelForScore(dataConfidenceScore);
  const severeWarnings = reasons.missingDataWarnings.filter((warning) => warning !== "No comparable evidence yet");
  const actionableFieldCount = [
    guidePrice > 0,
    Boolean(input.location && input.location !== "All UK"),
    Boolean(input.assetType),
    Boolean(input.sourceUrl),
    sqft > 0 || pricePerSqft > 0,
    passingRent > 0 || netInitialYield > 0 || grossYield > 0,
    Boolean(input.tenant && input.tenant !== "Unknown"),
    safeNumber(input.wault) > 0 || safeNumber(input.leaseLength) > 0,
  ].filter(Boolean).length;
  const needsReview =
    confidenceLevel === "low" ||
    severeWarnings.includes("Source URL missing") ||
    (passingRent <= 0 && netInitialYield <= 0 && grossYield <= 0) ||
    actionableFieldCount <= 3;

  return {
    dealSignalScore: cappedScore,
    dataConfidenceScore,
    confidenceLevel,
    scoreCap: confidenceCapForScore(dataConfidenceScore),
    rating: ratingFromScoreAndConfidence(cappedScore, dataConfidenceScore),
    needsReview,
    grossYield,
    netInitialYield,
    pricePerSqft: Math.round(pricePerSqft),
    scoreBreakdown: {
      incomeQuality,
      tenantSecurity: assetLocation,
      marketPricing,
      upside,
      riskExit: riskAndConfidence,
    },
    mainRiskFlag: needsReview ? firstOrFallback(reasons.negativeDrivers, "Sparse listing data needs review") : firstOrFallback(reasons.negativeDrivers, "Requires due diligence"),
    reasons,
  };
}

function scoreIncome(netInitialYield: number, passingRent: number, isAuctionSource: boolean) {
  if (passingRent <= 0 && netInitialYield <= 0) return 10;
  let score = 25;
  if (netInitialYield >= 10) score = 88;
  else if (netInitialYield >= 8) score = 80;
  else if (netInitialYield >= 7) score = 70;
  else if (netInitialYield >= 6) score = 60;
  else if (netInitialYield >= 5) score = 50;
  else if (netInitialYield > 0) score = 38;
  if (passingRent > 0) score += 8;
  if (isAuctionSource && netInitialYield > 0) score += 4;
  return round(score);
}

function scoreValue(guidePrice: number, pricePerSqft: number, sqft: number) {
  if (guidePrice <= 0) return 0;
  if (pricePerSqft <= 0 || sqft <= 0) return 45;
  if (pricePerSqft <= 100) return 78;
  if (pricePerSqft <= 200) return 70;
  if (pricePerSqft <= 350) return 60;
  if (pricePerSqft <= 600) return 50;
  return 40;
}

function scoreAssetLocation(assetType: Deal["assetType"], location: string, description: string) {
  let score = 45;
  if (assetType) score += 10;
  if (location && location !== "All UK") score += 10;
  if (descriptionMatches(description, ["industrial", "warehouse", "trade counter", "convenience", "foodstore", "healthcare"])) score += 8;
  if (descriptionMatches(`${location} ${description}`.toLowerCase(), ["london", "manchester", "birmingham", "bristol", "leeds", "edinburgh", "bournemouth"])) score += 5;
  return round(score);
}

function scoreUpside(netInitialYield: number, reversionaryYield: number, planningUpsideScore: number, description: string) {
  let score = planningUpsideScore > 0 ? planningUpsideScore : 35;
  if (reversionaryYield > netInitialYield && netInitialYield > 0) score += Math.min(25, ((reversionaryYield - netInitialYield) / netInitialYield) * 100);
  if (descriptionMatches(description, ["development", "planning", "refurb", "asset management", "reversion", "under-rented"])) score += 10;
  return round(score);
}

function scoreDataConfidence(input: {
  guidePrice: number;
  passingRent: number;
  sqft: number;
  netInitialYield: number;
  pricePerSqft: number;
  tenant?: string;
  wault: number;
  leaseLength: number;
  sourceUrl?: string;
  location: string;
  assetType: Deal["assetType"];
  postedAt?: string;
  isAuctionSource: boolean;
}) {
  let score = 0;
  if (input.guidePrice > 0) score += 20;
  if (input.passingRent > 0) score += 12;
  if (input.netInitialYield > 0) score += 12;
  if (input.sourceUrl) score += 8;
  if (input.location && input.location !== "All UK") score += 10;
  if (input.assetType) score += 8;
  if (input.sqft > 0 || input.pricePerSqft > 0) score += 10;
  if (input.tenant && input.tenant !== "Unknown") score += 6;
  if (input.wault > 0 || input.leaseLength > 0) score += 9;
  if (input.postedAt) score += 5;
  if (input.isAuctionSource && input.guidePrice > 0 && input.netInitialYield > 0) score += 10;
  return round(score);
}

function safeNumber(value: number | null | undefined) {
  return Number.isFinite(value) ? Number(value) : 0;
}

function descriptionMatches(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function firstOrFallback(items: string[], fallback: string) {
  return items.length > 0 ? items[0] : fallback;
}
