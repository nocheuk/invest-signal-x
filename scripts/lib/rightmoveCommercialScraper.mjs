import { load } from "cheerio";
import {
  buildDedupeKeys,
  extractPostcode,
  validateImportRow,
} from "./dealImportCore.mjs";

export const RIGHTMOVE_CUSTOM_SCRAPER_VERSION = "custom-rightmove-commercial-v1";
export const RIGHTMOVE_PARSE_ERROR = "Rightmove page could not be parsed. The custom scraper may need updating.";

const RIGHTMOVE_BASE_URL = "https://www.rightmove.co.uk";
const DEFAULT_TIMEOUT_MS = 15000;
const MIN_GUIDE_PRICE = 1_000;
const MAX_GUIDE_PRICE = 500_000_000;
const USER_AGENT = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  "AppleWebKit/537.36 (KHTML, like Gecko)",
  "Chrome/125.0.0.0 Safari/537.36",
].join(" ");

export async function fetchRightmoveCommercialHtml(url, { timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-GB,en;q=0.9",
        "cache-control": "no-cache",
      },
    });
    if (!response.ok) {
      throw new Error(`${RIGHTMOVE_PARSE_ERROR} HTTP ${response.status}`);
    }
    const html = await response.text();
    assertParseableHtml(html);
    return html;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(`${RIGHTMOVE_PARSE_ERROR} Request timed out.`);
    if (error instanceof Error && error.message.startsWith(RIGHTMOVE_PARSE_ERROR)) throw error;
    throw new Error(`${RIGHTMOVE_PARSE_ERROR} ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timeout);
  }
}

export function scrapeRightmoveCommercialHtmlToImportRows({ html, pageUrl, sourceName = "Rightmove Commercial" }) {
  assertParseableHtml(html);
  const items = parseRightmoveCommercialListings({ html, pageUrl, sourceName });
  if (items.length === 0) throw new Error(RIGHTMOVE_PARSE_ERROR);
  return items.map((item, index) => {
    const normalized = normalizeRightmoveListing(item);
    return {
      rowNumber: index + 1,
      raw: item,
      normalized,
      validationErrors: validateImportRow(normalized),
      dedupeKeys: buildDedupeKeys(normalized),
    };
  });
}

export function parseRightmoveCommercialListings({ html, pageUrl, sourceName = "Rightmove Commercial" }) {
  assertParseableHtml(html);
  const $ = load(html);
  const seen = new Set();
  const items = [];

  $('a[href*="/properties/"]').each((_, anchor) => {
    const $anchor = $(anchor);
    const sourceUrl = normalizeRightmoveUrl($anchor.attr("href"), pageUrl);
    const propertyId = extractPropertyId(sourceUrl);
    if (!sourceUrl || !propertyId || seen.has(propertyId)) return;
    seen.add(propertyId);

    const $card = findListingCard($, $anchor);
    const cardText = clean($card.text() || $anchor.text());
    const title = firstText($, $card, [
      '[data-testid*="title"]',
      '[data-test*="title"]',
      ".propertyCard-title",
      "h2",
      "h3",
    ]) || clean($anchor.attr("aria-label")) || clean($anchor.text());
    const location = firstText($, $card, [
      "address",
      '[data-testid*="address"]',
      '[data-test*="address"]',
      ".propertyCard-address",
      ".propertyCard-location",
    ]) || extractAddressFromText(cardText) || title;
    const price = firstText($, $card, [
      '[data-testid*="price"]',
      '[data-test*="price"]',
      ".propertyCard-priceValue",
      ".propertyCard-price",
    ]);
    const guidePrice = parseGuidePrice(price) ?? parseGuidePriceFromLabeledText(cardText);
    const rent = extractRent(cardText);
    const intent = classifyListingIntent({ title, price, text: cardText, guidePrice, rent });
    const sqft = extractSqft(cardText);
    const propertyType = firstText($, $card, [
      '[data-testid*="property-type"]',
      '[data-test*="property-type"]',
      ".propertyCard-branchSummary",
    ]) || inferPropertyType(cardText);
    const description = firstText($, $card, [
      '[data-testid*="description"]',
      '[data-test*="description"]',
      ".propertyCard-description",
      ".propertyCard-summary",
      "p",
    ]) || cardText;
    const imageUrl = extractImageUrl($, $card, pageUrl);
    const listedAt = extractListedDate(cardText);

    items.push({
      source_name: sourceName,
      propertyId,
      propertyUrl: sourceUrl,
      title,
      displayAddress: location,
      propertyType,
      price,
      guidePrice,
      rent,
      listingIntent: intent.intent,
      skipReason: intent.skipReason,
      sizeSqFt: sqft,
      description,
      imageUrl,
      addedOn: listedAt,
      rawText: cardText,
    });
  });

  return items;
}

export function filterRightmoveAcquisitionRows(rows) {
  const skipped = {
    skipped_rent_only: 0,
    skipped_poa: 0,
    failed_missing_price: 0,
  };
  const importRows = [];

  for (const row of rows) {
    const intent = row.raw?.listingIntent;
    const skipReason = row.raw?.skipReason;
    if (skipReason === "skipped_rent_only" || intent === "rent") {
      skipped.skipped_rent_only += 1;
      continue;
    }
    if (skipReason === "skipped_poa") {
      skipped.skipped_poa += 1;
      continue;
    }
    if (!row.normalized.guidePrice || row.validationErrors.includes("guide_price must be greater than 0")) {
      skipped.failed_missing_price += 1;
      continue;
    }
    if (intent === "sale" || intent === "mixed" || intent === "investment") {
      importRows.push(row);
      continue;
    }
    skipped.failed_missing_price += 1;
  }

  return { importRows, skipped };
}

function normalizeRightmoveListing(item) {
  const title = item.title || item.displayAddress || "Rightmove commercial listing";
  const location = item.displayAddress || title;
  return {
    externalId: item.propertyId || item.propertyUrl,
    sourceUrl: item.propertyUrl,
    imageUrl: item.imageUrl,
    title,
    location,
    postcode: extractPostcode(location),
    region: "All UK",
    assetType: mapAssetType(item.propertyType || title || item.description),
    source: "Private treaty",
    guidePrice: item.guidePrice,
    passingRent: parseNumber(item.rent),
    sqft: parseNumber(item.sizeSqFt),
    tenant: "Unknown",
    covenantStrength: "Moderate",
    mainRiskFlag: "Rightmove custom scraper import awaiting analyst review",
    description: item.description,
    postedAt: item.addedOn ? parseListedDate(item.addedOn) : new Date().toISOString(),
  };
}

function assertParseableHtml(html) {
  const text = String(html ?? "");
  const lower = text.toLowerCase();
  if (
    text.trim().length < 500 ||
    lower.includes("captcha") ||
    lower.includes("unusual traffic") ||
    lower.includes("access denied") ||
    lower.includes("cf-error") ||
    lower.includes("attention required")
  ) {
    throw new Error(RIGHTMOVE_PARSE_ERROR);
  }
}

function findListingCard($, $anchor) {
  const card = $anchor.closest('[data-testid*="property"], [data-test*="property"], article, li, div').filter((_, element) => {
    const text = $(element).text();
    return text.length > 20;
  }).first();
  return card.length ? card : $anchor.parent();
}

function firstText($, $root, selectors) {
  for (const selector of selectors) {
    const value = clean($root.find(selector).first().text());
    if (value) return value;
  }
  return "";
}

function extractImageUrl($, $card, pageUrl) {
  const attributes = ["src", "data-src", "data-lazy-src", "data-original"];
  const image = $card.find("img").first();
  for (const attribute of attributes) {
    const value = image.attr(attribute);
    const url = normalizeImageUrl(value, pageUrl);
    if (url) return url;
  }
  const srcset = image.attr("srcset") || $card.find("source").first().attr("srcset");
  if (srcset) {
    const first = srcset.split(",").map((part) => part.trim().split(/\s+/)[0]).find(Boolean);
    const url = normalizeImageUrl(first, pageUrl);
    if (url) return url;
  }
  return undefined;
}

function normalizeImageUrl(value, pageUrl) {
  if (!value) return undefined;
  const trimmed = clean(value);
  if (!trimmed || trimmed.startsWith("data:")) return undefined;
  try {
    return new URL(trimmed, pageUrl || RIGHTMOVE_BASE_URL).toString();
  } catch {
    return undefined;
  }
}

function normalizeRightmoveUrl(url, pageUrl) {
  if (!url) return undefined;
  try {
    return new URL(url, pageUrl || RIGHTMOVE_BASE_URL).toString();
  } catch {
    return undefined;
  }
}

function extractPropertyId(url = "") {
  return url.match(/\/properties\/(\d+)/i)?.[1] ?? url.match(/[?&]propertyId=(\d+)/i)?.[1];
}

function extractAddressFromText(text) {
  const lines = text.split(/\n| {2,}/).map(clean).filter(Boolean);
  return lines.find((line) => /\b[A-Z]{1,2}\d[A-Z\d]?\b/i.test(line)) ?? "";
}

function extractRent(text) {
  return text.match(/(\u00a3[\d,]+(?:\.\d+)?\s*(?:pa|per annum|annum|pcm|per month|pw|per week))/i)?.[1] ?? "";
}

function extractSqft(text) {
  return text.match(/([\d,]+(?:\.\d+)?\s*(?:sq\s*ft|sqft|sq\. ft\.?))/i)?.[1] ?? "";
}

function extractListedDate(text) {
  return text.match(/(?:added|listed|marketed)\s+on\s+([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4}|[0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4})/i)?.[1] ?? "";
}

function parseListedDate(value) {
  const slash = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) return new Date(`${slash[3]}-${slash[2].padStart(2, "0")}-${slash[1].padStart(2, "0")}T00:00:00Z`).toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function inferPropertyType(text) {
  const lower = text.toLowerCase();
  if (/industrial|warehouse|logistics|trade counter/.test(lower)) return "Industrial";
  if (/office/.test(lower)) return "Office";
  if (/land|development/.test(lower)) return "Land";
  if (/leisure|restaurant|pub|hotel|gym/.test(lower)) return "Leisure";
  if (/retail|shop|high street/.test(lower)) return "Retail";
  return "";
}

function mapAssetType(value = "") {
  const lower = value.toLowerCase();
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

function parseNumber(value) {
  if (!value) return undefined;
  const lower = String(value).toLowerCase();
  const multiplier = /\bm\b/.test(lower) ? 1_000_000 : /\bk\b/.test(lower) ? 1_000 : 1;
  const match = lower.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  if (!match) return undefined;
  const parsed = Number(match[0]) * multiplier;
  return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
}

function parseGuidePrice(value) {
  const text = clean(value);
  if (!text || /(?:price on application|\bpoa\b)/i.test(text)) return undefined;
  const currencyMatches = [...text.matchAll(/\u00a3\s*(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\s*(?:m|k|million|thousand)?/gi)];
  for (const match of currencyMatches) {
    const snippet = text.slice(match.index ?? 0, (match.index ?? 0) + match[0].length + 25);
    if (/(?:pa|per annum|annum|pcm|per month|monthly)/i.test(snippet)) continue;
    const parsed = parseMoneyAmount(match[0]);
    if (isSensibleGuidePrice(parsed)) return parsed;
  }
  return undefined;
}

function classifyListingIntent({ title = "", price = "", text = "", guidePrice, rent = "" }) {
  const combined = clean(`${title} ${price} ${text}`);
  const lower = combined.toLowerCase();
  const priceLower = String(price ?? "").toLowerCase();
  const isPoa = /(?:price on application|\bpoa|poa\b)/i.test(combined);
  if (isPoa && !guidePrice) return { intent: "sale", skipReason: "skipped_poa" };

  const rentOnlyPrice = hasRentOnlyPrice(priceLower || lower);
  const toLetSignal = /\b(to let|for rent|lease only|lease-only|available to let|rent only)\b/i.test(combined);
  const investmentSignal = /\b(investment|income|yield|let to|let until|tenant|tenanted|passing rent|rental income)\b/i.test(combined);
  const saleSignal = Boolean(guidePrice) || /\b(for sale|freehold|guide price|offers?\s+(?:over|in excess of)|asking price|auction|sale)\b/i.test(combined);

  if ((rentOnlyPrice || toLetSignal) && !saleSignal && !investmentSignal) {
    return { intent: "rent", skipReason: "skipped_rent_only" };
  }
  if ((rentOnlyPrice || rent || investmentSignal) && guidePrice) {
    return { intent: "mixed" };
  }
  if (saleSignal && guidePrice) return { intent: "sale" };
  if (investmentSignal) return { intent: "investment" };
  if (rentOnlyPrice || toLetSignal) return { intent: "rent", skipReason: "skipped_rent_only" };
  return { intent: "unknown" };
}

function hasRentOnlyPrice(text) {
  return /\u00a3\s*\d[\d,]*(?:\.\d+)?\s*(?:pa|per annum|annum|pcm|per month|pw|per week|weekly|monthly)\b/i.test(text);
}

function parseGuidePriceFromLabeledText(text) {
  const labels = [
    /guide\s*price/gi,
    /offers?\s+(?:over|in excess of)/gi,
    /asking\s*price/gi,
    /\bprice\b/gi,
  ];
  for (const label of labels) {
    for (const match of text.matchAll(label)) {
      const start = match.index ?? 0;
      const nearby = text.slice(start, start + 140);
      const parsed = parseGuidePrice(nearby);
      if (parsed !== undefined) return parsed;
    }
  }
  return undefined;
}

function parseMoneyAmount(value) {
  const lower = String(value).toLowerCase();
  const multiplier = /million|\bm\b/.test(lower) ? 1_000_000 : /thousand|\bk\b/.test(lower) ? 1_000 : 1;
  const match = lower.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  if (!match) return undefined;
  const parsed = Number(match[0]) * multiplier;
  return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
}

function isSensibleGuidePrice(value) {
  return Number.isInteger(value) && value >= MIN_GUIDE_PRICE && value <= MAX_GUIDE_PRICE;
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}
