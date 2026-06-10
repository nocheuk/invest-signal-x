import { load } from "cheerio";
import { buildDedupeKeys, extractPostcode, validateImportRow } from "./dealImportCore.mjs";
import { runDealImport } from "./importRunner.mjs";

export const USER_AGENT = "Mozilla/5.0 (compatible; DealSignalImporter/1.0; +https://dealsignal.co.uk)";
export const GENERIC_SOURCE_TYPE = "custom_html_scraper";
export const AUCTION_SOURCE_TYPE = "auction_scraper";

const DEFAULT_TIMEOUT_MS = 20000;
const PRICE_MIN = 1000;
const PRICE_MAX = 500_000_000;

export const SOURCE_CONFIGS = {
  goadsby: {
    key: "goadsby",
    sourceName: "Goadsby Commercial",
    sourceType: GENERIC_SOURCE_TYPE,
    defaultUrl: "https://goadsby.com/commercial/properties/for-sale",
    listingSelector: "[data-property-id], .property-card, .property-result, article",
    linkSelector: "a[href*='/commercial/properties/'], a[href]",
    titleSelector: "h2, h3, [class*='title'], [class*='address']",
    locationSelector: "[class*='address'], [class*='location'], h2, h3",
    priceSelector: "[class*='price'], [class*='guide']",
    rentSelector: "[class*='rent']",
    sqftSelector: "[class*='size'], [class*='area']",
    assetTypeSelector: "[class*='type'], [class*='category']",
    descriptionSelector: "[class*='description'], [class*='summary'], p",
    imageSelector: "img",
    paginationSelector: "a[href*='page='], a[rel='next']",
    defaultRegion: "South of England",
  },
  zoopla: {
    key: "zoopla",
    sourceName: "Zoopla Commercial",
    sourceType: GENERIC_SOURCE_TYPE,
    defaultUrl: "https://www.zoopla.co.uk/for-sale/commercial/",
    listingSelector: "[data-testid*='listing'], [class*='listing'], article",
    linkSelector: "a[href*='/for-sale/commercial/'], a[href*='/commercial/details/'], a[href]",
    titleSelector: "h2, h3, [data-testid*='title'], [class*='title']",
    locationSelector: "[data-testid*='address'], [class*='address'], [class*='location']",
    priceSelector: "[data-testid*='price'], [class*='price']",
    rentSelector: "[class*='rent']",
    sqftSelector: "[class*='size'], [class*='area']",
    assetTypeSelector: "[class*='type'], [class*='category']",
    descriptionSelector: "[class*='description'], [class*='summary'], p",
    imageSelector: "img",
    paginationSelector: "a[href*='pn='], a[rel='next']",
    defaultRegion: "All UK",
  },
  savills: {
    key: "savills",
    sourceName: "Savills Commercial",
    sourceType: GENERIC_SOURCE_TYPE,
    defaultUrl: "https://search.savills.com/list/commercial/property-for-sale/uk",
    listingSelector: "article.sv-property-card",
    linkSelector: "a[href*='/property-detail/']",
    titleSelector: ".sv-details__address2, .sv-details__address1, h3",
    locationSelector: ".sv-details__address2",
    priceSelector: ".sv-details__price, .sv-property-price__value",
    sqftSelector: ".sv-property-price__size, .sv-property-attribute__value",
    assetTypeSelector: ".sv-property-attribute__value",
    descriptionSelector: ".sv-details__features, .sv-key-features",
    imageSelector: ".sv-image, img",
    paginationSelector: "a[rel='next'], a[href*='page=']",
    defaultRegion: "All UK",
  },
  sdl: {
    key: "sdl",
    sourceName: "SDL Property Auctions",
    sourceType: AUCTION_SOURCE_TYPE,
    defaultUrl: "https://www.sdlauctions.co.uk/search/",
    listingSelector: ".property-card, [class*='property-card'], [class*='lot'], article",
    linkSelector: "a[href*='/property/'], a[href*='/lot/'], a[href]",
    titleSelector: "h2, h3, [class*='address'], [class*='title']",
    locationSelector: "[class*='address'], h2, h3",
    priceSelector: "[class*='guide'], [class*='price']",
    sqftSelector: "[class*='size'], [class*='area']",
    assetTypeSelector: "[class*='type'], [class*='category'], [class*='badge']",
    descriptionSelector: "[class*='description'], [class*='summary'], p",
    imageSelector: "img",
    paginationSelector: "a[href*='page='], a[rel='next']",
    defaultRegion: "All UK",
    sourceChannel: "Auction",
  },
  pugh: {
    key: "pugh",
    sourceName: "Pugh Auctions",
    sourceType: AUCTION_SOURCE_TYPE,
    defaultUrl: "https://www.pugh-auctions.com/property-search",
    listingSelector: ".group.bg-primary, [class*='property-card'], article",
    linkSelector: "a[href*='/property/']",
    titleSelector: ".uppercase a, h2, h3, [class*='address']",
    locationSelector: ".uppercase a, h2, h3, [class*='address']",
    priceSelector: "p, [class*='price'], [class*='guide']",
    imageSelector: "img",
    paginationSelector: "a[href*='page=']",
    defaultRegion: "All UK",
    sourceChannel: "Auction",
  },
  bondWolfe: {
    key: "bond-wolfe",
    sourceName: "Bond Wolfe",
    sourceType: AUCTION_SOURCE_TYPE,
    defaultUrl: "https://www.bondwolfe.com/order-of-sale/",
    listingSelector: ".OrderOfSale .list-group a.list-group-item",
    linkSelector: "&",
    titleSelector: ".mr-sm-4, .mr-lg-2",
    locationSelector: ".mr-sm-4, .mr-lg-2",
    priceSelector: "[class*='price'], [class*='guide']",
    assetTypeSelector: ".Badge",
    imageSelector: "img",
    paginationSelector: "a[rel='next'], a[href*='page=']",
    defaultRegion: "West Midlands",
    sourceChannel: "Auction",
  },
  fisherGerman: {
    key: "fisher-german",
    sourceName: "Fisher German Commercial",
    sourceType: GENERIC_SOURCE_TYPE,
    defaultUrl: "https://www.fishergerman.co.uk/property-search/commercial-property-in-england-and-wales",
    listingSelector: ".property-wrap",
    linkSelector: "a[href*='commercial-property-sales']",
    titleSelector: ".item-address, h4",
    locationSelector: ".street-location, .item-address",
    priceSelector: ".property__price, .price-qualifier",
    sqftSelector: ".detail-size",
    assetTypeSelector: ".streets, .item-address",
    descriptionSelector: ".item-details",
    imageSelector: "img, [id^='stb_image']",
    paginationSelector: ".pagination a[href], a[rel='next'], a[href*='page=']",
    defaultRegion: "England and Wales",
  },
  lsh: {
    key: "lsh",
    sourceName: "Lambert Smith Hampton",
    sourceType: GENERIC_SOURCE_TYPE,
    defaultUrl: "https://www.lsh.co.uk/property-search",
    listingSelector: ".property",
    linkSelector: "a[href*='/find/properties/']",
    titleSelector: ".property__content p",
    locationSelector: ".property__content p:last-child",
    priceSelector: "[class*='price'], [class*='guide']",
    assetTypeSelector: ".property__content p:first-child",
    descriptionSelector: ".property__content",
    imageSelector: "img",
    paginationSelector: "a[rel='next'], a[href*='page=']",
    defaultRegion: "All UK",
  },
};

