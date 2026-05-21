export type Rating = "green" | "amber" | "red";
export type ConfidenceLevel = "high" | "medium" | "low";
export type AssetType =
  | "Retail"
  | "Office"
  | "Industrial"
  | "Leisure"
  | "Mixed-use"
  | "Land"
  | "Healthcare"
  | "Roadside"
  | "Convenience";

export type RentReview = "Upward-only" | "Fixed uplift" | "CPI/RPI linked" | "Open market" | "None";
export type RentSustainability = "Under-rented" | "Market rent" | "Over-rented";

export interface Deal {
  id: string;
  title: string;
  location: string;
  region: string;
  assetType: AssetType;
  source: "Auction" | "Private treaty" | "Off-market" | "Receiver sale";
  sourceUrl?: string;
  importSourceName?: string;
  importSourceType?: string;
  isImported?: boolean;
  isSeed?: boolean;
  needsReview?: boolean;
  imageUrl?: string;
  dataConfidenceScore?: number;
  confidenceLevel?: ConfidenceLevel;
  scoreReasons?: {
    positiveDrivers: string[];
    negativeDrivers: string[];
    missingDataWarnings: string[];
    verifyBeforeTrusting: string[];
  };
  guidePrice: number; // £
  passingRent: number; // £ pa
  sqft: number;
  grossYield: number; // %
  netInitialYield: number; // %
  reversionaryYield: number; // %
  wault: number; // years
  leaseLength: number; // years remaining on principal lease
  tenant: string;
  covenantStrength: "Strong" | "Good" | "Moderate" | "Weak" | "Vacant";
  tenantHealthScore: number; // 0-100
  rentSustainability: RentSustainability;
  rentReview: RentReview;
  pricePerSqft: number;
  planningUpsideScore: number; // 0-100
  voidRiskScore: number; // 0-100 (higher = riskier)
  exitYieldSensitivity: "Low" | "Moderate" | "High";
  cashflowAfterDebt: number; // £ pa, can be negative
  returnOnEquity: number; // %
  auctionGuideRisk?: "Low" | "Moderate" | "High";
  redFlags: string[];
  mainRiskFlag: string;
  score: number; // 0-100
  rating: Rating;
  scoreBreakdown: {
    incomeQuality: number;
    tenantSecurity: number;
    marketPricing: number;
    upside: number;
    riskExit: number;
  };
  insights: {
    mispricing: string;
    couldGoWrong: string;
    askAgent: string;
    negotiation: string;
  };
  thumbnail: string; // gradient seed
  postedAt: string; // ISO
}

const fmtGBP = (n: number) =>
  n >= 1_000_000
    ? `£${(n / 1_000_000).toFixed(2)}m`
    : n >= 1_000
    ? `£${(n / 1_000).toFixed(0)}k`
    : `£${n}`;

export const formatGBP = fmtGBP;
export const formatPct = (n: number, dp = 2) => `${n.toFixed(dp)}%`;

const ratingFromScore = (s: number): Rating => (s >= 78 ? "green" : s >= 60 ? "amber" : "red");

const D = (d: Omit<Deal, "rating" | "score" | "scoreBreakdown"> & { scoreBreakdown: Deal["scoreBreakdown"] }): Deal => {
  const sb = d.scoreBreakdown;
  const score = Math.round(
    sb.incomeQuality * 0.25 +
      sb.tenantSecurity * 0.25 +
      sb.marketPricing * 0.2 +
      sb.upside * 0.15 +
      sb.riskExit * 0.15
  );
  return { ...d, score, rating: ratingFromScore(score) };
};

