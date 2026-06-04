import { load } from "cheerio";
import { buildDedupeKeys, extractPostcode, validateImportRow } from "./dealImportCore.mjs";

export const EDDISONS_SOURCE_NAME = "Eddisons";
export const EDDISONS_SOURCE_TYPE = "custom_html_scraper";
export const EDDISONS_SALE_LISTINGS_URL = "https://www.eddisons.com/property-search?purchase-type-id=for-sale&limit=24";
export const EDDISONS_PARSE_ERROR = "Eddisons page could not be parsed. The custom scraper may need updating.";

const DEFAULT_TIMEOUT_MS = 20000;
const USER_AGENT = "DealSignalImporter/1.0 (+server-side import; contact: dealsignal.co.uk)";

export async function fetchEddisonsHtml(url, { timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) throw new Error(`Eddisons fetch failed: ${response.status} ${response.statusText}`);
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

export function scrapeEddisonsHtmlToImportRows({ html, pageUrl, sourceName = EDDISONS_SOURCE_NAME }) {
  const listings = parseEddisonsListings({ html, pageUrl });
  if (!listings.length) throw new Error(EDDISONS_PARSE_ERROR);
  return listings.map((listing, index) => {
    const normalized = normalizeEddisonsListing(listing);
    const validationErrors = validateImportRow(normalized);
    return {
      rowNumber: index + 1,
      raw: {
        source_name: sourceName,
        page_url: pageUrl,
        ...listing.raw,
      },
      normalized,
      validationErrors,
      dedupeKeys: buildDedupeKeys(normalized),
    };
  });
}

export function parseEddisonsListings({ html, pageUrl }) {
  const $ = load(html);
  return $(".property-card").toArray()
    .map((card) => parseEddisonsCard($, $(card), pageUrl))
    .filter(Boolean);
}

export function filterEddisonsSaleRows(rows) {
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

export function extractEddisonsPaginationUrls({ html, pageUrl, maxPages = 2 } = {}) {
  if (maxPages <= 1) return [];
  const $ = load(html ?? "");
  const seen = new Set([normalizeUrl(pageUrl, pageUrl)]);
  const urls = [];
  $("[data-pagination] a[href], .pagination a[href]").each((_, anchor) => {
    if (urls.length >= maxPages - 1) return false;
    const url = normalizeUrl($(anchor).attr("href"), pageUrl);
    if (!url || seen.has(url)) return;
    if (!url.includes("/property-search")) return;
    const parsed = new URL(url);
    if (!parsed.searchParams.get("purchase-type-id")) return;
    if ((Number(parsed.searchParams.get("page")) || 1) <= 1) return;
    seen.add(url);
    urls.push(url);
  });
  return urls;
}

function parseEddisonsCard($, $card, pageUrl) {
  const $link = $card.find("a[href]").first();
  const sourceUrl = normalizeUrl($link.attr("href"), pageUrl);
  if (!sourceUrl || sourceUrl.includes("market-your-property")) return null;

  const title = clean($link.attr("aria-label") || $link.find(".sr-only").text() || $card.find(".text-btg-blue").first().text());
  const imageUrl = normalizeUrl($card.find("img.img-property-card, img").first().attr("src"), pageUrl);
  const assetTypeText = clean($card.find(".listing-type").first().text());
  const textBlocks = $card.find(".text-btg-blue").toArray().map((node) => clean($(node).text())).filter(Boolean);
  const priceTexts = textBlocks.filter((text) => /£|&pound;|on application|poa/i.test(text));
  const guidePriceText = pickGuidePriceText(priceTexts);
  const rentText = priceTexts.find(isRentText) || "";
  const guidePrice = parseMoney(guidePriceText);
  const passingRent = parseMoney(rentText);
  const sqft = parseSize(textBlocks.find((text) => /\bsq\s*ft\b/i.test(text)));
  const listingIntent = classifyEddisonsIntent({ guidePriceText, guidePrice, priceTexts });

  return {
    raw: {
      title,
      source_url: sourceUrl,
      image_url: imageUrl,
      location: title,
      guide_price: guidePriceText,
      passing_rent: rentText,
      sqft: textBlocks.find((text) => /\bsq\s*ft\b/i.test(text)) || "",
      asset_type: assetTypeText,
      listing_intent: listingIntent,
      price_texts: priceTexts,
    },
    title,
    sourceUrl,
    imageUrl,
    location: title,
    guidePrice,
    passingRent,
    sqft,
    assetTypeText,
    listingIntent,
  };
}

function normalizeEddisonsListing(listing) {
  return {
    externalId: listing.sourceUrl,
    sourceUrl: listing.sourceUrl,
    imageUrl: listing.imageUrl || undefined,
    title: listing.title || "Eddisons commercial listing",
    location: listing.location,
    postcode: extractPostcode(listing.location),
    region: "All UK",
    assetType: normalizeAssetType(listing.assetTypeText || listing.title),
    source: "Private treaty",
    guidePrice: listing.guidePrice,
    passingRent: listing.passingRent,
    sqft: listing.sqft,
    tenant: "Unknown",
    covenantStrength: "Moderate",
    mainRiskFlag: "Eddisons import awaiting analyst review",
    postedAt: new Date().toISOString(),
  };
}

function classifyEddisonsIntent({ guidePriceText, guidePrice, priceTexts }) {
  if (guidePrice) return "sale";
  if (priceTexts.some((text) => /on application|poa/i.test(text))) return "poa";
  if (priceTexts.length > 0 && priceTexts.every(isRentText)) return "rent";
  if (!guidePriceText && priceTexts.length === 0) return "unknown";
  return "unknown";
}

function pickGuidePriceText(priceTexts) {
  return priceTexts.find((text) => !isRentText(text) && !/on application|poa/i.test(text)) || "";
}

function isRentText(value) {
  return /\b(per\s+annum|annum|pa\b|pcm|per\s+month|per\s+week|pw\b|exclusive|rent)\b/i.test(value);
}

function parseMoney(value) {
  if (!value || /on application|poa/i.test(value)) return undefined;
  const match = String(value).replace(/,/g, "").match(/£\s*(\d+(?:\.\d+)?)/i) ?? String(value).replace(/,/g, "").match(/\b(\d{4,}(?:\.\d+)?)\b/);
  if (!match) return undefined;
  const parsed = Math.round(Number(match[1]));
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function parseSize(value) {
  if (!value) return undefined;
  const match = String(value).replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*sq\s*ft/i);
  if (!match) return undefined;
  const parsed = Math.round(Number(match[1]));
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function normalizeAssetType(value) {
  const lower = String(value ?? "").toLowerCase();
  if (/industrial|warehouse|logistics|trade counter/.test(lower)) return "Industrial";
  if (/office/.test(lower)) return "Office";
  if (/land|development/.test(lower)) return "Land";
  if (/leisure|restaurant|pub|hotel|gym/.test(lower)) return "Leisure";
  if (/health|medical|surgery|clinic/.test(lower)) return "Healthcare";
  if (/roadside|drive.?thru|petrol/.test(lower)) return "Roadside";
  if (/mixed/.test(lower)) return "Mixed-use";
  if (/convenience|foodstore|supermarket/.test(lower)) return "Convenience";
  return "Retail";
}

function normalizeUrl(url, pageUrl) {
  if (!url) return "";
  try {
    return new URL(url, pageUrl).toString();
  } catch {
    return "";
  }
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}