export function getCommercialSourceConfig(key) {
  const config = SOURCE_CONFIGS[normalizeSourceKey(key)];
  if (!config) throw new Error(`Unknown source key: ${key}`);
  return config;
}

export async function runConfiguredCommercialSourceImport({
  sourceKey,
  searchUrl,
  sourceName,
  dryRun = false,
  maxPages = 2,
  fetchImpl,
  sourceConfig = {},
} = {}) {
  const config = getCommercialSourceConfig(sourceKey);
  const pageUrl = searchUrl || config.defaultUrl;
  const resolvedSourceName = sourceName || config.sourceName;
  if (!pageUrl) throw new Error(`${config.sourceName} search URL is required.`);

  console.log(`mode: ${dryRun ? "dry-run" : "live"}`);
  let firstHtml = "";
  try {
    firstHtml = await fetchCommercialSourceHtml(pageUrl, { fetchImpl });
  } catch (error) {
    const result = failedSourceResult({
      sourceName: resolvedSourceName,
      dryRun,
      error,
    });
    console.log(JSON.stringify(result, null, 2));
    return result;
  }
  const pageUrls = [
    pageUrl,
    ...extractConfiguredPaginationUrls({ html: firstHtml, pageUrl, config, maxPages }),
  ];
  const rows = [];

  for (const [index, currentUrl] of pageUrls.entries()) {
    const html = index === 0 ? firstHtml : await fetchCommercialSourceHtml(currentUrl, { fetchImpl });
    try {
      const pageRows = scrapeConfiguredHtmlToImportRows({
        html,
        pageUrl: currentUrl,
        config,
        sourceName: resolvedSourceName,
      }).map((row, offset) => ({ ...row, rowNumber: rows.length + offset + 1 }));
      rows.push(...pageRows);
    } catch (error) {
      const result = failedSourceResult({
        sourceName: resolvedSourceName,
        dryRun,
        error,
      });
      console.log(JSON.stringify(result, null, 2));
      return result;
    }
  }

  const { importRows, skipped } = filterAcquisitionRows(rows);
  reportSkips(skipped);

  if (importRows.length === 0) {
    const result = emptyResult({
      sourceName: resolvedSourceName,
      dryRun,
      discovered: rows.length,
      skipped,
    });
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  const result = await runDealImport({
    rows: importRows,
    sourceName: resolvedSourceName,
    sourceType: config.sourceType,
    dryRun,
    sourceConfig: {
      adapter: `${config.key}-commercial-v1`,
      page_url: pageUrl,
      sale_only: true,
      max_pages: maxPages,
      pages_scanned: pageUrls,
      ...sourceConfig,
    },
  });

  const finalResult = {
    ...result,
    total: rows.length,
    discovered: rows.length,
    importable: importRows.length,
    skipped_rent_only: Number(result.skipped_rent_only ?? 0) + countReason(skipped, "skipped_rent_only"),
    skipped_poa: Number(result.skipped_poa ?? 0) + countReason(skipped, "skipped_poa"),
  };
  console.log(JSON.stringify(summaryResult(finalResult, resolvedSourceName, dryRun), null, 2));
  return finalResult;
}

export async function fetchCommercialSourceHtml(url, { timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml,application/json;q=0.8",
      },
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
    if (isBlockedHtml(text)) throw new Error("Source page is blocked by anti-bot protection.");
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

export function scrapeConfiguredHtmlToImportRows({ html, pageUrl, config, sourceName = config.sourceName }) {
  const listings = parseConfiguredListings({ html, pageUrl, config });
  if (!listings.length) {
    throw new Error(`${config.sourceName} page could not be parsed. The scraper may need updating.`);
  }
  return listings.map((listing, index) => {
    const normalized = normalizeConfiguredListing({ listing, config });
    return {
      rowNumber: index + 1,
      raw: {
        source_name: sourceName,
        page_url: pageUrl,
        ...listing.raw,
      },
      normalized,
      validationErrors: validateImportRow(normalized),
      dedupeKeys: buildDedupeKeys(normalized),
    };
  });
}

export function parseConfiguredListings({ html, pageUrl, config }) {
  const $ = load(html ?? "");
  const cards = $(config.listingSelector).toArray();
  return cards.map((card) => parseConfiguredCard({ $, card: $(card), pageUrl, config })).filter(Boolean);
}

export function filterAcquisitionRows(rows) {
  const importRows = [];
  const skipped = [];
  for (const row of rows) {
    if (row.raw.listing_intent === "rent") {
      skipped.push({ row, reason: "skipped_rent_only" });
      continue;
    }
    if (row.raw.listing_intent === "poa") {
      skipped.push({ row, reason: "skipped_poa" });
      continue;
    }
    importRows.push(row);
  }
  return { importRows, skipped };
}

export function extractConfiguredPaginationUrls({ html, pageUrl, config, maxPages = 2 } = {}) {
  if (maxPages <= 1) return [];
  const $ = load(html ?? "");
  const seen = new Set([normalizeUrl(pageUrl, pageUrl)]);
  const urls = [];
  $(config.paginationSelector).each((_, anchor) => {
    if (urls.length >= maxPages - 1) return false;
    const url = normalizeUrl($(anchor).attr("href"), pageUrl);
    if (!url || seen.has(url)) return;
    seen.add(url);
    urls.push(url);
  });
  return urls;
}

export function parseMoney(value) {
  if (!value || /price\s+on\s+application|\bpoa\b|refer\s+to\s+auctioneer/i.test(String(value))) return undefined;
  const text = clean(value).replace(/,/g, "");
  const patterns = [
    /(?:guide\s+price|offers\s+over|excess\s+of|asking\s+price|price)\D{0,30}(?:\u00a3|Â£|GBP)?\s*(\d{4,}(?:\.\d+)?)/i,
    /(?:\u00a3|Â£|GBP)\s*(\d{4,}(?:\.\d+)?)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const parsed = safeInteger(match?.[1]);
    if (parsed) return parsed;
  }
  return undefined;
}

export function parseRent(value) {
  const text = clean(value);
  if (!isRentText(text)) return undefined;
  const match = text.replace(/,/g, "").match(/(?:\u00a3|Â£|GBP)\s*(\d{3,}(?:\.\d+)?)/i);
  return safeInteger(match?.[1]);
}

export function parseSize(value) {
  const text = clean(value).replace(/,/g, "");
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|square feet|gia|nia)/i);
  return safeInteger(match?.[1]);
}

