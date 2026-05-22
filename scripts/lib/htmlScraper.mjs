import { load } from "cheerio";
import { buildDedupeKeys, extractPostcode, validateImportRow } from "./dealImportCore.mjs";

export const SCRAPER_ADAPTER_VERSION = "custom-html-v1";

export async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "DealSignalImporter/1.0 (+server-side import)",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) {
    throw new Error(`HTML fetch failed: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

export function scrapeHtmlToImportRows({ html, pageUrl, config, sourceName = "Custom HTML scraper" }) {
  const normalizedConfig = normalizeSelectorConfig(config);
  const $ = load(html);
  const cards = $(normalizedConfig.listingCardSelector).toArray();

  return cards.map((card, index) => {
    const $card = $(card);
    const raw = {
      source_name: sourceName,
      page_url: pageUrl,
      title: readText($, $card, normalizedConfig.titleSelector),
      source_url: readUrl($, $card, normalizedConfig.urlSelector, pageUrl),
      image_url: readUrl($, $card, normalizedConfig.imageSelector, pageUrl),
      location: readText($, $card, normalizedConfig.locationSelector),
      guide_price: readText($, $card, normalizedConfig.priceSelector),
      passing_rent: readText($, $card, normalizedConfig.rentSelector),
      net_initial_yield: readText($, $card, normalizedConfig.yieldSelector),
      sqft: readText($, $card, normalizedConfig.sizeSelector),
      asset_type: readText($, $card, normalizedConfig.propertyTypeSelector),
      description: readText($, $card, normalizedConfig.descriptionSelector),
    };
    const normalized = {
      externalId: raw.source_url || `${pageUrl}#row-${index + 1}`,
      sourceUrl: raw.source_url || undefined,
      imageUrl: raw.image_url || undefined,
      title: raw.title || raw.description || "Imported commercial listing",
      location: raw.location,
      postcode: extractPostcode(raw.location),
      region: normalizedConfig.region || "All UK",
      assetType: normalizeAssetType(raw.asset_type || raw.title || raw.description),
      source: normalizedConfig.source || "Private treaty",
      guidePrice: parseNumber(raw.guide_price),
      passingRent: parseNumber(raw.passing_rent),
      netInitialYield: parseNumber(raw.net_initial_yield),
      sqft: parseNumber(raw.sqft),
      tenant: "Unknown",
      covenantStrength: "Moderate",
      mainRiskFlag: "Custom scraper import awaiting analyst review",
      postedAt: new Date().toISOString(),
    };

    return {
      rowNumber: index + 1,
      raw,
      normalized,
      validationErrors: validateImportRow(normalized),
      dedupeKeys: buildDedupeKeys(normalized),
    };
  });
}

export function normalizeSelectorConfig(config) {
  const selectors = config.selectors ?? config;
  if (!selectors.listingCardSelector && !selectors.listing) {
    throw new Error("selector config requires listingCardSelector");
  }
  return {
    listingCardSelector: selectors.listingCardSelector ?? selectors.listing,
    titleSelector: normalizeFieldSelector(selectors.titleSelector ?? selectors.title),
    urlSelector: normalizeFieldSelector(selectors.urlSelector ?? selectors.url),
    imageSelector: normalizeFieldSelector(selectors.imageSelector ?? selectors.image),
    locationSelector: normalizeFieldSelector(selectors.locationSelector ?? selectors.location),
    priceSelector: normalizeFieldSelector(selectors.priceSelector ?? selectors.price),
    rentSelector: normalizeFieldSelector(selectors.rentSelector ?? selectors.rent),
    yieldSelector: normalizeFieldSelector(selectors.yieldSelector ?? selectors.yield),
    sizeSelector: normalizeFieldSelector(selectors.sizeSelector ?? selectors.size),
    propertyTypeSelector: normalizeFieldSelector(selectors.propertyTypeSelector ?? selectors.propertyType),
    descriptionSelector: normalizeFieldSelector(selectors.descriptionSelector ?? selectors.description),
    region: config.defaults?.region ?? config.region,
    source: config.defaults?.source ?? config.source,
  };
}

function normalizeFieldSelector(value) {
  if (!value) return null;
  if (typeof value === "string") return { selector: value };
  return value;
}

function readText($, $card, field) {
  if (!field?.selector) return "";
  const element = $card.find(field.selector).first();
  if (field.attribute) return clean(element.attr(field.attribute) ?? "");
  const html = element.html();
  if (html) return clean(load(`<div>${html.replace(/<br\s*\/?>/gi, " ")}</div>`)("div").text());
  return clean(element.text());
}

function readUrl($, $card, field, pageUrl) {
  const value = readText($, $card, { selector: field?.selector, attribute: field?.attribute ?? "href" });
  if (!value) return "";
  try {
    return new URL(value, pageUrl).toString();
  } catch {
    return value;
  }
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function parseNumber(value) {
  if (!value) return undefined;
  const match = String(value).replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  if (!match) return undefined;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
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
