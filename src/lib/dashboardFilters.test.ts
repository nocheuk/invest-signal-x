import { describe, expect, it } from "vitest";
import type { Deal } from "@/lib/deals";
import {
  ACUITUS_SOURCE,
  ALL_REAL_DEALS_FILTER,
  buildSourceOptions,
  DEMO_SOURCE_FILTER,
  EDDISONS_SOURCE,
  filterAndSortDeals,
  IMPORTED_SOURCE_FILTER,
  REQUIRES_DUE_DILIGENCE_FILTER,
  RIGHTMOVE_COMMERCIAL_SOURCE,
  sourceLabel,
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
  importSourceName: "Rightmove Bournemouth Commercial Custom",
  importSourceType: "custom_rightmove_commercial",
  isImported: true,
  needsReview: true,
  dataConfidenceScore: 38,
  confidenceLevel: "low",
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
  needsReview: false,
  dataConfidenceScore: 82,
  confidenceLevel: "high",
  score: 65,
  rating: "amber",
  passingRent: 62000,
  netInitialYield: 6.2,
  sourceUrl: "https://example.com/acuitus",
});

const eddisons = deal({
  id: "imp-eddisons",
  title: "Eddisons Freehold Retail",
  location: "Leeds, LS1 4AP",
  assetType: "Retail",
  importSourceName: EDDISONS_SOURCE,
  isImported: true,
  needsReview: true,
  dataConfidenceScore: 75,
  confidenceLevel: "medium",
  score: 64,
  rating: "amber",
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
      confidence: "all",
      minYield: 0,
      maxPrice: 0,
      search: "",
      locationQuery: "",
      sort: "score",
    }, weights);

    expect(result.map((item) => item.id)).toContain("imp-bournemouth");
  });

  it("filters by imported and normalized Rightmove source", () => {
    const allImported = filterAndSortDeals([demo, imported, acuitus], {
      region: "All UK",
      asset: "All",
      source: IMPORTED_SOURCE_FILTER,
      rating: "all",
      confidence: "all",
      minYield: 0,
      maxPrice: 0,
      search: "",
      locationQuery: "",
      sort: "score",
    }, weights);
    const rightmove = filterAndSortDeals([demo, imported], {
      region: "All UK",
      asset: "All",
      source: RIGHTMOVE_COMMERCIAL_SOURCE,
      rating: "all",
      confidence: "all",
      minYield: 0,
      maxPrice: 0,
      search: "",
      locationQuery: "",
      sort: "score",
    }, weights);

    expect(allImported.map((item) => item.id)).toEqual(["imp-acuitus", "imp-bournemouth"]);
    expect(rightmove.map((item) => item.id)).toEqual(["imp-bournemouth"]);
    expect(buildSourceOptions([demo, imported])).toContain(RIGHTMOVE_COMMERCIAL_SOURCE);
    expect(buildSourceOptions([demo, imported])).toContain(EDDISONS_SOURCE);
    expect(buildSourceOptions([demo, imported])).not.toContain("Rightmove Bournemouth Commercial Custom");
  });

  it("hides seed/demo deals from the all real deals filter while demo mode can still show them", () => {
    const allReal = filterAndSortDeals([demo, imported], {
      region: "All UK",
      asset: "All",
      source: ALL_REAL_DEALS_FILTER,
      rating: "all",
      confidence: "all",
      minYield: 0,
      maxPrice: 0,
      search: "",
      locationQuery: "",
      sort: "score",
    }, weights);
    const demoOnly = filterAndSortDeals([demo, imported], {
      region: "All UK",
      asset: "All",
      source: DEMO_SOURCE_FILTER,
      rating: "all",
      confidence: "all",
      minYield: 0,
      maxPrice: 0,
      search: "",
      locationQuery: "",
      sort: "score",
    }, weights);

    expect(allReal.map((item) => item.id)).toEqual(["imp-bournemouth"]);
    expect(demoOnly.map((item) => item.id)).toEqual(["ds-demo"]);
  });

  it("uses the all real deals filter as the national default without narrowing by location", () => {
    const manchester = deal({
      id: "imp-manchester",
      title: "Manchester office",
      location: "Manchester, M4",
      importSourceName: RIGHTMOVE_COMMERCIAL_SOURCE,
      isImported: true,
    });
    const southampton = deal({
      id: "imp-southampton",
      title: "Southampton retail",
      location: "Southampton, SO14",
      importSourceName: RIGHTMOVE_COMMERCIAL_SOURCE,
      isImported: true,
    });

    const result = filterAndSortDeals([demo, manchester, southampton], {
      region: "All UK",
      asset: "All",
      source: ALL_REAL_DEALS_FILTER,
      rating: "all",
      confidence: "all",
      minYield: 0,
      maxPrice: 0,
      search: "",
      locationQuery: "",
      sort: "score",
    }, weights);

    expect(result.map((item) => item.id)).toEqual(["imp-manchester", "imp-southampton"]);
  });

  it("filters imported Acuitus and requires-due-diligence deals", () => {
    const sourceResult = filterAndSortDeals([demo, imported, acuitus], {
      region: "All UK",
      asset: "All",
      source: ACUITUS_SOURCE,
      rating: "all",
      confidence: "all",
      minYield: 0,
      maxPrice: 0,
      search: "",
      locationQuery: "",
      sort: "score",
    }, weights);
    const reviewResult = filterAndSortDeals([demo, imported, acuitus], {
      region: "All UK",
      asset: "All",
      source: REQUIRES_DUE_DILIGENCE_FILTER,
      rating: "all",
      confidence: "all",
      minYield: 0,
      maxPrice: 0,
      search: "",
      locationQuery: "",
      sort: "score",
    }, weights);

    expect(sourceResult.map((item) => item.id)).toEqual(["imp-acuitus"]);
    expect(reviewResult.map((item) => item.id)).toEqual(["imp-acuitus"]);
  });

  it("normalizes and filters Eddisons source labels", () => {
    expect(sourceLabel(eddisons)).toBe(EDDISONS_SOURCE);
    expect(filterAndSortDeals([demo, imported, eddisons], {
      region: "All UK",
      asset: "All",
      source: EDDISONS_SOURCE,
      rating: "all",
      confidence: "all",
      minYield: 0,
      maxPrice: 0,
      search: "",
      locationQuery: "",
      sort: "score",
    }, weights).map((item) => item.id)).toEqual(["imp-eddisons"]);
  });

  it("searches imported and demo deals across title, location, postcode, asset, tenant, and source", () => {
    const base = { region: "All UK", asset: "All", source: "All", rating: "all" as const, confidence: "all" as const, minYield: 0, maxPrice: 0, locationQuery: "", sort: "score" as const };

    expect(filterAndSortDeals([demo, imported], { ...base, search: "bournemouth" }, weights).map((item) => item.id)).toEqual(["imp-bournemouth"]);
    expect(filterAndSortDeals([demo, imported], { ...base, search: "BH1" }, weights).map((item) => item.id)).toEqual(["imp-bournemouth"]);
    expect(filterAndSortDeals([demo, imported], { ...base, search: "office" }, weights).map((item) => item.id)).toEqual(["imp-bournemouth"]);
    expect(filterAndSortDeals([demo, imported], { ...base, search: "tesco" }, weights).map((item) => item.id)).toEqual(["ds-demo"]);
    expect(filterAndSortDeals([demo, imported], { ...base, search: "Rightmove Commercial" }, weights).map((item) => item.id)).toEqual(["imp-bournemouth"]);
  });

  it("filters and sorts by confidence", () => {
    const base = { region: "All UK", asset: "All", source: "All", rating: "all" as const, minYield: 0, maxPrice: 0, search: "", locationQuery: "" };

    expect(filterAndSortDeals([imported, acuitus], { ...base, confidence: "high", sort: "score" }, weights).map((item) => item.id)).toEqual(["imp-acuitus"]);
    expect(filterAndSortDeals([imported, acuitus], { ...base, confidence: "all", sort: "confidence" }, weights).map((item) => item.id)).toEqual(["imp-acuitus", "imp-bournemouth"]);
  });

  it("filters Strong Opportunities separately from Top Opportunities", () => {
    const candidate = deal({
      id: "imp-candidate",
      score: 73,
      rating: "amber",
      dataConfidenceScore: 85,
      guidePrice: 700000,
      netInitialYield: 8.25,
      passingRent: 62100,
      isImported: true,
      importSourceName: RIGHTMOVE_COMMERCIAL_SOURCE,
    });
    const verified = deal({
      id: "imp-verified",
      score: 82,
      rating: "green",
      dataConfidenceScore: 85,
      isImported: true,
      importSourceName: RIGHTMOVE_COMMERCIAL_SOURCE,
    });
    const base = { region: "All UK", asset: "All", source: "All", confidence: "all" as const, minYield: 0, maxPrice: 0, search: "", locationQuery: "", sort: "score" as const };

    expect(filterAndSortDeals([candidate, verified], { ...base, rating: "green-candidate" }, weights).map((item) => item.id)).toEqual(["imp-candidate"]);
    expect(filterAndSortDeals([candidate, verified], { ...base, rating: "verified-green" }, weights).map((item) => item.id)).toEqual(["imp-verified"]);
  });

  it("filters by dedicated location query across town, postcode, region, and title", () => {
    const poole = deal({
      id: "imp-poole",
      title: "Dorset industrial unit",
      location: "Poole, BH15",
      region: "Dorset",
      importSourceName: "Rightmove Poole Commercial Custom",
      importSourceType: "custom_rightmove_commercial",
      isImported: true,
    });
    const base = { region: "All UK", asset: "All", source: "All", rating: "all" as const, confidence: "all" as const, minYield: 0, maxPrice: 0, search: "", sort: "score" as const };

    expect(filterAndSortDeals([demo, imported, poole], { ...base, locationQuery: "Bournemouth" }, weights).map((item) => item.id)).toEqual(["imp-bournemouth"]);
    expect(filterAndSortDeals([demo, imported, poole], { ...base, locationQuery: "BH15" }, weights).map((item) => item.id)).toEqual(["imp-poole"]);
    expect(filterAndSortDeals([demo, imported, poole], { ...base, locationQuery: "Dorset" }, weights).map((item) => item.id)).toEqual(["imp-poole"]);
    expect(filterAndSortDeals([demo, imported, poole], { ...base, locationQuery: "Southampton" }, weights)).toEqual([]);
  });

  it("displays all Rightmove custom source names as Rightmove Commercial", () => {
    const poole = deal({
      id: "imp-poole",
      location: "Poole, BH15",
      importSourceName: "Rightmove Poole Commercial Custom",
      importSourceType: "custom_rightmove_commercial",
      isImported: true,
    });

    expect(sourceLabel(imported)).toBe(RIGHTMOVE_COMMERCIAL_SOURCE);
    expect(sourceLabel(poole)).toBe(RIGHTMOVE_COMMERCIAL_SOURCE);
  });
});
