import { describe, expect, it } from "vitest";
import type { Deal } from "@/lib/deals";
import {
  ACUITUS_SOURCE,
  ALL_REAL_DEALS_FILTER,
  buildSourceOptions,
  DEMO_SOURCE_FILTER,
  filterAndSortDeals,
  IMPORTED_SOURCE_FILTER,
  NEEDS_REVIEW_FILTER,
  RIGHTMOVE_BOURNEMOUTH_SOURCE,
} from "@/lib/dashboardFilters";
import type { StrategyWeights } from "@/lib/strategy";

const weights: StrategyWeights = { yield: 50, growth: 50, discount: 50, risk: 50, demand: 50 };

function deal(overrides: Partial<Deal>): Deal {
  return {
    id: "ds-1",
    title: "Demo Tesco",
    location: "Sheffield, S10",
    region: "Yorkshire",
    assetType: "Retail",
    source: "Private treaty",
    guidePrice: 1000000,
    passingRent: 80000,
    sqft: 10000,
    grossYield: 8,
    netInitialYield: 7.4,
    reversionaryYield: 8,
    wault: 5,
    leaseLength: 5,
    tenant: "Tesco",
    covenantStrength: "Good",
    tenantHealthScore: 80,
    rentSustainability: "Market rent",
    rentReview: "None",
    pricePerSqft: 100,
    planningUpsideScore: 50,
    voidRiskScore: 20,
    exitYieldSensitivity: "Moderate",
    cashflowAfterDebt: 0,
    returnOnEquity: 0,
    redFlags: [],
    mainRiskFlag: "None",
    score: 75,
    rating: "amber",
    scoreBreakdown: { incomeQuality: 70, tenantSecurity: 80, marketPricing: 70, upside: 50, riskExit: 80 },
    insights: { mispricing: "", couldGoWrong: "", askAgent: "", negotiation: "" },
    thumbnail: "",
    postedAt: "2026-05-08T00:00:00Z",
    ...overrides,
  };
}

const imported = deal({
  id: "imp-bournemouth",
  title: "Rightmove Office",
  location: "Bournemouth, BH1",
  assetType: "Office",
  tenant: "Unknown",
  importSourceName: RIGHTMOVE_BOURNEMOUTH_SOURCE,
  isImported: true,
  needsReview: true,
  score: 39,
  rating: "red",
  netInitialYield: 0,
});

const acuitus = deal({
  id: "imp-acuitus",
  title: "Acuitus Auction Lot",
  location: "London, W1J 7EE",
  assetType: "Office",
  importSourceName: ACUITUS_SOURCE,
  isImported: true,
  needsReview: true,
  score: 39,
  rating: "red",
  netInitialYield: 0,
});

const demo = deal({ id: "ds-demo" });

describe("dashboard deal filters", () => {
  it("keeps imported deals visible by default", () => {
    const result = filterAndSortDeals([demo, imported], {
      region: "All UK",
      asset: "All",
      source: "All",
      rating: "all",
      minYield: 0,
      search: "",
      sort: "score",
    }, weights);

    expect(result.map((item) => item.id)).toContain("imp-bournemouth");
  });

  it("filters by imported and specific Rightmove source", () => {
    const allImported = filterAndSortDeals([demo, imported, acuitus], {
      region: "All UK",
      asset: "All",
      source: IMPORTED_SOURCE_FILTER,
      rating: "all",
      minYield: 0,
      search: "",
      sort: "score",
    }, weights);
    const rightmove = filterAndSortDeals([demo, imported], {
      region: "All UK",
      asset: "All",
      source: RIGHTMOVE_BOURNEMOUTH_SOURCE,
      rating: "all",
      minYield: 0,
      search: "",
      sort: "score",
    }, weights);

    expect(allImported.map((item) => item.id)).toEqual(["imp-bournemouth", "imp-acuitus"]);
    expect(rightmove.map((item) => item.id)).toEqual(["imp-bournemouth"]);
    expect(buildSourceOptions([demo, imported])).toContain(RIGHTMOVE_BOURNEMOUTH_SOURCE);
  });

  it("hides seed/demo deals from the all real deals filter while demo mode can still show them", () => {
    const allReal = filterAndSortDeals([demo, imported], {
      region: "All UK",
      asset: "All",
      source: ALL_REAL_DEALS_FILTER,
      rating: "all",
      minYield: 0,
      search: "",
      sort: "score",
    }, weights);
    const demoOnly = filterAndSortDeals([demo, imported], {
      region: "All UK",
      asset: "All",
      source: DEMO_SOURCE_FILTER,
      rating: "all",
      minYield: 0,
      search: "",
      sort: "score",
    }, weights);

    expect(allReal.map((item) => item.id)).toEqual(["imp-bournemouth"]);
    expect(demoOnly.map((item) => item.id)).toEqual(["ds-demo"]);
  });

  it("filters imported Acuitus and needs-review deals", () => {
    const sourceResult = filterAndSortDeals([demo, imported, acuitus], {
      region: "All UK",
      asset: "All",
      source: ACUITUS_SOURCE,
      rating: "all",
      minYield: 0,
      search: "",
      sort: "score",
    }, weights);
    const reviewResult = filterAndSortDeals([demo, imported, acuitus], {
      region: "All UK",
      asset: "All",
      source: NEEDS_REVIEW_FILTER,
      rating: "all",
      minYield: 0,
      search: "",
      sort: "score",
    }, weights);

    expect(sourceResult.map((item) => item.id)).toEqual(["imp-acuitus"]);
    expect(reviewResult.map((item) => item.id)).toEqual(["imp-bournemouth", "imp-acuitus"]);
  });

  it("searches imported and demo deals across title, location, postcode, asset, tenant, and source", () => {
    const base = { region: "All UK", asset: "All", source: "All", rating: "all" as const, minYield: 0, sort: "score" as const };

    expect(filterAndSortDeals([demo, imported], { ...base, search: "bournemouth" }, weights).map((item) => item.id)).toEqual(["imp-bournemouth"]);
    expect(filterAndSortDeals([demo, imported], { ...base, search: "BH1" }, weights).map((item) => item.id)).toEqual(["imp-bournemouth"]);
    expect(filterAndSortDeals([demo, imported], { ...base, search: "office" }, weights).map((item) => item.id)).toEqual(["imp-bournemouth"]);
    expect(filterAndSortDeals([demo, imported], { ...base, search: "tesco" }, weights).map((item) => item.id)).toEqual(["ds-demo"]);
    expect(filterAndSortDeals([demo, imported], { ...base, search: "Rightmove Commercial Bournemouth" }, weights).map((item) => item.id)).toEqual(["imp-bournemouth"]);
  });
});
