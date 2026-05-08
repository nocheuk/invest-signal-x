import type { Deal } from "@/lib/deals";
import type { Database } from "@/lib/supabase/types";

type DealRow = Database["public"]["Tables"]["deals"]["Row"];

export type DealSourceMetadata = {
  sourceUrl?: string | null;
  importSourceName?: string | null;
  importSourceType?: string | null;
};

const defaultScoreBreakdown: Deal["scoreBreakdown"] = {
  incomeQuality: 25,
  tenantSecurity: 35,
  marketPricing: 45,
  upside: 30,
  riskExit: 40,
};

const defaultInsights: Deal["insights"] = {
  mispricing: "Imported listing awaiting analyst review.",
  couldGoWrong: "Source data has not been fully underwritten.",
  askAgent: "Confirm lease, rent, title, EPC and tenancy details against source documents.",
  negotiation: "Set target pricing after validation against comparables.",
};

export function mapDealRow(row: DealRow, sourceMetadata: DealSourceMetadata = {}): Deal {
  const guidePrice = safeNumber(row.guide_price);
  const passingRent = safeNumber(row.passing_rent);
  const grossYield = safeNumber(row.gross_yield) || (guidePrice > 0 ? (passingRent / guidePrice) * 100 : 0);
  const netInitialYield = safeNumber(row.net_initial_yield) || Math.max(0, grossYield * 0.93);
  const score = clampScore(row.score ?? (sourceMetadata.importSourceName ? 39 : 0));
  const needsReview = Boolean(sourceMetadata.importSourceName) && (
    netInitialYield === 0 ||
    !row.tenant ||
    row.tenant === "Unknown" ||
    /review/i.test(row.main_risk_flag ?? "")
  );

  return {
    id: row.id,
    title: row.title,
    location: row.location,
    region: row.region,
    assetType: row.asset_type as Deal["assetType"],
    source: row.source as Deal["source"],
    sourceUrl: sourceMetadata.sourceUrl ?? undefined,
    importSourceName: sourceMetadata.importSourceName ?? undefined,
    importSourceType: sourceMetadata.importSourceType ?? undefined,
    needsReview,
    guidePrice,
    passingRent,
    sqft: safeNumber(row.sqft),
    grossYield,
    netInitialYield,
    reversionaryYield: safeNumber(row.reversionary_yield) || netInitialYield,
    wault: safeNumber(row.wault),
    leaseLength: safeNumber(row.lease_length),
    tenant: row.tenant || "Unknown",
    covenantStrength: row.covenant_strength as Deal["covenantStrength"],
    tenantHealthScore: safeNumber(row.tenant_health_score),
    rentSustainability: row.rent_sustainability as Deal["rentSustainability"],
    rentReview: row.rent_review as Deal["rentReview"],
    pricePerSqft: safeNumber(row.price_per_sqft) || (safeNumber(row.sqft) > 0 ? Math.round(guidePrice / safeNumber(row.sqft)) : 0),
    planningUpsideScore: safeNumber(row.planning_upside_score),
    voidRiskScore: safeNumber(row.void_risk_score),
    exitYieldSensitivity: row.exit_yield_sensitivity as Deal["exitYieldSensitivity"],
    cashflowAfterDebt: safeNumber(row.cashflow_after_debt),
    returnOnEquity: safeNumber(row.return_on_equity),
    auctionGuideRisk: row.auction_guide_risk as Deal["auctionGuideRisk"],
    redFlags: row.red_flags ?? [],
    mainRiskFlag: needsReview ? "Needs review" : row.main_risk_flag,
    score,
    rating: (row.rating || ratingFromScore(score)) as Deal["rating"],
    scoreBreakdown: (row.score_breakdown as Deal["scoreBreakdown"]) ?? defaultScoreBreakdown,
    insights: (row.insights as Deal["insights"]) ?? defaultInsights,
    thumbnail: row.thumbnail || "from-zinc-500/30 to-slate-700/20",
    postedAt: row.posted_at,
  };
}

export function mapDealToInsert(deal: Deal) {
  return {
    id: deal.id,
    title: deal.title,
    location: deal.location,
    region: deal.region,
    asset_type: deal.assetType,
    source: deal.source,
    guide_price: deal.guidePrice,
    passing_rent: deal.passingRent,
    sqft: deal.sqft,
    gross_yield: deal.grossYield,
    net_initial_yield: deal.netInitialYield,
    reversionary_yield: deal.reversionaryYield,
    wault: deal.wault,
    lease_length: deal.leaseLength,
    tenant: deal.tenant,
    covenant_strength: deal.covenantStrength,
    tenant_health_score: deal.tenantHealthScore,
    rent_sustainability: deal.rentSustainability,
    rent_review: deal.rentReview,
    price_per_sqft: deal.pricePerSqft,
    planning_upside_score: deal.planningUpsideScore,
    void_risk_score: deal.voidRiskScore,
    exit_yield_sensitivity: deal.exitYieldSensitivity,
    cashflow_after_debt: deal.cashflowAfterDebt,
    return_on_equity: deal.returnOnEquity,
    auction_guide_risk: deal.auctionGuideRisk ?? null,
    red_flags: deal.redFlags,
    main_risk_flag: deal.mainRiskFlag,
    score: deal.score,
    rating: deal.rating,
    score_breakdown: deal.scoreBreakdown,
    insights: deal.insights,
    thumbnail: deal.thumbnail,
    posted_at: deal.postedAt,
  };
}

function safeNumber(value: number | null | undefined) {
  return Number.isFinite(value) ? Number(value) : 0;
}

function clampScore(value: number | null | undefined) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(Number(value))));
}

function ratingFromScore(score: number): Deal["rating"] {
  if (score >= 78) return "green";
  if (score >= 60) return "amber";
  return "red";
}
