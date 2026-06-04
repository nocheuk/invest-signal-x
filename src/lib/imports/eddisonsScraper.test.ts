import { describe, expect, it } from "vitest";
import {
  EDDISONS_SALE_LISTINGS_URL,
  extractEddisonsPaginationUrls,
  filterEddisonsSaleRows,
  scrapeEddisonsHtmlToImportRows,
} from "../../../scripts/lib/eddisonsScraper.mjs";

const fixture = `
  <div data-listings>
    <div class="group property-card border-brand-grey-light relative">
      <a aria-label="Freehold Retail Investment, Leeds, LS1 4AP" href="/property-search/freehold-retail-investment-leeds-ls1-4ap" class="absolute inset-0"></a>
      <img class="img-property-card" src="/images/listings/leeds.jpg" />
      <span class="listing-type">Retail</span>
      <div class="text-btg-blue">Freehold Retail Investment, Leeds, LS1 4AP</div>
      <div class="text-btg-blue">4,200 Sq Ft</div>
      <div class="text-btg-blue">£850,000 offers in excess of</div>
      <div class="text-btg-blue">£72,000 per annum exclusive</div>
    </div>
    <div class="group property-card border-brand-grey-light relative">
      <a aria-label="Leasehold Office Suite, Lincoln, LN2 4RF" href="/property-search/leasehold-office-suite-lincoln-ln2-4rf" class="absolute inset-0"></a>
      <img class="img-property-card" src="/images/listings/lincoln.jpg" />
      <span class="listing-type">Office</span>
      <div class="text-btg-blue">Leasehold Office Suite, Lincoln, LN2 4RF</div>
      <div class="text-btg-blue">£850.00 PCM</div>
    </div>
    <div class="group property-card border-brand-grey-light relative">
      <a aria-label="Office Building, Milton Keynes, MK8" href="/property-search/office-building-milton-keynes-mk8" class="absolute inset-0"></a>
      <img class="img-property-card" src="/images/listings/milton-keynes.jpg" />
      <span class="listing-type">Office</span>
      <div class="text-btg-blue">Office Building, Milton Keynes, MK8</div>
      <div class="text-btg-blue">On application</div>
    </div>
  </div>
  <div data-pagination>
    <a href="https://www.eddisons.com/property-search?purchase-type-id=for-sale&limit=24&page=2">2</a>
    <a href="https://www.eddisons.com/property-search?purchase-type-id=for-sale&limit=24&page=3">3</a>
  </div>
`;

describe("Eddisons scraper", () => {
  it("maps sale listings into normalized import rows", () => {
    const rows = scrapeEddisonsHtmlToImportRows({
      html: fixture,
      pageUrl: EDDISONS_SALE_LISTINGS_URL,
    });

    expect(rows[0].raw).toMatchObject({
      listing_intent: "sale",
      guide_price: "£850,000 offers in excess of",
      passing_rent: "£72,000 per annum exclusive",
    });
    expect(rows[0].normalized).toMatchObject({
      title: "Freehold Retail Investment, Leeds, LS1 4AP",
      location: "Freehold Retail Investment, Leeds, LS1 4AP",
      postcode: "LS1 4AP",
      assetType: "Retail",
      guidePrice: 850000,
      passingRent: 72000,
      sqft: 4200,
      imageUrl: "https://www.eddisons.com/images/listings/leeds.jpg",
      sourceUrl: "https://www.eddisons.com/property-search/freehold-retail-investment-leeds-ls1-4ap",
    });
    expect(rows[0].validationErrors).toEqual([]);
  });

  it("skips rent-only and POA rows before import", () => {
    const rows = scrapeEddisonsHtmlToImportRows({
      html: fixture,
      pageUrl: EDDISONS_SALE_LISTINGS_URL,
    });
    const result = filterEddisonsSaleRows(rows);

    expect(result.importRows).toHaveLength(1);
    expect(result.importRows[0].normalized.title).toContain("Freehold Retail Investment");
    expect(result.skipped.map((item) => item.reason)).toEqual(["skipped_rent_only", "skipped_poa"]);
  });

  it("discovers conservative sale pagination URLs", () => {
    expect(extractEddisonsPaginationUrls({
      html: fixture,
      pageUrl: EDDISONS_SALE_LISTINGS_URL,
      maxPages: 2,
    })).toEqual(["https://www.eddisons.com/property-search?purchase-type-id=for-sale&limit=24&page=2"]);
  });
});
