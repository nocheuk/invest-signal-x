import { load } from "cheerio";
import { buildDedupeKeys, extractPostcode, validateImportRow } from "./dealImportCore.mjs";

export const ALLSOP_SOURCE_NAME = "Allsop";
export const ALLSOP_SOURCE_TYPE = "auction_scraper";
export const ALLSOP_COMMERCIAL_SEARCH_URL = "https://www.allsop.co.uk/api/property-search?available_only=true&lot_type=commercial&size=100";
export const ALLSOP_COMMERCIAL_PAGE_URL = "https://www.allsop.co.uk/auctions/commercial-auctions/";
export const ALLSOP_PARSE_ERROR = "Allsop page could not be parsed. The custom scraper may need updating.";

const DEFAULT_TIMEOUT_MS = 20000;
const USER_AGENT = "DealSignalImporter/1.0 (+server-side import; contact: dealsignal.co.uk)";

export async function fetchAllsopPayload(url = ALLSOP_COMMERCIAL_SEARCH_URL, { timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: {
        "user-agent": USER_AGENT,
        accept: "application/json,text/html;q=0.8,application/xhtml+xml;q=0.7",
      },
    });
    if (!response.ok) throw new Error(`Allsop fetch failed: ${response.status} ${response.statusText}`);
    const text = await response.text();
    const contentType = response.headers?.get?.("content-type") ?? "";
    if (contentType.includes("application/json") || text.trim().startsWith("{")) return JSON.parse(text);
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

export function withAllsopPage(url, page = 1) {
  const parsed = new URL(url || ALLSOP_COMMERCIAL_SEARCH_URL, "https://www.allsop.co.uk");
  parsed.searchParams.set("page", String(Math.max(1, Number(page) || 1)));
  if (!parsed.searchParams.get("size")) parsed.searchParams.set("size", "100");
  return parsed.toString();
}

