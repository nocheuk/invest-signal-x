import { describe, expect, it } from "vitest";
import { buildInvestmentDataRepair } from "../../../scripts/lib/investmentDataBackfill.mjs";
import { extractInvestmentFacts } from "../../../scripts/lib/investmentDataExtraction.mjs";

const asdaRawPayload = {
  rent: "£894,657 pa",
  price: "£4,250,000Guide Price35,807 sq. ft.",
  title: "Asda Stores Ltd, St Nicholas Gate Retail Park, London Road, Carlisle, Cumberland",
  rawText:
    "1/6£4,250,000Guide Price35,807 sq. ft.Asda Stores Ltd, St Nicholas Gate Retail Park, London Road, Carlisle, CumberlandLong Let Asda Superstore Investment-FOR SALE BY AUCTION 11TH JUNE 2026ShopFOR SALE BY AUCTION 11TH JUNE 2026Let to ASDA Stores Ltd until May 2038 (no breaks)Fixed rental increases to £894,657 pa in 2028 and £1,037,175 pa in 2033Marketed by Acuitus Limited, AcuitusCall020 7870 2773Local call rateSave",
  imageUrl: "https://media.rightmove.co.uk/property.jpeg",
  sizeSqFt: "35,807 sq. ft.",
  guidePrice: 4250000,
  propertyId: "753657524708977",
  description: "Long Let Asda Superstore Investment-FOR SALE BY AUCTION 11TH JUNE 2026",
  propertyUrl: "https://www.rightmove.co.uk/properties/753657524708977#/?channel=COM_BUY",
  source_name: "Rightmove Commercial",
  propertyType: "Land",
  listingIntent: "mixed",
  displayAddress: "Asda Stores Ltd, St Nicholas Gate Retail Park, London Road, Carlisle, Cumberland",
};

const asdaNormalizedPayload = {
  sqft: 35807,
  title: "Asda Stores Ltd, St Nicholas Gate Retail Park, London Road, Carlisle, Cumberland",
  region: "All UK",
  source: "Private treaty",
  tenant: "Unknown",
  imageUrl: "https://media.rightmove.co.uk/property.jpeg",
  location: "Asda Stores Ltd, St Nicholas Gate Retail Park, London Road, Carlisle, Cumberland",
  assetType: "Land",
  sourceUrl: "https://www.rightmove.co.uk/properties/753657524708977#/?channel=COM_BUY",
  externalId: "753657524708977",
  guidePrice: 4250000,
  description: "Long Let Asda Superstore Investment-FOR SALE BY AUCTION 11TH JUNE 2026",
  passingRent: 894657,
  mainRiskFlag: "Rightmove custom scraper import awaiting analyst review",
  covenantStrength: "Moderate",
};

const asdaDeal = {
  id: "imp-10a4m7",
  title: "Asda Stores Ltd, St Nicholas Gate Retail Park, London Road, Carlisle, Cumberland",
  location: "Asda Stores Ltd, St Nicholas Gate Retail Park, London Road, Carlisle, Cumberland",
  postcode: null,
  region: "All UK",
  asset_type: "Land",
  source: "Private treaty",
  guide_price: 4250000,
  passing_rent: 894657,
  sqft: 35807,
  gross_yield: 21.05075294117647,
  net_initial_yield: 19.577200235294118,
  reversionary_yield: 19.577200235294118,
  wault: 0,
  lease_length: 0,
  tenant: "Unknown",
  covenant_strength: "Moderate",
  tenant_health_score: 60,
  rent_sustainability: "Market rent",
  rent_review: "None",
  price_per_sqft: 119,
  planning_upside_score: 40,
  void_risk_score: 40,
  exit_yield_sensitivity: "Moderate",
  cashflow_after_debt: 0,
  return_on_equity: 0,
  auction_guide_risk: null,
  red_flags: ["Tenant unknown", "Lease information missing"],
  main_risk_flag: "Rightmove custom scraper import awaiting analyst review",
  posted_at: "2026-06-06T05:39:15.456Z",
  thumbnail: "https://media.rightmove.co.uk/property.jpeg",
  score: 69,
  rating: "amber",
};

describe("investment data backfill", () => {
  it("extracts ASDA tenant and lease from the real Rightmove card payload", () => {
    const facts = extractInvestmentFacts({
      title: asdaDeal.title,
      payload: asdaRawPayload,
      description: JSON.stringify(asdaNormalizedPayload),
      now: new Date("2026-06-11T00:00:00Z"),
    });

    expect(facts.tenantName).toBe("ASDA Stores Ltd");
    expect(facts.leaseExpiryText).toBe("May 2038");
    expect(facts.leaseLength).toBeGreaterThan(11);
    expect(facts.rentReviewDates).toEqual([2028, 2033]);
    expect(facts.rentReviewAmounts).toEqual([894657, 1037175]);
    expect(facts.passingRent).toBeUndefined();
  });

  it("repairs the deal using detail-page passing rent without keeping the 2028 review amount", () => {
    const rawFacts = extractInvestmentFacts({
      title: asdaDeal.title,
      payload: asdaRawPayload,
      description: JSON.stringify(asdaNormalizedPayload),
      now: new Date("2026-06-11T00:00:00Z"),
    });
    const repair = buildInvestmentDataRepair({
      candidate: {
        deal: asdaDeal,
        rawImport: { id: "raw-1", external_id: "753657524708977", normalized_payload: asdaNormalizedPayload, payload: asdaRawPayload },
        sourceUrl: asdaNormalizedPayload.sourceUrl,
        sourceName: "Rightmove Commercial",
      },
      facts: { ...rawFacts, passingRent: 771722 },
      detailEnrichment: {
        investmentSummary: "Gross Rental Income of £771,722 per Annum.",
        extractedPayload: {
          leaseExpiryText: "May 2038",
          leaseExpiryDate: "2038-05-31T00:00:00.000Z",
          rentReviews: [
            { year: 2028, amount: 894657 },
            { year: 2033, amount: 1037175 },
          ],
          rentReviewDates: [2028, 2033],
          rentReviewAmounts: [894657, 1037175],
          covenantStrength: "Strong",
          covenantVerified: true,
        },
      },
      now: new Date("2026-06-11T00:00:00Z"),
    });

    expect(repair.dealUpdate.tenant).toBe("ASDA Stores Ltd");
    expect(repair.dealUpdate.passing_rent).toBe(771722);
    expect(repair.dealUpdate.passing_rent).not.toBe(894657);
    expect(repair.dealUpdate.lease_length).toBeGreaterThan(11);
    expect(repair.dealUpdate.wault).toBeGreaterThan(11);
    expect(repair.dealUpdate.covenant_strength).toBe("Strong");
    expect(repair.dealUpdate.rent_review).toBe("Fixed uplift");
    expect(repair.dealUpdate.red_flags.join(" ")).not.toMatch(/tenant unknown|lease information missing|tenant covenant unknown/i);
  });
});
