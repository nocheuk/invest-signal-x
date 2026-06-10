import { describe, expect, it } from "vitest";
import {
  SOURCE_CONFIGS,
  extractConfiguredPaginationUrls,
  filterAcquisitionRows,
  parseMoney,
  scrapeConfiguredHtmlToImportRows,
} from "../../../scripts/lib/commercialSourceScraper.mjs";

const fixtures = {
  savills: `
    <article class="sv-property-card">
      <a class="sv-details__link" href="/property-detail/gb2285s376715"></a>
      <p class="sv-details__address2">Plot 6 Thurso Business Park, Thurso, KW14 7XW</p>
      <div class="sv-property-price__value"><span>£23,000</span></div>
      <div class="sv-property-price__size"><span>1,200 sq ft</span></div>
      <div class="sv-property-attribute__value">Development land</div>
      <div class="sv-key-features">Last remaining development plot</div>
    </article>
    <a rel="next" href="/list/commercial/property-for-sale/uk/page-2"></a>
  `,
  pugh: `
    <div class="group bg-primary">
      <a href="https://www.pugh-auctions.com/property/202601231232sq_gm55">
        <img src="https://example.com/property.jpg">
      </a>
      <div class="uppercase"><a href="https://www.pugh-auctions.com/property/202601231232sq_gm55">34 Derby Street, Ince, Wigan, Lancashire WN3 4TJ</a></div>
      <p><span>Guide Price: £85,000 plus</span></p>
    </div>
    <div class="group bg-primary">
      <a href="https://www.pugh-auctions.com/property/rent-only">Leasehold office to let</a>
      <div class="uppercase"><a href="https://www.pugh-auctions.com/property/rent-only">Office Suite, Leeds LS1</a></div>
      <p><span>Rent £18,000 per annum</span></p>
    </div>
  `,
  fisherGerman: `
    <div class="property-wrap">
      <a href="/commercial-property-sales/industrial-for-sale-worcester/50841">
        <h4 class="item-address commercial">
          <span class="streets">Industrial property for sale</span>
          <span class="street-location">The Steel Centre, Worcester, WR4 9FA</span>
        </h4>
      </a>
      <p class="item-price property__price commercial"><span class="price-qualifier">£4,250,000</span></p>
      <li class="detail-size">52656 sqft</li>
    </div>
  `,
  lsh: `
    <div class="property property--rectangle">
      <a href="/find/properties/kent/swanley/2066482">
        <img src="https://hive.agencypilot.com/crm/store/property/photo_web.jpg">
        <div class="property__content">
          <p class="bold caps">Office For Sale or For Rent</p>
          <p>Media House, Azalea Drive, Swanley BR8 8HU</p>
        </div>
      </a>
      <div class="price">Guide price £950,000</div>
    </div>
  `,
};

describe("configured commercial source scraper", () => {
  it("parses sale listings and rejects rent-only listings", () => {
    const rows = scrapeConfiguredHtmlToImportRows({
      html: fixtures.pugh,
      pageUrl: SOURCE_CONFIGS.pugh.defaultUrl,
      config: SOURCE_CONFIGS.pugh,
    });
    const filtered = filterAcquisitionRows(rows);

    expect(rows).toHaveLength(2);
    expect(filtered.importRows).toHaveLength(1);
    expect(filtered.importRows[0].normalized).toMatchObject({
      title: "34 Derby Street, Ince, Wigan, Lancashire WN3 4TJ",
      guidePrice: 85000,
      source: "Auction",
    });
    expect(filtered.skipped[0].reason).toBe("skipped_rent_only");
  });

  it("maps Savills, Fisher German and LSH fixtures to import rows", () => {
    const cases = [
      ["savills", fixtures.savills, 23000],
      ["fisherGerman", fixtures.fisherGerman, 4250000],
      ["lsh", fixtures.lsh, 950000],
    ] as const;

    for (const [key, html, guidePrice] of cases) {
      const rows = scrapeConfiguredHtmlToImportRows({
        html,
        pageUrl: SOURCE_CONFIGS[key].defaultUrl,
        config: SOURCE_CONFIGS[key],
      });
      expect(rows[0].normalized.guidePrice).toBe(guidePrice);
      expect(rows[0].validationErrors).toEqual([]);
    }
  });

  it("extracts conservative pagination links", () => {
    expect(extractConfiguredPaginationUrls({
      html: fixtures.savills,
      pageUrl: SOURCE_CONFIGS.savills.defaultUrl,
      config: SOURCE_CONFIGS.savills,
      maxPages: 2,
    })).toEqual(["https://search.savills.com/list/commercial/property-for-sale/uk/page-2"]);
  });

  it("does not parse nearby metadata as price", () => {
    expect(parseMoney("Guide Price: £350,000 lot 30203 1,200 sqft")).toBe(350000);
    expect(parseMoney("Rent £18,000 per annum")).toBe(18000);
    expect(parseMoney("POA")).toBeUndefined();
  });
});
