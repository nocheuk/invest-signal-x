import { describe, expect, it } from "vitest";
import {
  ALLSOP_COMMERCIAL_SEARCH_URL,
  allPagesFromPayload,
  filterAllsopAcquisitionRows,
  scrapeAllsopPayloadToImportRows,
  withAllsopPage,
} from "../../../scripts/lib/allsopScraper.mjs";

const fixture = {
  data: {
    total: 3,
    results: [
      {
        property_id: "prop-1",
        reference: "CI00436",
        allsop_address: "265 Water Road, Wembley, Greater London, HA0 1HX",
        town: "Wembley",
        postcode: "HA0 1HX",
        region: ["LDN"],
        commercial_property_types: ["Industrial"],
        property_types: ["Industrial"],
        image_file_id: "01a61b3e-5f57-11f1-a4cd-0242ac110002",
        main_byline: "Rare Opportunity to Acquire an Ultra Urban Industrial Sale and Leaseback",
        price_description: "Offers in Excess Of",
        sales_status: "For Sale",
        sales_status_websearch: "For Sale",
        market_from_date: "2026-06-03 00:00:00",
        price: "4500000.00",
        sort_price: 4500000,
        department: "COMM",
        investment_summary_editor: JSON.stringify({
          blocks: [
            { text: "The property comprises an industrial unit providing 13,784 sq ft GIA" },
            { text: "The property will be let to Sapna Caterers Limited on a 10 year lease" },
            { text: "Proposed passing rent of \u00a3312,000 per annum reflecting 6.93%" },
          ],
        }),
      },
      {
        property_id: "prop-2",
        reference: "CI00431",
        allsop_address: "Retail Parade, Kettering, NN16 8JA",
        town: "Kettering",
        postcode: "NN16 8JA",
        commercial_property_types: ["Retail"],
        main_byline: "Freehold Retail Investment",
        price_description: "Refer to Auctioneer",
        sales_status: "For Sale",
        price: null,
        department: "COMM",
      },
      {
        property_id: "prop-3",
        reference: "RI00908",
        allsop_address: "Residential Block, Brighton, BN1 3UP",
        town: "Brighton",
        postcode: "BN1 3UP",
        commercial_property_types: [],
        property_types: ["Flats/Houses"],
        main_byline: "Freehold Residential Investment Opportunity",
        price: "15000000.00",
        department: "RES",
      },
    ],
  },
};

describe("Allsop scraper", () => {
  it("maps commercial auction lots into normalized import rows", () => {
    const rows = scrapeAllsopPayloadToImportRows({
      payload: fixture,
      pageUrl: ALLSOP_COMMERCIAL_SEARCH_URL,
    });

    expect(rows[0].raw).toMatchObject({
      reference: "CI00436",
      listing_intent: "sale",
      passing_rent: 312000,
      yield: 6.93,
    });
    expect(rows[0].normalized).toMatchObject({
      externalId: "CI00436",
      title: "Rare Opportunity to Acquire an Ultra Urban Industrial Sale and Leaseback",
      location: "265 Water Road, Wembley, Greater London, HA0 1HX",
      postcode: "HA0 1HX",
      assetType: "Industrial",
      source: "Auction",
      guidePrice: 4500000,
      passingRent: 312000,
      netInitialYield: 6.93,
      sqft: 13784,
      imageUrl: "https://www.allsop.co.uk/api/image/01a61b3e-5f57-11f1-a4cd-0242ac110002/703/527",
      sourceUrl: "https://www.allsop.co.uk/investment-overview/rare-opportunity-to-acquire-an-ultra-urban-industrial-sale-and-leaseback-in-wembley/ci00436",
    });
    expect(rows[0].validationErrors).toEqual([]);
  });

  it("imports sale lots while skipping POA and non-commercial rows", () => {
    const rows = scrapeAllsopPayloadToImportRows({ payload: fixture, pageUrl: ALLSOP_COMMERCIAL_SEARCH_URL });
    const result = filterAllsopAcquisitionRows(rows);

    expect(result.importRows).toHaveLength(1);
    expect(result.importRows[0].normalized.title).toContain("Ultra Urban Industrial");
    expect(result.skipped.map((item) => item.reason)).toEqual(["skipped_poa", "skipped_non_commercial"]);
  });

  it("keeps missing-price sale rows as validation failures instead of pretending they are importable", () => {
    const rows = scrapeAllsopPayloadToImportRows({
      payload: {
        data: {
          total: 1,
          results: [{
            property_id: "prop-missing",
            reference: "CI99999",
            allsop_address: "Vacant Shop, York, YO1 7AA",
            town: "York",
            commercial_property_types: ["Retail"],
            main_byline: "Freehold Retail Opportunity",
            sales_status: "For Sale",
            price: null,
            department: "COMM",
          }],
        },
      },
      pageUrl: ALLSOP_COMMERCIAL_SEARCH_URL,
    });
    const result = filterAllsopAcquisitionRows(rows);

    expect(result.importRows).toHaveLength(1);
    expect(result.importRows[0].validationErrors).toContain("guide_price must be greater than 0");
  });

  it("builds conservative paginated Allsop API URLs", () => {
    expect(withAllsopPage(ALLSOP_COMMERCIAL_SEARCH_URL, 2)).toBe("https://www.allsop.co.uk/api/property-search?available_only=true&lot_type=commercial&size=100&page=2");
    expect(allPagesFromPayload({ data: { total: 250, results: Array.from({ length: 100 }) } }, 2)).toEqual([1, 2]);
  });
});
