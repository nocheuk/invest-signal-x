import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { dedupeImportRows } from "@/lib/imports/dealImport";
import {
  extractRightmovePaginationUrls,
  filterRightmoveAcquisitionRows,
  parseRightmoveCommercialListings,
  RIGHTMOVE_PARSE_ERROR,
  scrapeRightmoveCommercialHtmlToImportRows,
} from "../../../scripts/lib/rightmoveCommercialScraper.mjs";
import { dedupeRightmoveRows } from "../../../scripts/scrape-rightmove.mjs";

const fixture = fs.readFileSync(path.resolve("test/fixtures/rightmove-commercial-search.html"), "utf8");
const pageUrl = "https://www.rightmove.co.uk/commercial-property-for-sale/Bournemouth.html";

describe("custom Rightmove Commercial HTML scraper", () => {
  it("parses valid listing cards into normalized import rows", () => {
    const rows = scrapeRightmoveCommercialHtmlToImportRows({ html: fixture, pageUrl, sourceName: "Rightmove Custom" });

    expect(rows).toHaveLength(3);
    expect(rows[0].normalized).toMatchObject({
      externalId: "148450001",
      sourceUrl: "https://www.rightmove.co.uk/properties/148450001#/?channel=COM_BUY",
      title: "Trade Counter Investment",
      location: "Leeds, LS11",
      postcode: "LS11",
      guidePrice: 1750000,
      passingRent: 118000,
      sqft: 8500,
      assetType: "Industrial",
      source: "Private treaty",
    });
    expect(rows[0].validationErrors).toEqual([]);
  });

  it("surfaces missing price through normal validation", () => {
    const rows = scrapeRightmoveCommercialHtmlToImportRows({ html: fixture, pageUrl });
    const missingPrice = rows.find((row) => row.normalized.externalId === "148450003");

    expect(missingPrice?.normalized.title).toBe("Dorset commercial unit");
    expect(missingPrice?.validationErrors).toContain("guide_price must be greater than 0");
  });

  it("extracts image URLs and normalizes relative image paths", () => {
    const rows = scrapeRightmoveCommercialHtmlToImportRows({ html: fixture, pageUrl });

    expect(rows[0].normalized.imageUrl).toBe("https://media.rightmove.co.uk/dir/crop/10:9-16:9/148450001.jpg");
    expect(rows[1].normalized.imageUrl).toBe("https://www.rightmove.co.uk/images/office.jpg");
  });

  it("does not use carousel counters as listing titles", () => {
    const rows = scrapeRightmoveCommercialHtmlToImportRows({
      html: pageWithCard(`
        <div data-testid="propertyCard-vrt-0" class="propertyCard-details">
          <a data-testid="property-details-lozenge" href="/properties/148450009#/?channel=COM_BUY">
            <img src="https://media.rightmove.co.uk/assets/hash/_next/static/media/camera-white.579a6efc.svg" alt="camera icon">
            1/11
          </a>
          <a class="propertyCard-link" href="/properties/148450009#/?channel=COM_BUY">447-457 Wimborne Road, Bournemouth, BH9</a>
          <div data-testid="property-price">\u00a32,650,000 Guide Price</div>
          <p data-testid="property-description">Substantial freehold retail investment for sale by auction.</p>
        </div>
      `),
      pageUrl,
    });

    expect(rows[0].normalized.title).toBe("447-457 Wimborne Road, Bournemouth, BH9");
    expect(rows[0].normalized.title).not.toMatch(/^\d+\/\d+$/);
  });

  it("ignores placeholder/icon/logo images and extracts the first real property photo", () => {
    const rows = scrapeRightmoveCommercialHtmlToImportRows({
      html: pageWithCard(`
        <div data-testid="propertyCard-vrt-1" class="propertyCard-details">
          <a href="/properties/148450010#/?channel=COM_BUY">1/17</a>
          <img src="https://media.rightmove.co.uk/assets/hash/_next/static/media/camera-white.579a6efc.svg" alt="camera icon">
          <img src="https://media.rightmove.co.uk/partner-logo/agent-logo.jpeg" alt="Agent Logo">
          <img data-testid="property-img-1" src="https://media.rightmove.co.uk:443/dir/crop/10:9-16:9/property-photo/abc/148450010/real_photo_max_476x317.jpeg" alt="Property Image 1">
          <a class="propertyCard-link" href="/properties/148450010#/?channel=COM_BUY">Bournemouth Retail Investment, BH1</a>
          <div data-testid="property-price">Guide Price \u00a3500,000</div>
        </div>
      `),
      pageUrl,
    });

    expect(rows[0].normalized.imageUrl).toBe("https://media.rightmove.co.uk/dir/crop/10:9-16:9/property-photo/abc/148450010/real_photo_max_476x317.jpeg");
  });

  it("normalizes listing URLs and removes duplicate property IDs", () => {
    const listings = parseRightmoveCommercialListings({ html: fixture, pageUrl });
    const rows = scrapeRightmoveCommercialHtmlToImportRows({ html: fixture, pageUrl });
    const deduped = dedupeImportRows(rows);

    expect(listings.map((listing) => listing.propertyId)).toEqual(["148450001", "148450002", "148450003"]);
    expect(deduped.uniqueRows).toHaveLength(3);
    expect(deduped.duplicateRows).toHaveLength(0);
  });

  it("detects Rightmove pagination URLs without duplicating the current page", () => {
    const urls = extractRightmovePaginationUrls({
      pageUrl,
      maxPages: 3,
      html: pageWithCard(`
        <article data-testid="property-card">
          <a href="/properties/148450011#/?channel=COM_BUY">
            <h2>Retail lot</h2>
            <address>Bournemouth, BH1</address>
            <div data-testid="property-price">Guide Price \u00a3350,000</div>
          </a>
        </article>
        <nav>
          <a href="/commercial-property-for-sale/Bournemouth.html">1</a>
          <a href="/commercial-property-for-sale/map.html?viewType=MAP&index=0&locationIdentifier=REGION%5E368">Map</a>
          <a href="/commercial-property-for-sale/Bournemouth.html?index=24" aria-label="Page 2">2</a>
          <a href="/commercial-property-for-sale/Bournemouth.html?index=48" aria-label="Next page">Next</a>
          <a href="/properties/148450011#/?channel=COM_BUY">Property link</a>
        </nav>
      `),
    });

    expect(urls).toEqual([
      "https://www.rightmove.co.uk/commercial-property-for-sale/Bournemouth.html?index=24",
      "https://www.rightmove.co.uk/commercial-property-for-sale/Bournemouth.html?index=48",
    ]);
  });

  it("dedupes listings repeated across paginated Rightmove pages before import", () => {
    const firstPage = scrapeRightmoveCommercialHtmlToImportRows({
      pageUrl,
      html: pageWithCard(`
        <article data-testid="property-card">
          <a href="/properties/148450012#/?channel=COM_BUY">
            <h2>Bournemouth shop</h2>
            <address>Bournemouth, BH1</address>
            <div data-testid="property-price">Guide Price \u00a3350,000</div>
          </a>
        </article>
      `),
    });
    const secondPage = scrapeRightmoveCommercialHtmlToImportRows({
      pageUrl: `${pageUrl}?index=24`,
      html: pageWithCard(`
        <article data-testid="property-card">
          <a href="/properties/148450012#/?channel=COM_BUY">
            <h2>Bournemouth shop duplicate</h2>
            <address>Bournemouth, BH1</address>
            <div data-testid="property-price">Guide Price \u00a3350,000</div>
          </a>
        </article>
      `),
    });

    expect(dedupeRightmoveRows([...firstPage, ...secondPage])).toHaveLength(1);
  });

  it("fails gracefully for blocked or unsupported HTML", () => {
    expect(() => scrapeRightmoveCommercialHtmlToImportRows({
      html: "<html><body>Access denied captcha</body></html>",
      pageUrl,
    })).toThrow(RIGHTMOVE_PARSE_ERROR);
  });

  it("parses guide price from mixed price text without combining sqft or IDs", () => {
    const rows = scrapeRightmoveCommercialHtmlToImportRows({
      html: pageWithCard(`
        <article data-testid="property-card">
          <a href="/properties/350000030203#/?channel=COM_BUY">
            <h2>Mixed number retail lot</h2>
            <address>Bournemouth, BH1</address>
            <div data-testid="property-price">Guide Price £350,000 30,203 sq ft property ID 350000030203</div>
            <p>Retail unit with 30,203 sq ft.</p>
          </a>
        </article>
      `),
      pageUrl,
    });

    expect(rows[0].normalized.guidePrice).toBe(350000);
    expect(rows[0].normalized.sqft).toBe(30203);
    expect(rows[0].validationErrors).not.toContain("guide_price must be greater than 0");
  });

  it("does not combine nearby source IDs into guide price", () => {
    const rows = scrapeRightmoveCommercialHtmlToImportRows({
      html: pageWithCard(`
        <article data-testid="property-card">
          <a href="/properties/350000030203#/?channel=COM_BUY">
            <h2>Freehold Bournemouth shop</h2>
            <address>Bournemouth, BH1</address>
            <div data-testid="property-price">Guide Price £350,000</div>
            <p>30,203 sq ft. Property reference 350000030203.</p>
          </a>
        </article>
      `),
      pageUrl,
    });

    expect(rows[0].normalized.guidePrice).toBe(350000);
    expect(rows[0].normalized.guidePrice).toBeLessThan(500000000);
  });

  it("extracts sqft without combining the sale price", () => {
    const rows = scrapeRightmoveCommercialHtmlToImportRows({
      html: pageWithCard(`
        <article data-testid="property-card">
          <a href="/properties/174711599#/?channel=COM_BUY">
            <h2>Telecom House</h2>
            <address>Bournemouth, BH8 8EJ</address>
            <div data-testid="property-price">£3,500,00030,203 sq. ft.</div>
            <p>Prime commercial building.</p>
          </a>
        </article>
      `),
      pageUrl,
    });

    expect(rows[0].normalized.guidePrice).toBe(3500000);
    expect(rows[0].normalized.sqft).toBe(30203);
  });

  it("skips POA sale listings as POA", () => {
    const rows = scrapeRightmoveCommercialHtmlToImportRows({
      html: pageWithCard(`
        <article data-testid="property-card">
          <a href="/properties/148450004#/?channel=COM_BUY">
            <h2>POA retail lot</h2>
            <address>Poole, BH15</address>
            <div data-testid="property-price">Price on application</div>
            <p>Retail premises.</p>
          </a>
        </article>
      `),
      pageUrl,
    });

    expect(rows[0].normalized.guidePrice).toBeUndefined();
    expect(rows[0].raw.skipReason).toBe("skipped_poa");
    expect(filterRightmoveAcquisitionRows(rows).skipped.skipped_poa).toBe(1);
  });

  it("handles offers over and guide price labels", () => {
    const rows = scrapeRightmoveCommercialHtmlToImportRows({
      html: pageWithCard(`
        <article data-testid="property-card">
          <a href="/properties/148450005#/?channel=COM_BUY">
            <h2>Offers over shop</h2>
            <address>Southampton, SO14</address>
            <div data-testid="property-price">Offers over £350,000</div>
            <p>Retail investment.</p>
          </a>
        </article>
      `),
      pageUrl,
    });

    expect(rows[0].normalized.guidePrice).toBe(350000);
  });

  it("skips rent-only listings and does not use rent as guide price", () => {
    const rows = scrapeRightmoveCommercialHtmlToImportRows({
      html: pageWithCard(`
        <article data-testid="property-card">
          <a href="/properties/148450006#/?channel=COM_BUY">
            <h2>Rent only office</h2>
            <address>Bournemouth, BH2</address>
            <div data-testid="property-price">Rent £25,000 pa</div>
            <p>Office suite available at £25,000 per annum.</p>
          </a>
        </article>
      `),
      pageUrl,
    });

    expect(rows[0].normalized.guidePrice).toBeUndefined();
    expect(rows[0].normalized.passingRent).toBe(25000);
    expect(rows[0].raw.listingIntent).toBe("rent");
    expect(rows[0].raw.skipReason).toBe("skipped_rent_only");
    const filtered = filterRightmoveAcquisitionRows(rows);
    expect(filtered.importRows).toHaveLength(0);
    expect(filtered.skipped.skipped_rent_only).toBe(1);
  });

  it("imports sale listings", () => {
    const rows = scrapeRightmoveCommercialHtmlToImportRows({
      html: pageWithCard(`
        <article data-testid="property-card">
          <a href="/properties/148450007#/?channel=COM_BUY">
            <h2>Freehold retail shop for sale</h2>
            <address>Southampton, SO15</address>
            <div data-testid="property-price">Guide Price \u00a3450,000</div>
            <p>Freehold retail premises.</p>
          </a>
        </article>
      `),
      pageUrl,
    });

    expect(rows[0].raw.listingIntent).toBe("sale");
    expect(filterRightmoveAcquisitionRows(rows).importRows).toHaveLength(1);
  });

  it("imports investment listings with passing rent", () => {
    const rows = scrapeRightmoveCommercialHtmlToImportRows({
      html: pageWithCard(`
        <article data-testid="property-card">
          <a href="/properties/148450008#/?channel=COM_BUY">
            <h2>Retail investment for sale</h2>
            <address>Poole, BH15</address>
            <div data-testid="property-price">Guide Price \u00a3750,000</div>
            <p>Investment let to tenant producing passing rent \u00a360,000 pa.</p>
          </a>
        </article>
      `),
      pageUrl,
    });

    expect(rows[0].raw.listingIntent).toBe("mixed");
    expect(rows[0].normalized.guidePrice).toBe(750000);
    expect(rows[0].normalized.passingRent).toBe(60000);
    expect(filterRightmoveAcquisitionRows(rows).importRows).toHaveLength(1);
  });
});

function pageWithCard(cardHtml: string) {
  return `<!doctype html><html><body><main>${cardHtml}<section>${"filler ".repeat(100)}</section></main></body></html>`;
}
