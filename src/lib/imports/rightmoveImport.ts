import {
  buildDedupeKeys,
  extractPostcode,
  type DealImportInput,
  type ParsedImportRow,
  validateImportRow,
} from "@/lib/imports/dealImport";

type RightmoveItem = Record<string, unknown>;

const RIGHTMOVE_BASE_URL = "https://www.rightmove.co.uk";

export function mapRightmoveItemToImportRow(item: RightmoveItem, rowNumber = 1): ParsedImportRow {
  const title = firstString(item, [
    "title",
    "propertyTitle",
    "displayAddress",
    "address",
    "summary",
  ]);
  const location = firstString(item, [
    "location",
    "displayAddress",
    "address",
    "formattedAddress",
    "streetAddress",
  ]);
  const sourceUrl = normalizeRightmoveUrl(firstString(item, [
    "url",
    "propertyUrl",
    "listingUrl",
    "rightmoveUrl",
    "link",
  ]));
  const price = firstNumber(item, ["price", "priceValue", "guidePrice", "rent", "rentPrice"]);
  const rent = firstNumber(item, ["rent", "rentValue", "passingRent", "annualRent"]);
  const sqft = firstNumber(item, ["sizeSqFt", "sizeSqft", "sqft", "floorArea", "areaSqFt"]);
  const propertyType = firstString(item, ["propertyType", "type", "commercialPropertyType"]);
  const postedAt = firstString(item, ["listedAt", "firstVisibleDate", "addedOn", "dateAdded"]);

  const explicitPostcode = firstString(item, ["postcode", "outcode"]) || undefined;
  const normalized: DealImportInput = {
    externalId: firstString(item, ["id", "propertyId", "listingId"]) || sourceUrl || undefined,
    sourceUrl,
    title: title || location || "Rightmove commercial listing",
    location,
    postcode: extractPostcode(location, explicitPostcode),
    region: firstString(item, ["region"]) || "All UK",
    assetType: mapAssetType(propertyType || title),
    source: "Private treaty",
    guidePrice: price,
    passingRent: rent,
    sqft,
    netInitialYield: firstNumber(item, ["netInitialYield", "yield", "niy"]),
    reversionaryYield: firstNumber(item, ["reversionaryYield"]),
    tenant: firstString(item, ["tenant", "occupier"]) || "Unknown",
    covenantStrength: "Moderate",
    mainRiskFlag: "Rightmove import awaiting analyst review",
    postedAt: postedAt ? new Date(postedAt).toISOString() : new Date().toISOString(),
  };

  return {
    rowNumber,
    raw: item,
    normalized,
    validationErrors: validateImportRow(normalized),
    dedupeKeys: buildDedupeKeys(normalized),
  };
}

export function mapRightmoveItemsToImportRows(items: RightmoveItem[]) {
  return items.map((item, index) => mapRightmoveItemToImportRow(item, index + 1));
}

function firstString(item: RightmoveItem, keys: string[]) {
  for (const key of keys) {
    const value = readPath(item, key);
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function firstNumber(item: RightmoveItem, keys: string[]) {
  for (const key of keys) {
    const value = readPath(item, key);
    const parsed = parseMoney(value);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

function readPath(item: RightmoveItem, key: string): unknown {
  if (key in item) return item[key];
  const lowerKey = key.toLowerCase();
  const found = Object.keys(item).find((candidate) => candidate.toLowerCase() === lowerKey);
  if (found) return item[found];
  for (const value of Object.values(item)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = readPath(value as RightmoveItem, key);
      if (nested !== undefined) return nested;
    }
  }
  return undefined;
}

function parseMoney(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const perAnnum = /pa|per annum|annum/i.test(value);
  const cleaned = value
    .replace(/,/g, "")
    .replace(/[\u00a3%]/g, "")
    .replace(/\b(?:pcm|pa|per annum|annum|sq ft|sqft|from|guide price|rent)\b/gi, "")
    .trim();
  const match = cleaned.match(/\d+(?:\.\d+)?/);
  if (!match) return undefined;
  const parsed = Number(match[0]);
  if (!Number.isFinite(parsed)) return undefined;
  return perAnnum ? parsed : parsed;
}

function normalizeRightmoveUrl(url: string) {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${RIGHTMOVE_BASE_URL}${url}`;
  return url.includes("rightmove.co.uk") ? `https://${url}` : undefined;
}

function mapAssetType(value: string) {
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