export const DEALS: Deal[] = [
  D({
    id: "ds-001",
    title: "Tesco Express Investment",
    location: "Sheffield, S10",
    region: "Yorkshire",
    assetType: "Convenience",
    source: "Private treaty",
    guidePrice: 1_950_000,
    passingRent: 124_000,
    sqft: 4_200,
    grossYield: 6.36,
    netInitialYield: 6.05,
    reversionaryYield: 6.4,
    wault: 11.2,
    leaseLength: 12,
    tenant: "Tesco Stores Ltd",
    covenantStrength: "Strong",
    tenantHealthScore: 94,
    rentSustainability: "Market rent",
    rentReview: "CPI/RPI linked",
    pricePerSqft: 464,
    planningUpsideScore: 35,
    voidRiskScore: 12,
    exitYieldSensitivity: "Low",
    cashflowAfterDebt: 28_400,
    returnOnEquity: 8.7,
    redFlags: [],
    mainRiskFlag: "Limited reversion",
    insights: {
      mispricing: "Yield 25–40 bps wide of comparable Tesco lots in similar catchments — pricing reflects nervousness around CPI cap, but cap is at 4%.",
      couldGoWrong: "If CPI normalises below 2% for the next 5 years, rental growth lags retail comps.",
      askAgent: "Confirm CPI floor and cap, schedule of condition, and any tenant break options not in the headline.",
      negotiation: "Push for £1.85m citing 6.4% NIY benchmark and 12 months until next CPI review.",
    },
    scoreBreakdown: { incomeQuality: 82, tenantSecurity: 95, marketPricing: 80, upside: 55, riskExit: 86 },
    thumbnail: "from-emerald-500/30 to-teal-700/20",
    postedAt: "2026-04-29T08:12:00Z",
  }),
  D({
    id: "ds-002",
    title: "Multi-let Industrial Estate",
    location: "Wakefield, WF2",
    region: "Yorkshire",
    assetType: "Industrial",
    source: "Private treaty",
    guidePrice: 6_400_000,
    passingRent: 512_000,
    sqft: 78_500,
    grossYield: 8.0,
    netInitialYield: 7.45,
    reversionaryYield: 9.1,
    wault: 4.6,
    leaseLength: 6,
    tenant: "5 tenants — mixed SME",
    covenantStrength: "Moderate",
    tenantHealthScore: 71,
    rentSustainability: "Under-rented",
    rentReview: "Upward-only",
    pricePerSqft: 81,
    planningUpsideScore: 55,
    voidRiskScore: 28,
    exitYieldSensitivity: "Moderate",
    cashflowAfterDebt: 142_000,
    returnOnEquity: 14.2,
    redFlags: ["One unit overrented by ~18%"],
    mainRiskFlag: "SME covenant mix",
    insights: {
      mispricing: "Passing rent is ~15% below ERV. Reversion to £6.20/sqft on renewal would add £62k pa.",
      couldGoWrong: "Two units expire in 14 months; SME concentration risk on logistics tenant.",
      askAgent: "Tenant arrears, schedule of dilapidations, EPC ratings, and last 3 years' service charge reconciliation.",
      negotiation: "Bid £6.05m reflecting 7.85% NIY and 4.6 yr WAULT; cite reversion already priced.",
    },
    scoreBreakdown: { incomeQuality: 84, tenantSecurity: 64, marketPricing: 82, upside: 88, riskExit: 70 },
    thumbnail: "from-cyan-500/30 to-blue-700/20",
    postedAt: "2026-04-30T07:00:00Z",
  }),
  D({
    id: "ds-003",
    title: "Vacant High Street Unit",
    location: "Doncaster, DN1",
    region: "Yorkshire",
    assetType: "Retail",
    source: "Auction",
    guidePrice: 185_000,
    passingRent: 0,
    sqft: 2_800,
    grossYield: 0,
    netInitialYield: 0,
    reversionaryYield: 11.4,
    wault: 0,
    leaseLength: 0,
    tenant: "Vacant",
    covenantStrength: "Vacant",
    tenantHealthScore: 0,
    rentSustainability: "Market rent",
    rentReview: "None",
    pricePerSqft: 66,
    planningUpsideScore: 78,
    voidRiskScore: 84,
    exitYieldSensitivity: "High",
    cashflowAfterDebt: -14_500,
    returnOnEquity: -8.6,
    auctionGuideRisk: "High",
    redFlags: ["Vacant 9 months", "Footfall declining 12% YoY", "Class E reletting unproven"],
    mainRiskFlag: "Vacant — uncertain reletting",
    insights: {
      mispricing: "Cap value of £66/sqft is below build cost — but only relevant if planning upside materialises.",
      couldGoWrong: "12+ month void with rates and insurance burning ~£18k pa. Letting evidence is thin.",
      askAgent: "Empty rates relief eligibility, last letting attempts, condition of M&E, and any pre-app planning advice.",
      negotiation: "Bid below guide at £155k — reflecting holding cost and reletting timeline.",
    },
    scoreBreakdown: { incomeQuality: 10, tenantSecurity: 5, marketPricing: 65, upside: 82, riskExit: 28 },
    thumbnail: "from-rose-500/30 to-orange-700/20",
    postedAt: "2026-04-28T11:42:00Z",
  }),
  D({
    id: "ds-004",
    title: "Pure Gym Investment",
    location: "Leicester, LE1",
    region: "East Midlands",
    assetType: "Leisure",
    source: "Private treaty",
    guidePrice: 3_250_000,
    passingRent: 245_000,
    sqft: 18_400,
    grossYield: 7.54,
    netInitialYield: 7.05,
    reversionaryYield: 7.6,
    wault: 13.8,
    leaseLength: 14,
    tenant: "PureGym Ltd",
    covenantStrength: "Good",
    tenantHealthScore: 78,
    rentSustainability: "Market rent",
    rentReview: "Fixed uplift",
    pricePerSqft: 177,
    planningUpsideScore: 25,
    voidRiskScore: 22,
    exitYieldSensitivity: "Moderate",
    cashflowAfterDebt: 56_200,
    returnOnEquity: 11.4,
    redFlags: ["Sector exit liquidity narrower than retail/industrial"],
    mainRiskFlag: "Specialist asset class",
    insights: {
      mispricing: "Trades 60–80 bps wide of foodstore comps despite stronger fixed uplifts — sector discount overstated.",
      couldGoWrong: "Buyer pool on exit is narrower; institutional appetite for leisure remains selective.",
      askAgent: "Tenant trading data if available, fit-out residual value, and any landlord break.",
      negotiation: "£3.10m gets you a 7.4% NIY and a clear 5-year fixed uplift baked in.",
    },
    scoreBreakdown: { incomeQuality: 80, tenantSecurity: 78, marketPricing: 76, upside: 50, riskExit: 64 },
    thumbnail: "from-violet-500/30 to-fuchsia-700/20",
    postedAt: "2026-04-29T15:20:00Z",
  }),
  D({
    id: "ds-005",
    title: "Mixed-use High Street Building",
    location: "Bath, BA1",
    region: "South West",
    assetType: "Mixed-use",
    source: "Private treaty",
    guidePrice: 1_450_000,
    passingRent: 92_500,
    sqft: 4_800,
    grossYield: 6.38,
    netInitialYield: 5.85,
    reversionaryYield: 7.2,
    wault: 6.2,
    leaseLength: 8,
    tenant: "Independent retailer + 3 flats",
    covenantStrength: "Moderate",
    tenantHealthScore: 66,
    rentSustainability: "Under-rented",
    rentReview: "Upward-only",
    pricePerSqft: 302,
    planningUpsideScore: 72,
    voidRiskScore: 24,
    exitYieldSensitivity: "Low",
    cashflowAfterDebt: 19_400,
    returnOnEquity: 9.2,
    redFlags: [],
    mainRiskFlag: "Indie retail covenant",
    insights: {
      mispricing: "Residential element underpins exit value; commercial reversion adds optionality.",
      couldGoWrong: "Independent retailer dependency — covenant fragility if footfall softens.",
      askAgent: "EPC on residential, any HMO licensing, freehold/leasehold split, and historic flat voids.",
      negotiation: "£1.38m to reflect 6.7% gross and break-even on debt at 5.5% LTC.",
    },
    scoreBreakdown: { incomeQuality: 76, tenantSecurity: 68, marketPricing: 82, upside: 84, riskExit: 80 },
    thumbnail: "from-amber-500/30 to-yellow-700/20",
    postedAt: "2026-04-30T09:11:00Z",
  }),
  D({
    id: "ds-006",
    title: "Regional Office Block",
    location: "Reading, RG1",
    region: "South East",
    assetType: "Office",
    source: "Private treaty",
    guidePrice: 8_750_000,
    passingRent: 820_000,
    sqft: 42_000,
    grossYield: 9.37,
    netInitialYield: 8.6,
    reversionaryYield: 8.9,
    wault: 3.1,
    leaseLength: 4,
    tenant: "2 tenants — single-floor lets",
    covenantStrength: "Moderate",
    tenantHealthScore: 62,
    rentSustainability: "Over-rented",
    rentReview: "Upward-only",
    pricePerSqft: 208,
    planningUpsideScore: 60,
    voidRiskScore: 68,
    exitYieldSensitivity: "High",
    cashflowAfterDebt: 88_000,
    returnOnEquity: 6.4,
    redFlags: ["Over-rented vs market by ~12%", "Hybrid working pressure on regional office demand", "EPC C — capex needed"],
    mainRiskFlag: "Lease expiry cliff in 36 months",
    insights: {
      mispricing: "Headline yield looks attractive but reversion is downward — true sustainable yield closer to 7.6%.",
      couldGoWrong: "Both tenants exit at break — £1.2m+ of voids, rates, and refit before reletting.",
      askAgent: "Tenant break options, EPC remediation cost, service charge cap, and last 5 lettings on the block.",
      negotiation: "Only worth pursuing sub £7.4m with a clear value-add or PDR conversion plan.",
    },
    scoreBreakdown: { incomeQuality: 88, tenantSecurity: 48, marketPricing: 50, upside: 65, riskExit: 35 },
    thumbnail: "from-slate-500/30 to-zinc-700/20",
    postedAt: "2026-04-27T14:00:00Z",
  }),
  D({
    id: "ds-007",
    title: "Roadside Drive-Thru Investment",
    location: "Milton Keynes, MK9",
    region: "South East",
    assetType: "Roadside",
    source: "Private treaty",
    guidePrice: 2_850_000,
    passingRent: 162_000,
    sqft: 2_400,
    grossYield: 5.68,
    netInitialYield: 5.4,
    reversionaryYield: 5.7,
    wault: 16.4,
    leaseLength: 17,
    tenant: "Costa Coffee Ltd",
    covenantStrength: "Strong",
    tenantHealthScore: 91,
    rentSustainability: "Market rent",
    rentReview: "CPI/RPI linked",
    pricePerSqft: 1_188,
    planningUpsideScore: 30,
    voidRiskScore: 8,
    exitYieldSensitivity: "Low",
    cashflowAfterDebt: 24_300,
    returnOnEquity: 7.1,
    redFlags: [],
    mainRiskFlag: "Tight yield — limited margin",
    insights: {
      mispricing: "Best-in-class roadside — yield reflects covenant. Comparable Costa lots have traded at 5.0–5.25%.",
      couldGoWrong: "Yield compression cycle has limited room. Cap rate sensitivity on exit.",
      askAgent: "Tenant turnover (if disclosed), drive-thru order volume, rates of nearby vacant pads.",
      negotiation: "Stretch to £2.95m only if you can lock 60% LTV at sub-5.5% — ROE compresses fast otherwise.",
    },
    scoreBreakdown: { incomeQuality: 82, tenantSecurity: 96, marketPricing: 70, upside: 50, riskExit: 88 },
    thumbnail: "from-red-500/30 to-rose-700/20",
    postedAt: "2026-04-30T06:30:00Z",
  }),
  D({
    id: "ds-008",
    title: "NHS GP Surgery Investment",
    location: "Newcastle, NE6",
    region: "North East",
    assetType: "Healthcare",
    source: "Private treaty",
    guidePrice: 4_200_000,
    passingRent: 248_000,
    sqft: 9_800,
    grossYield: 5.9,
    netInitialYield: 5.65,
    reversionaryYield: 5.95,
    wault: 18.5,
    leaseLength: 20,
    tenant: "GP Partnership (NHS reimbursed)",
    covenantStrength: "Strong",
    tenantHealthScore: 92,
    rentSustainability: "Market rent",
    rentReview: "Open market",
    pricePerSqft: 428,
    planningUpsideScore: 20,
    voidRiskScore: 10,
    exitYieldSensitivity: "Low",
    cashflowAfterDebt: 31_200,
    returnOnEquity: 7.4,
    redFlags: [],
    mainRiskFlag: "Open market reviews can lag inflation",
    insights: {
      mispricing: "Long, NHS-reimbursed income trades at a premium — but 5.9% gross is still wide of LSE-listed PHP comps.",
      couldGoWrong: "Open market reviews require evidence; recent settlements have been flat for 2+ cycles.",
      askAgent: "District Valuer rent confirmation, lease expiry, and any reimbursement formula changes.",
      negotiation: "Tight market — full ask is acceptable for a long-dated, low-volatility income.",
    },
    scoreBreakdown: { incomeQuality: 80, tenantSecurity: 94, marketPricing: 72, upside: 45, riskExit: 88 },
    thumbnail: "from-emerald-500/30 to-green-700/20",
    postedAt: "2026-04-29T10:48:00Z",
  }),
  D({
    id: "ds-009",
    title: "Restaurant Unit — A3",
    location: "Brighton, BN1",
    region: "South East",
    assetType: "Leisure",
    source: "Auction",
    guidePrice: 540_000,
    passingRent: 48_000,
    sqft: 1_650,
    grossYield: 8.89,
    netInitialYield: 8.1,
    reversionaryYield: 8.6,
    wault: 2.4,
    leaseLength: 3,
    tenant: "Independent restaurant operator",
    covenantStrength: "Weak",
    tenantHealthScore: 38,
    rentSustainability: "Over-rented",
    rentReview: "Upward-only",
    pricePerSqft: 327,
    planningUpsideScore: 50,
    voidRiskScore: 72,
    exitYieldSensitivity: "High",
    cashflowAfterDebt: 4_200,
    returnOnEquity: 4.8,
    auctionGuideRisk: "Moderate",
    redFlags: ["Over-rented", "Operator filed accounts late", "Short WAULT"],
    mainRiskFlag: "Operator covenant weak",
    insights: {
      mispricing: "Yield headline is attractive only because the rent isn't sustainable.",
      couldGoWrong: "Operator failure → 9–12 month void, dilapidations claim may be uncollectable.",
      askAgent: "Tenant accounts, rent payment history, and any guarantor.",
      negotiation: "Bid £465k assuming 6 months void and £15k refit on reletting at £36k.",
    },
    scoreBreakdown: { incomeQuality: 70, tenantSecurity: 30, marketPricing: 55, upside: 60, riskExit: 38 },
    thumbnail: "from-pink-500/30 to-red-700/20",
    postedAt: "2026-04-30T05:50:00Z",
  }),
  D({
    id: "ds-010",
    title: "Last-mile Logistics Unit",
    location: "Birmingham, B7",
    region: "West Midlands",
    assetType: "Industrial",
    source: "Off-market",
    guidePrice: 4_950_000,
    passingRent: 312_000,
    sqft: 38_400,
    grossYield: 6.3,
    netInitialYield: 6.05,
    reversionaryYield: 7.2,
    wault: 7.8,
    leaseLength: 8,
    tenant: "DPD Group UK Ltd",
    covenantStrength: "Strong",
    tenantHealthScore: 89,
    rentSustainability: "Under-rented",
    rentReview: "Upward-only",
    pricePerSqft: 129,
    planningUpsideScore: 65,
    voidRiskScore: 14,
    exitYieldSensitivity: "Low",
    cashflowAfterDebt: 62_500,
    returnOnEquity: 10.8,
    redFlags: [],
    mainRiskFlag: "Single-let concentration",
    insights: {
      mispricing: "Reversion to £9.50/sqft adds £53k pa at next review — current pricing reflects passing only.",
      couldGoWrong: "DPD consolidation could see a future break exercised at year 5.",
      askAgent: "Tenant break clauses, eaves height, yard ratio, and EV charging capacity.",
      negotiation: "£4.85m fair — reversion belongs to you, not the vendor.",
    },
    scoreBreakdown: { incomeQuality: 80, tenantSecurity: 88, marketPricing: 82, upside: 86, riskExit: 84 },
    thumbnail: "from-blue-500/30 to-indigo-700/20",
    postedAt: "2026-04-28T16:22:00Z",
  }),
  D({
    id: "ds-011",
    title: "Auction Lot — Mixed Portfolio (4 units)",
    location: "Stoke-on-Trent, ST1",
    region: "West Midlands",
    assetType: "Retail",
    source: "Auction",
    guidePrice: 320_000,
    passingRent: 41_200,
    sqft: 6_800,
    grossYield: 12.88,
    netInitialYield: 10.4,
    reversionaryYield: 13.2,
    wault: 2.1,
    leaseLength: 3,
    tenant: "4 secondary covenants",
    covenantStrength: "Weak",
    tenantHealthScore: 42,
    rentSustainability: "Market rent",
    rentReview: "Upward-only",
    pricePerSqft: 47,
    planningUpsideScore: 45,
    voidRiskScore: 70,
    exitYieldSensitivity: "High",
    cashflowAfterDebt: 12_800,
    returnOnEquity: 9.6,
    auctionGuideRisk: "High",
    redFlags: ["Two tenants on rolling licences", "Secondary high street with declining footfall"],
    mainRiskFlag: "Tertiary location — illiquid exit",
    insights: {
      mispricing: "Headline 12.9% yield masks a tertiary location and weak covenants.",
      couldGoWrong: "Realistic stabilised yield 8–9% after voids and bad debt — exit cap rate likely 11%+.",
      askAgent: "Last 24 months rent receipts, tenant arrears, and recent comparable sales in ST1.",
      negotiation: "Only attractive sub-£280k as a yield play with clear hold strategy and 60% LTV.",
    },
    scoreBreakdown: { incomeQuality: 78, tenantSecurity: 32, marketPricing: 62, upside: 48, riskExit: 35 },
    thumbnail: "from-orange-500/30 to-amber-700/20",
    postedAt: "2026-04-29T18:30:00Z",
  }),
  D({
    id: "ds-012",
    title: "Town Centre Development Site",
    location: "Norwich, NR1",
    region: "East",
    assetType: "Land",
    source: "Private treaty",
    guidePrice: 1_100_000,
    passingRent: 0,
    sqft: 22_000,
    grossYield: 0,
    netInitialYield: 0,
    reversionaryYield: 0,
    wault: 0,
    leaseLength: 0,
    tenant: "Vacant — development opportunity",
    covenantStrength: "Vacant",
    tenantHealthScore: 0,
    rentSustainability: "Market rent",
    rentReview: "None",
    pricePerSqft: 50,
    planningUpsideScore: 88,
    voidRiskScore: 60,
    exitYieldSensitivity: "Moderate",
    cashflowAfterDebt: -42_000,
    returnOnEquity: 0,
    redFlags: ["Pre-app only — no consent", "Conservation area constraints"],
    mainRiskFlag: "Planning unproven",
    insights: {
      mispricing: "Site value implies £24k per residential unit assuming 45 units — sub-residual at consent.",
      couldGoWrong: "Conservation area + heritage consultees → 18–24 month consent timeline.",
      askAgent: "Pre-app correspondence, ground conditions report, and any S106 indications.",
      negotiation: "Subject to planning offer at £950k with 12-month long-stop is the disciplined route.",
    },
    scoreBreakdown: { incomeQuality: 0, tenantSecurity: 0, marketPricing: 70, upside: 92, riskExit: 50 },
    thumbnail: "from-teal-500/30 to-emerald-700/20",
    postedAt: "2026-04-26T12:00:00Z",
  }),
  D({
    id: "ds-013",
    title: "Co-op Convenience Investment",
    location: "Cardiff, CF24",
    region: "Wales",
    assetType: "Convenience",
    source: "Private treaty",
    guidePrice: 1_640_000,
    passingRent: 102_000,
    sqft: 3_900,
    grossYield: 6.22,
    netInitialYield: 5.95,
    reversionaryYield: 6.3,
    wault: 9.4,
    leaseLength: 10,
    tenant: "Co-operative Group Food Ltd",
    covenantStrength: "Strong",
    tenantHealthScore: 88,
    rentSustainability: "Market rent",
    rentReview: "CPI/RPI linked",
    pricePerSqft: 421,
    planningUpsideScore: 30,
    voidRiskScore: 14,
    exitYieldSensitivity: "Low",
    cashflowAfterDebt: 22_100,
    returnOnEquity: 8.1,
    redFlags: [],
    mainRiskFlag: "Yield priced near cycle low",
    insights: {
      mispricing: "Co-op stock historically trades 25–40 bps inside Tesco at this lot size — pricing in line.",
      couldGoWrong: "If gilts retrace higher, cap rates drift +25 bps; £100k value erosion.",
      askAgent: "CPI cap, schedule of condition, recent Co-op store closures in region.",
      negotiation: "£1.59m gives you 6.4% gross and matches recent Newport comparable.",
    },
    scoreBreakdown: { incomeQuality: 78, tenantSecurity: 90, marketPricing: 78, upside: 50, riskExit: 84 },
    thumbnail: "from-emerald-500/30 to-cyan-700/20",
    postedAt: "2026-04-30T07:48:00Z",
  }),
  D({
    id: "ds-014",
    title: "City-fringe Office — Refurb Play",
    location: "Manchester, M4",
    region: "North West",
    assetType: "Office",
    source: "Off-market",
    guidePrice: 5_400_000,
    passingRent: 412_000,
    sqft: 28_000,
    grossYield: 7.63,
    netInitialYield: 7.0,
    reversionaryYield: 8.5,
    wault: 5.4,
    leaseLength: 7,
    tenant: "Tech occupier (post-Series B)",
    covenantStrength: "Moderate",
    tenantHealthScore: 64,
    rentSustainability: "Under-rented",
    rentReview: "Upward-only",
    pricePerSqft: 193,
    planningUpsideScore: 70,
    voidRiskScore: 36,
    exitYieldSensitivity: "Moderate",
    cashflowAfterDebt: 48_900,
    returnOnEquity: 11.6,
    redFlags: ["Tenant 18 months runway visibility", "EPC D — capex required by 2030"],
    mainRiskFlag: "Tenant covenant + capex",
    insights: {
      mispricing: "City-fringe Manchester pricing is 80 bps wide of pre-2022. Under-rented by ~15%.",
      couldGoWrong: "Tech tenant fail → office void in a softening regional market.",
      askAgent: "Latest tenant accounts, EPC remediation cost, and floor-by-floor letting evidence.",
      negotiation: "£5.20m to reflect £350k EPC capex and tenant risk discount.",
    },
    scoreBreakdown: { incomeQuality: 78, tenantSecurity: 60, marketPricing: 78, upside: 82, riskExit: 62 },
    thumbnail: "from-indigo-500/30 to-purple-700/20",
    postedAt: "2026-04-29T13:14:00Z",
  }),
  D({
    id: "ds-015",
    title: "Trade Counter — Screwfix Let",
    location: "Plymouth, PL4",
    region: "South West",
    assetType: "Industrial",
    source: "Private treaty",
    guidePrice: 1_780_000,
    passingRent: 118_500,
    sqft: 8_500,
    grossYield: 6.66,
    netInitialYield: 6.3,
    reversionaryYield: 6.9,
    wault: 8.2,
    leaseLength: 9,
    tenant: "Screwfix Direct Ltd",
    covenantStrength: "Strong",
    tenantHealthScore: 90,
    rentSustainability: "Market rent",
    rentReview: "Upward-only",
    pricePerSqft: 209,
    planningUpsideScore: 40,
    voidRiskScore: 12,
    exitYieldSensitivity: "Low",
    cashflowAfterDebt: 26_400,
    returnOnEquity: 9.0,
    redFlags: [],
    mainRiskFlag: "Limited reversion",
    insights: {
      mispricing: "Trade counter sector has firmed 50 bps in 12 months — pricing modestly behind the curve.",
      couldGoWrong: "Sector exposure to UK construction cycle.",
      askAgent: "Yard area, customer car parking, and last review settlement.",
      negotiation: "£1.72m is a sensible bid — 6.9% gross, well-let, and benchmark trade-counter yield.",
    },
    scoreBreakdown: { incomeQuality: 80, tenantSecurity: 92, marketPricing: 80, upside: 58, riskExit: 88 },
    thumbnail: "from-lime-500/30 to-emerald-700/20",
    postedAt: "2026-04-30T08:00:00Z",
  }),
  D({
    id: "ds-016",
    title: "Boots Pharmacy Investment",
    location: "Exeter, EX4",
    region: "South West",
    assetType: "Retail",
    source: "Private treaty",
    guidePrice: 2_100_000,
    passingRent: 145_000,
    sqft: 5_400,
    grossYield: 6.9,
    netInitialYield: 6.55,
    reversionaryYield: 6.95,
    wault: 7.6,
    leaseLength: 8,
    tenant: "Boots UK Ltd",
    covenantStrength: "Good",
    tenantHealthScore: 76,
    rentSustainability: "Market rent",
    rentReview: "Open market",
    pricePerSqft: 389,
    planningUpsideScore: 45,
    voidRiskScore: 22,
    exitYieldSensitivity: "Moderate",
    cashflowAfterDebt: 33_200,
    returnOnEquity: 9.4,
    redFlags: ["Boots store rationalisation programme ongoing"],
    mainRiskFlag: "Tenant store-closure risk",
    insights: {
      mispricing: "Yield 30 bps wide of healthcare comps — discount reflects Boots strategic review.",
      couldGoWrong: "If unit is on the closure list, void could exceed 12 months.",
      askAgent: "Whether store is in 5-year strategic plan, alternative use viability, and class E demand.",
      negotiation: "£2.0m reflects covenant tail risk; sensible bid until closure list confirmed.",
    },
    scoreBreakdown: { incomeQuality: 78, tenantSecurity: 72, marketPricing: 76, upside: 60, riskExit: 70 },
    thumbnail: "from-sky-500/30 to-blue-700/20",
    postedAt: "2026-04-29T17:00:00Z",
  }),
];

export const getDeal = (id: string) => DEALS.find((d) => d.id === id);

export const COMPARABLES: Record<string, { title: string; price: number; yield: number; date: string; location: string }[]> = {
  default: [
    { title: "Tesco Express", price: 2_050_000, yield: 5.85, date: "Mar 2026", location: "Leeds, LS6" },
    { title: "Co-op Food", price: 1_780_000, yield: 6.05, date: "Feb 2026", location: "York, YO1" },
    { title: "Sainsbury's Local", price: 2_350_000, yield: 5.7, date: "Jan 2026", location: "Harrogate, HG1" },
    { title: "M&S Foodhall", price: 4_120_000, yield: 5.4, date: "Dec 2025", location: "Sheffield, S11" },
  ],
};

export const REGIONS = ["All UK", "London", "South East", "South West", "East", "East Midlands", "West Midlands", "North West", "North East", "Yorkshire", "Wales", "Scotland"];
export const ASSET_TYPES: AssetType[] = ["Retail", "Office", "Industrial", "Leisure", "Mixed-use", "Land", "Healthcare", "Roadside", "Convenience"];
