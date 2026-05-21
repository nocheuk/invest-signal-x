import { afterEach, describe, expect, it, vi } from "vitest";
import { dedupeImportRows } from "@/lib/imports/dealImport";
import { runDealImport } from "../../../scripts/lib/importRunner.mjs";
import { scrapeHtmlToImportRows } from "../../../scripts/lib/htmlScraper.mjs";

const config = {
  selectors: {
    listingCardSelector: ".listing-card",
    titleSelector: ".listing-title",
    urlSelector: { selector: "a.listing-link", attribute: "href" },
    imageSelector: { selector: "img.listing-image", attribute: "src" },
    locationSelector: ".listing-location",
    priceSelector: ".listing-price",
    rentSelector: ".listing-rent",
    yieldSelector: ".listing-yield",
    sizeSelector: ".listing-size",
    propertyTypeSelector: ".listing-type",
    descriptionSelector: ".listing-description",
  },
};

const html = `
  <article class="listing-card">
    <a class="listing-link" href="/commercial/1">View</a>
    <img class="listing-image" src="/images/retail.jpg" alt="">
    <h2 class="listing-title">High Street Retail Investment</h2>
    <div class="listing-location">Bournemouth, BH1</div>
    <div class="listing-price">£1,250,000</div>
    <div class="listing-rent">£92,500 pa</div>
    <div class="listing-yield">7.40%</div>
    <div class="listing-size">6,400 sq ft</div>
    <div class="listing-type">Retail</div>
    <p class="listing-description">Prime retail parade.</p>
  </article>
  <article class="listing-card">
    <a class="listing-link" href="/commercial/2">View</a>
    <h2 class="listing-title">Industrial Warehouse</h2>
    <div class="listing-location">Poole, BH15</div>
    <div class="listing-price">2,750,000</div>
    <div class="listing-size">18,000 sq ft</div>
    <div class="listing-type">Industrial / Warehouse</div>
    <p class="listing-description">Warehouse with yard.</p>
  </article>
`;

describe("custom HTML scraper", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses listing cards with selector config into normalized import rows", () => {
    const rows = scrapeHtmlToImportRows({
      html,
      pageUrl: "https://example-agent-site.com/commercial",
      config,
      sourceName: "Example Agent",
    });

    expect(rows).toHaveLength(2);
    expect(rows[0].normalized).toMatchObject({
      title: "High Street Retail Investment",
      sourceUrl: "https://example-agent-site.com/commercial/1",
      location: "Bournemouth, BH1",
      postcode: "BH1",
      guidePrice: 1250000,
      passingRent: 92500,
      netInitialYield: 7.4,
      sqft: 6400,
      assetType: "Retail",
      imageUrl: "https://example-agent-site.com/images/retail.jpg",
    });
    expect(rows[0].validationErrors).toEqual([]);
  });

  it("surfaces missing required fields as validation errors", () => {
    const rows = scrapeHtmlToImportRows({
      html: `<article class="listing-card"><h2 class="listing-title"></h2><div class="listing-price"></div></article>`,
      pageUrl: "https://example-agent-site.com/commercial",
      config,
    });

    expect(rows[0].validationErrors).toContain("location is required");
    expect(rows[0].validationErrors).toContain("guide_price must be greater than 0");
  });

  it("maps Acuitus-style listing cards with line-break addresses and yield", () => {
    const rows = scrapeHtmlToImportRows({
      html: `
        <ul class="proplist-grid">
          <li class="auction available">
            <a href="https://www.acuitus.co.uk/property/5760/">
              <div class="proplist-sector">Office, Residential, Development, Receivership</div>
              <div class="proplist-grid-address">33 Clarges Street<br>Mayfair<br>London<br>W1J 7EE<br></div>
              <dl class="proplist-grid-status">
                <dt>Status</dt><dd>Available</dd>
                <dt>Auction</dt><dd>11/06/2026</dd>
                <dt class="lotlabel">&nbsp;</dt><dd>&nbsp;</dd>
                <dt>Guide*</dt><dd>£5,250,000</dd>
                <dt>Yield</dt><dd>0.00%</dd>
              </dl>
            </a>
          </li>
        </ul>
      `,
      pageUrl: "https://www.acuitus.co.uk/find-a-property/",
      config: {
        selectors: {
          listingCardSelector: "ul.proplist-grid > li.auction",
          titleSelector: ".proplist-sector",
          urlSelector: { selector: "a:first", attribute: "href" },
          locationSelector: ".proplist-grid-address",
          priceSelector: ".proplist-grid-status dd:nth-of-type(4)",
          yieldSelector: ".proplist-grid-status dd:nth-of-type(5)",
          propertyTypeSelector: ".proplist-sector",
          descriptionSelector: ".proplist-sector",
        },
        defaults: { source: "Auction" },
      },
      sourceName: "Acuitus",
    });

    expect(rows[0].normalized).toMatchObject({
      title: "Office, Residential, Development, Receivership",
      sourceUrl: "https://www.acuitus.co.uk/property/5760/",
      location: "33 Clarges Street Mayfair London W1J 7EE",
      postcode: "W1J 7EE",
      guidePrice: 5250000,
      netInitialYield: 0,
      assetType: "Office",
      source: "Auction",
    });
    expect(rows[0].validationErrors).toEqual([]);
  });

  it("dedupes duplicate scraper rows using the shared import identity rules", () => {
    const duplicateHtml = `${html}${html}`;
    const rows = scrapeHtmlToImportRows({
      html: duplicateHtml,
      pageUrl: "https://example-agent-site.com/commercial",
      config,
    });
    const result = dedupeImportRows(rows);

    expect(rows).toHaveLength(4);
    expect(result.uniqueRows).toHaveLength(2);
    expect(result.duplicateRows).toHaveLength(2);
  });

  it("runs scraper output through dry-run import without Supabase", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const rows = scrapeHtmlToImportRows({
      html,
      pageUrl: "https://example-agent-site.com/commercial",
      config,
      sourceName: "Example Agent",
    });

    const result = await runDealImport({
      rows,
      sourceName: "Example Agent",
      sourceType: "custom_html_scraper",
      dryRun: true,
      sourceConfig: { adapter: "custom-html-v1" },
    });

    expect(result).toMatchObject({
      source: "Example Agent",
      dryRun: true,
      total: 2,
      unique: 2,
      processed: 2,
      failed: 0,
    });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('"dryRun": true'));
  });
});