export function parseYield(value) {
  const match = clean(value).match(/(?:net\s+initial\s+yield|initial\s+yield|yield|reflecting)\D{0,30}(\d+(?:\.\d+)?)\s*%/i);
  const parsed = Number(match?.[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseConfiguredCard({ $, card, pageUrl, config }) {
  const link = select(card, config.linkSelector, $).first();
  const sourceUrl = normalizeUrl(link.attr("href"), pageUrl);
  if (!sourceUrl || isNonListingUrl(sourceUrl)) return null;

  const text = clean(card.text());
  const titleText = clean(select(card, config.titleSelector, $).first().text() || link.text());
  const locationText = clean(select(card, config.locationSelector, $).first().text() || titleText);
  const priceText = clean(select(card, config.priceSelector, $).first().text() || findPriceText(text));
  const rentText = clean(select(card, config.rentSelector || "", $).first().text() || findRentText(text));
  const sqftText = clean(select(card, config.sqftSelector || "", $).first().text() || text);
  const assetTypeText = clean(select(card, config.assetTypeSelector || "", $).first().text() || titleText);
  const description = clean(select(card, config.descriptionSelector || "", $).text() || text);
  const imageUrl = extractImageUrl({ $, card, pageUrl, selector: config.imageSelector });
  const guidePrice = parseMoney(priceText || text);
  const passingRent = parseRent(rentText || text);
  const sqft = parseSize(sqftText);
  const yieldValue = parseYield(description);
  const listingIntent = classifyIntent({ text, priceText, guidePrice });

  return {
    raw: {
      external_id: externalIdFromUrl(sourceUrl),
      source_url: sourceUrl,
      image_url: imageUrl,
      title: titleText,
      location: locationText,
      guide_price: priceText,
      passing_rent: rentText,
      sqft: sqftText,
      asset_type: assetTypeText,
      description,
      listing_intent: listingIntent,
    },
    externalId: externalIdFromUrl(sourceUrl),
    sourceUrl,
    imageUrl,
    title: normalizeTitle(titleText, locationText, assetTypeText, config.sourceName),
    location: normalizeLocation(locationText, titleText),
    postcode: extractPostcode(locationText || titleText),
    region: config.defaultRegion || "All UK",
    assetTypeText,
    guidePrice,
    passingRent,
    yieldValue,
    sqft,
    description,
    listingIntent,
  };
}

function normalizeConfiguredListing({ listing, config }) {
  return {
    externalId: listing.externalId,
    sourceUrl: listing.sourceUrl,
    imageUrl: listing.imageUrl || undefined,
    title: listing.title,
    location: listing.location,
    postcode: listing.postcode || extractPostcode(listing.location),
    region: listing.region || "All UK",
    assetType: normalizeAssetType(`${listing.assetTypeText} ${listing.title} ${listing.description}`),
    source: config.sourceChannel || (config.sourceType === AUCTION_SOURCE_TYPE ? "Auction" : "Private treaty"),
    guidePrice: listing.guidePrice,
    passingRent: listing.passingRent,
    netInitialYield: listing.yieldValue,
    sqft: listing.sqft,
    tenant: "Unknown",
    covenantStrength: "Moderate",
    mainRiskFlag: `${config.sourceName} import awaiting source document and tenancy verification`,
    description: listing.description,
    postedAt: new Date().toISOString(),
  };
}

function classifyIntent({ text, priceText, guidePrice }) {
  const source = clean([priceText, text].filter(Boolean).join(" "));
  if (/price\s+on\s+application|\bpoa\b/i.test(source) && !guidePrice) return "poa";
  if (isRentText(source) && !hasSaleHint(source)) return "rent";
  if (guidePrice || hasSaleHint(source)) return "sale";
  return "unknown";
}

function hasSaleHint(value) {
  return /\b(for\s+sale|auction|guide\s+price|offers\s+over|excess\s+of|freehold|long\s+leasehold|investment|commercial\s+investment)\b/i.test(value);
}

function isRentText(value) {
  return /\b(to\s+let|for\s+rent|rent\b|per\s+annum|annum|pa\b|pcm|per\s+month|per\s+week|pw\b|exclusive)\b/i.test(value);
}

function findPriceText(value) {
  const text = clean(value);
  return text.match(/(?:guide\s+price|offers\s+over|excess\s+of|asking\s+price|price|from)?\D{0,20}(?:\u00a3|Â£|GBP)\s*[\d,]+(?:\.\d+)?(?:\s*(?:plus|guide|offers|freehold|for\s+sale))?/i)?.[0] || "";
}

function findRentText(value) {
  const text = clean(value);
  return text.match(/(?:\u00a3|Â£|GBP)\s*[\d,]+(?:\.\d+)?\s*(?:per\s+annum|annum|pa\b|pcm|per\s+month|per\s+week|pw\b|exclusive|rent)/i)?.[0] || "";
}

function select(card, selector, $) {
  if (!selector) return load("")("");
  if (selector === "&") return card;
  return card.find(selector);
}

function extractImageUrl({ $, card, pageUrl, selector }) {
  const nodes = selector ? select(card, selector, $).toArray() : card.find("img").toArray();
  for (const node of nodes) {
    const item = $(node);
    const candidates = [
      item.attr("src"),
      item.attr("data-src"),
      item.attr("data-lazy-src"),
      item.attr("data-original"),
      firstSrcsetUrl(item.attr("srcset") || item.attr("data-srcset")),
      cssBackgroundUrl(item.attr("style")),
    ];
    for (const candidate of candidates) {
      const url = normalizeUrl(candidate, pageUrl);
      if (isValidImageUrl(url)) return url;
    }
  }
  return "";
}

function isValidImageUrl(url) {
  return Boolean(url) && !/\.(svg|gif)(?:$|\?)/i.test(url) && !/placeholder|sprite|icon|logo|tracking|1x1|base64/i.test(url);
}

function firstSrcsetUrl(value) {
  return clean(value).split(",")[0]?.trim().split(/\s+/)[0] || "";
}

function cssBackgroundUrl(value) {
  return clean(value).match(/url\(['"]?([^'")]+)['"]?\)/i)?.[1] || "";
}

function normalizeTitle(title, location, assetType, sourceName) {
  const cleaned = clean(title).replace(/\bView Property\b/gi, "").trim();
  if (cleaned && !/^\d+\/\d+$/.test(cleaned) && cleaned.length > 2) return cleaned;
  const fallback = clean([assetType, location].filter(Boolean).join(" - "));
  return fallback || `${sourceName} commercial listing`;
}

function normalizeLocation(location, title) {
  const cleaned = clean(location).replace(/\bView Property\b/gi, "").trim();
  if (cleaned.length > 2) return cleaned;
  return clean(title);
}

function normalizeAssetType(value) {
  const lower = String(value ?? "").toLowerCase();
  if (/industrial|warehouse|logistics|trade counter/.test(lower)) return "Industrial";
  if (/office/.test(lower)) return "Office";
  if (/land|development|site|plot/.test(lower)) return "Land";
  if (/leisure|restaurant|pub|hotel|gym|cinema/.test(lower)) return "Leisure";
  if (/health|medical|surgery|clinic|care/.test(lower)) return "Healthcare";
  if (/roadside|drive.?thru|petrol|motor/.test(lower)) return "Roadside";
  if (/mixed|residential/.test(lower)) return "Mixed-use";
  if (/convenience|foodstore|supermarket/.test(lower)) return "Convenience";
  return "Retail";
}

function normalizeSourceKey(key) {
  const normalized = String(key ?? "").replace(/_/g, "-");
  const aliases = {
    bondwolfe: "bondWolfe",
    "bond-wolfe": "bondWolfe",
    fishergerman: "fisherGerman",
    "fisher-german": "fisherGerman",
    lambert: "lsh",
    "lambert-smith-hampton": "lsh",
  };
  return aliases[normalized] || normalized;
}

function emptyResult({ sourceName, dryRun, discovered, skipped }) {
  return {
    source: sourceName,
    dryRun,
    total: discovered,
    discovered,
    importable: 0,
    unique: 0,
    inserted: 0,
    existing: 0,
    processed: 0,
    failed: 0,
    skipped_duplicate: 0,
    skipped_rent_only: countReason(skipped, "skipped_rent_only"),
    skipped_poa: countReason(skipped, "skipped_poa"),
  };
}

function failedSourceResult({ sourceName, dryRun, error }) {
  return {
    source: sourceName,
    dryRun,
    total: 0,
    discovered: 0,
    importable: 0,
    unique: 0,
    inserted: 0,
    existing: 0,
    processed: 0,
    failed: 1,
    skipped_duplicate: 0,
    skipped_rent_only: 0,
    skipped_poa: 0,
    error: error instanceof Error ? error.message : String(error),
  };
}

function summaryResult(result, sourceName, dryRun) {
  return {
    source: sourceName,
    dryRun,
    discovered: result.discovered,
    importable: result.importable,
    inserted: result.inserted,
    existing: result.existing,
    failed: result.failed,
    skipped_duplicate: result.skipped_duplicate,
    skipped_rent_only: result.skipped_rent_only,
    skipped_poa: result.skipped_poa,
  };
}

function reportSkips(skipped) {
  for (const item of skipped) {
    console.log(`row ${item.row.rowNumber}: ${item.reason} - ${item.row.normalized.sourceUrl ?? item.row.normalized.title}`);
  }
}

function countReason(skipped, reason) {
  return skipped.filter((item) => item.reason === reason).length;
}

function isBlockedHtml(html) {
  return /<title>\s*Just a moment|cf-browser-verification|challenge-platform|Access Denied|cf-chl-/i.test(String(html ?? ""));
}

function isNonListingUrl(url) {
  return /privacy|cookie|terms|contact|valuation|market-your-property|free-auction-appraisal/i.test(url);
}

function externalIdFromUrl(url) {
  return clean(url).replace(/\/$/, "").split("/").pop() || url;
}

function normalizeUrl(url, pageUrl) {
  if (!url) return "";
  try {
    return new URL(url, pageUrl).toString();
  } catch {
    return "";
  }
}

function safeInteger(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Math.round(Number(String(value).replace(/,/g, "")));
  if (!Number.isSafeInteger(parsed) || parsed < PRICE_MIN || parsed > PRICE_MAX) return undefined;
  return parsed;
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}