export function scrapeAllsopPayloadToImportRows({ payload, pageUrl = ALLSOP_COMMERCIAL_SEARCH_URL, sourceName = ALLSOP_SOURCE_NAME }) {
  const listings = Array.isArray(payload?.data?.results)
    ? payload.data.results.map((item) => parseAllsopApiItem(item, pageUrl)).filter(Boolean)
    : parseAllsopHtmlListings({ html: String(payload ?? ""), pageUrl });
  if (!listings.length) throw new Error(ALLSOP_PARSE_ERROR);
  return listings.map((listing, index) => {
    const normalized = normalizeAllsopListing(listing);
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

export function filterAllsopAcquisitionRows(rows) {
  const importRows = [];
  const skipped = [];
  for (const row of rows) {
    if (row.raw.listing_intent === "non_commercial") {
      skipped.push({ row, reason: "skipped_non_commercial" });
      continue;
    }
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

export function allPagesFromPayload(payload, maxPages = 2) {
  const total = Number(payload?.data?.total ?? 0);
  const pageSize = Array.isArray(payload?.data?.results) ? payload.data.results.length : 0;
  if (!total || !pageSize || maxPages <= 1) return [1];
  return Array.from({ length: Math.min(maxPages, Math.ceil(total / pageSize)) }, (_, index) => index + 1);
}

function parseAllsopApiItem(item, pageUrl) {
  if (!item || typeof item !== "object") return null;
  const summary = extractDraftText(item.investment_summary_editor) || clean(item.investment_summary);
  const location = clean(item.allsop_address || [item.address1, item.address2, item.town, item.postcode].filter(Boolean).join(", "));
  const title = clean(item.main_byline || item.allsop_propertybyline || item.allsop_address || "Allsop auction lot");
  const assetTypes = [
    ...(Array.isArray(item.commercial_property_types) ? item.commercial_property_types : []),
    ...(Array.isArray(item.property_types) ? item.property_types : []),
  ].filter(Boolean);
  const guidePrice = parseMoney(item.price ?? item.sort_price);
  const passingRent = parsePassingRent(summary);
  const yieldValue = parseYield(summary);
  const sqft = parseSize(summary);
  const sourceUrl = buildAllsopOverviewUrl(item);
  const listingIntent = classifyAllsopIntent(item, { guidePrice, summary });

  return {
    raw: {
      external_id: item.reference || item.allsop_name || item.property_id || sourceUrl,
      reference: item.reference,
      lot_number: item.lot_number_text || item.lot_number || extractLotNumber(item.allsop_name || item.reference || ""),
      source_url: sourceUrl,
      image_file_id: item.image_file_id,
      image_url: imageUrlFromId(item.image_file_id),
      title,
      location,
      guide_price: item.price ?? item.sort_price ?? "",
      price_description: item.price_description,
      passing_rent: passingRent,
      yield: yieldValue,
      sqft,
      asset_type: assetTypes.join(", "),
      description: summary,
      department: item.department,
      sales_status: item.sales_status_websearch || item.sales_status,
      listing_intent: listingIntent,
      payload: item,
    },
    externalId: String(item.reference || item.allsop_name || item.property_id || sourceUrl),
    sourceUrl,
    imageUrl: imageUrlFromId(item.image_file_id),
    title,
    location,
    postcode: clean(item.postcode),
    region: clean(Array.isArray(item.region) ? item.region.join(", ") : item.region) || "All UK",
    assetTypeText: assetTypes.join(" "),
    guidePrice,
    passingRent,
    yieldValue,
    sqft,
    description: summary,
    postedAt: normalizeDate(item.market_from_date || item.property_created_at),
    listingIntent,
  };
}

function parseAllsopHtmlListings({ html, pageUrl }) {
  const $ = load(html ?? "");
  return $(".__lot_container").toArray().map((card) => {
    const $card = $(card);
    const $link = $card.find("a[href]").first();
    const sourceUrl = normalizeUrl($link.attr("href"), pageUrl);
    const title = clean($card.find(".__byline").first().text() || $link.attr("title"));
    const location = clean($card.find(".__location").first().text() || $link.attr("title"));
    const tag = clean($card.find(".__tag").first().text());
    const priceText = clean($card.find(".__lot_price, .__lot_price_text, h3").first().text());
    const imageStyle = $card.find(".__image_div").first().attr("style") || "";
    const imageUrl = normalizeUrl(imageStyle.match(/url\(['"]?([^'")]+)['"]?\)/i)?.[1], pageUrl);
    const guidePrice = parseMoney(priceText);
    return {
      raw: {
        external_id: tag || sourceUrl,
        lot_number: extractLotNumber(tag),
        source_url: sourceUrl,
        image_url: imageUrl,
        title,
        location,
        guide_price: priceText,
        asset_type: tag,
        listing_intent: guidePrice ? "sale" : "unknown",
      },
      externalId: tag || sourceUrl,
      sourceUrl,
      imageUrl,
      title,
      location,
      assetTypeText: tag,
      guidePrice,
      listingIntent: guidePrice ? "sale" : "unknown",
    };
  }).filter((item) => item.sourceUrl && item.title);
}

function normalizeAllsopListing(listing) {
  return {
    externalId: listing.externalId,
    sourceUrl: listing.sourceUrl,
    imageUrl: listing.imageUrl || undefined,
    title: listing.title || "Allsop commercial auction lot",
    location: listing.location,
    postcode: listing.postcode || extractPostcode(listing.location),
    region: listing.region || "All UK",
    assetType: normalizeAssetType(listing.assetTypeText || listing.title || listing.description),
    source: "Auction",
    guidePrice: listing.guidePrice,
    passingRent: listing.passingRent,
    netInitialYield: listing.yieldValue,
    sqft: listing.sqft,
    tenant: inferTenant(listing.description),
    covenantStrength: "Moderate",
    mainRiskFlag: "Allsop auction import awaiting legal pack and tenancy verification",
    description: listing.description,
    postedAt: listing.postedAt || new Date().toISOString(),
  };
}

function classifyAllsopIntent(item, { guidePrice, summary }) {
  const sourceText = clean([
    item.department,
    item.sales_status_websearch,
    item.sales_status,
    item.price_description,
    item.price,
    summary,
  ].filter(Boolean).join(" "));
  if (item.department && String(item.department).toUpperCase() !== "COMM") return "non_commercial";
  if (/price\s+on\s+application|\bpoa\b|refer\s+to\s+auctioneer/i.test(sourceText) && !guidePrice) return "poa";
  if (/\bto\s+let\b|\bleasehold\s+office\s+to\s+let\b/i.test(sourceText) && !guidePrice) return "rent";
  if (/for\s+sale|auction|guide|offers|freehold|long leasehold/i.test(sourceText) || guidePrice) return "sale";
  return "unknown";
}

function parsePassingRent(value) {
  const text = clean(value);
  if (!text) return undefined;
  const patterns = [
    /(?:passing|current|total current|rent reserved|rental income|rent)\D{0,40}£\s*([\d,]+(?:\.\d+)?)/i,
    /£\s*([\d,]+(?:\.\d+)?)\s*(?:per\s+annum|pa\b)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const parsed = parseMoney(match?.[1]);
    if (parsed) return parsed;
  }
  return undefined;
}

function parseYield(value) {
  const text = clean(value);
  const match = text.match(/(?:net\s+initial\s+yield|initial\s+yield|yield|reflecting)\D{0,30}(\d+(?:\.\d+)?)\s*%/i);
  if (!match) return undefined;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseMoney(value) {
  if (value === null || value === undefined || /price\s+on\s+application|\bpoa\b/i.test(String(value))) return undefined;
  if (typeof value === "number") {
    const rounded = Math.round(value);
    return Number.isSafeInteger(rounded) ? rounded : undefined;
  }
  const match = String(value).replace(/,/g, "").match(/£?\s*(\d{4,}(?:\.\d+)?)/i);
  if (!match) return undefined;
  const parsed = Math.round(Number(match[1]));
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function parseSize(value) {
  const text = clean(value).replace(/,/g, "");
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|square feet|gia|nia)/i);
  if (!match) return undefined;
  const parsed = Math.round(Number(match[1]));
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function inferTenant(value) {
  const match = clean(value).match(/\blet\s+to\s+([^.,;]+?)(?:\s+on\s+|\s+until\s+|$)/i);
  return clean(match?.[1]) || "Unknown";
}

function extractDraftText(value) {
  if (!value) return "";
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(parsed?.blocks)) return "";
    return parsed.blocks.map((block) => clean(block.text)).filter(Boolean).join(" ");
  } catch {
    return clean(value);
  }
}

function imageUrlFromId(id) {
  return id ? `https://www.allsop.co.uk/api/image/${id}/703/527` : "";
}

function buildAllsopOverviewUrl(item) {
  const reference = clean(item.reference || item.allsop_name || item.property_id);
  const byline = clean(item.main_byline || item.allsop_propertybyline || "commercial investment");
  const town = clean(item.town || extractPostcode(item.allsop_address || "") || "uk");
  const path = item.allsop_name && /^c\d/i.test(String(item.allsop_name)) ? "lot-overview" : "investment-overview";
  return `https://www.allsop.co.uk/${path}/${slug(`${byline} in ${town}`)}/${encodeURIComponent(reference).replace(/%20/g, "-").toLowerCase()}`;
}

function normalizeDate(value) {
  if (!value) return new Date().toISOString();
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function normalizeAssetType(value) {
  const lower = String(value ?? "").toLowerCase();
  if (/industrial|warehouse|logistics|trade counter/.test(lower)) return "Industrial";
  if (/office/.test(lower)) return "Office";
  if (/land|development|site/.test(lower)) return "Land";
  if (/leisure|restaurant|pub|hotel|gym|cinema/.test(lower)) return "Leisure";
  if (/health|medical|surgery|clinic|care/.test(lower)) return "Healthcare";
  if (/roadside|drive.?thru|petrol|motor/.test(lower)) return "Roadside";
  if (/mixed|residential/.test(lower)) return "Mixed-use";
  if (/convenience|foodstore|supermarket/.test(lower)) return "Convenience";
  return "Retail";
}

function extractLotNumber(value) {
  return clean(value).match(/\blot\s*([A-Z]?\d+[A-Z]?)\b/i)?.[1] || clean(value).match(/\bC\d{6}-(\d+[A-Z]?)\b/i)?.[1] || "";
}

function normalizeUrl(url, pageUrl) {
  if (!url) return "";
  try {
    return new URL(url, pageUrl).toString();
  } catch {
    return "";
  }
}

function slug(value) {
  return clean(value).replace(/[^a-zA-Z0-9\s]/g, "").replace(/[\s]+/g, "-").toLowerCase();
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}
