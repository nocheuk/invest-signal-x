export type ImportStatus = "pending" | "processed" | "failed" | "skipped_duplicate";

export type DealImportInput = {
  externalId?: string;
  sourceUrl?: string;
  imageUrl?: string;
  title: string;
  location: string;
  postcode?: string;
  region?: string;
  assetType?: string;
  source?: string;
  guidePrice?: number;
  passingRent?: number;
  sqft?: number;
  grossYield?: number;
  netInitialYield?: number;
  reversionaryYield?: number;
  wault?: number;
  leaseLength?: number;
  tenant?: string;
  covenantStrength?: string;
  tenantHealthScore?: number;
  rentSustainability?: string;
  rentReview?: string;
  pricePerSqft?: number;
  planningUpsideScore?: number;
  voidRiskScore?: number;
  exitYieldSensitivity?: string;
  cashflowAfterDebt?: number;
  returnOnEquity?: number;
  auctionGuideRisk?: string;
  redFlags?: string[];
  mainRiskFlag?: string;
  description?: string;
  postedAt?: string;
};

export type ParsedImportRow = {
  rowNumber: number;
  raw: Record<string, unknown>;
  normalized: DealImportInput;
  validationErrors: string[];
  dedupeKeys: {
    sourceUrl?: string;
    titlePostcode?: string;
    titlePriceLocation?: string;
  };
};

export type ExistingDealForDedupe = {
  id: string;
  title: string;
  location: string;
  guidePrice?: number;
  sourceUrl?: string | null;
};

export type DuplicateMatch = {
  dealId: string;
  rule: "source_url" | "title_postcode" | "title_price_location";
};

export type ImportRowDuplicate = {
  row: ParsedImportRow;
  duplicateOfRowNumber: number;
  rule: "external_id" | "source_url" | "dedupe_key";
  key: string;
};

export const DEAL_IMPORT_HEADERS = [
  "external_id",
  "source_url",
  "image_url",
  "title",
  "location",
  "postcode",
  "region",
  "asset_type",
  "source",
  "guide_price",
  "passing_rent",
  "sqft",
  "net_initial_yield",
  "reversionary_yield",
  "wault",
  "tenant",
  "covenant_strength",
  "main_risk_flag",
] as const;

const ASSET_TYPES = ["Retail", "Office", "Industrial", "Leisure", "Mixed-use", "Land", "Healthcare", "Roadside", "Convenience"];
const SOURCES = ["Auction", "Private treaty", "Off-market", "Receiver sale"];
const COVENANTS = ["Strong", "Good", "Moderate", "Weak", "Vacant"];
const RENT_SUSTAINABILITY = ["Under-rented", "Market rent", "Over-rented"];
const RENT_REVIEWS = ["Upward-only", "Fixed uplift", "CPI/RPI linked", "Open market", "None"];
const EXIT_SENSITIVITY = ["Low", "Moderate", "High"];
export const MIN_GUIDE_PRICE = 1_000;
export const MAX_GUIDE_PRICE = 500_000_000;

function canonicalHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function pick(raw: Record<string, string>, ...keys: string[]) {
  for (const key of keys) {
    const value = raw[canonicalHeader(key)];
    if (value !== undefined && value.trim() !== "") return value.trim();
  }
  return "";
}

function parseNumber(value: string) {
  if (!value) return undefined;
  const cleaned = String(value).replace(/,/g, "").replace(/gbp/gi, "").replace(/[£%]/g, " ").trim();
  if (!cleaned) return undefined;
  const match = cleaned.match(/\d+(?:\.\d+)?/);
  if (!match) return undefined;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function splitList(value: string) {
  return value
    .split(/[|;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function asOption(value: string | undefined, allowed: string[], fallback: string) {
  if (!value) return fallback;
  const match = allowed.find((item) => item.toLowerCase() === value.toLowerCase());
  return match ?? fallback;
}

export function extractPostcode(location: string, explicitPostcode?: string) {
  if (explicitPostcode?.trim()) return explicitPostcode.trim().toUpperCase();
  const full = location.match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i);
  if (full) return full[0].toUpperCase().replace(/\s+/, " ");
  const outward = location.match(/\b[A-Z]{1,2}\d[A-Z\d]?\b/i);
  return outward ? outward[0].toUpperCase() : undefined;
}

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function moneyKey(value?: number) {
  return Math.round(value ?? 0).toString();
}

export function buildDedupeKeys(row: DealImportInput) {
  const title = normalizeText(row.title);
  const location = normalizeText(row.location);
  const postcode = extractPostcode(row.location, row.postcode);
  return {
    sourceUrl: row.sourceUrl ? normalizeText(row.sourceUrl) : undefined,
    titlePostcode: postcode ? `${title}|${postcode}` : undefined,
    titlePriceLocation: row.guidePrice ? `${title}|${moneyKey(row.guidePrice)}|${location}` : undefined,
  };
}

export function dedupeImportRows(rows: ParsedImportRow[]) {
  const uniqueRows: ParsedImportRow[] = [];
  const duplicateRows: ImportRowDuplicate[] = [];
  const seen = new Map<string, { row: ParsedImportRow; index: number; rule: ImportRowDuplicate["rule"]; key: string }>();

  for (const row of rows) {
    const key = importRowIdentityKey(row);
    if (!key) {
      uniqueRows.push(row);
      continue;
    }

    const existing = seen.get(key.identity);
    if (!existing) {
      seen.set(key.identity, { row, index: uniqueRows.length, rule: key.rule, key: key.value });
      uniqueRows.push(row);
      continue;
    }

    const existingIsValid = existing.row.validationErrors.length === 0;
    const currentIsValid = row.validationErrors.length === 0;
    if (!existingIsValid && currentIsValid) {
      duplicateRows.push({
        row: existing.row,
        duplicateOfRowNumber: row.rowNumber,
        rule: existing.rule,
        key: existing.key,
      });
      uniqueRows[existing.index] = row;
      seen.set(key.identity, { row, index: existing.index, rule: key.rule, key: key.value });
      continue;
    }

    duplicateRows.push({
      row,
      duplicateOfRowNumber: existing.row.rowNumber,
      rule: key.rule,
      key: key.value,
    });
  }

  return { uniqueRows, duplicateRows };
}

export function parseDealCsv(csv: string) {
  const records = parseCsvRecords(csv);
  if (records.length === 0) return [];
  const headers = records[0].map(canonicalHeader);
  return records.slice(1).filter((record) => record.some((cell) => cell.trim())).map((record, index) => {
    const raw = Object.fromEntries(headers.map((header, columnIndex) => [header, record[columnIndex]?.trim() ?? ""]));
    return normalizeImportRow(raw, index + 2);
  });
}

export function normalizeImportRow(rawInput: Record<string, string>, rowNumber = 1): ParsedImportRow {
  const raw = Object.fromEntries(Object.entries(rawInput).map(([key, value]) => [canonicalHeader(key), value ?? ""]));
  const explicitPostcode = pick(raw, "postcode", "post_code", "postal_code");
  const location = pick(raw, "location", "address");
  const normalized: DealImportInput = {
    externalId: pick(raw, "external_id", "external id", "id") || undefined,
    sourceUrl: pick(raw, "source_url", "url", "listing_url") || undefined,
    imageUrl: pick(raw, "image_url", "image", "photo", "photo_url", "thumbnail", "thumbnail_url") || undefined,
    title: pick(raw, "title", "deal_title", "property_title"),
    location,
    postcode: extractPostcode(location, explicitPostcode),
    region: pick(raw, "region") || "All UK",
    assetType: asOption(pick(raw, "asset_type", "asset"), ASSET_TYPES, "Retail"),
    source: asOption(pick(raw, "source", "channel"), SOURCES, "Private treaty"),
    guidePrice: parseNumber(pick(raw, "guide_price", "price", "asking_price")),
    passingRent: parseNumber(pick(raw, "passing_rent", "rent")),
    sqft: parseNumber(pick(raw, "sqft", "area_sqft", "size")),
    grossYield: parseNumber(pick(raw, "gross_yield")),
    netInitialYield: parseNumber(pick(raw, "net_initial_yield", "niy")),
    reversionaryYield: parseNumber(pick(raw, "reversionary_yield")),
    wault: parseNumber(pick(raw, "wault")),
    leaseLength: parseNumber(pick(raw, "lease_length")),
    tenant: pick(raw, "tenant") || "Unknown",
    covenantStrength: asOption(pick(raw, "covenant_strength", "covenant"), COVENANTS, "Moderate"),
    tenantHealthScore: parseNumber(pick(raw, "tenant_health_score")),
    rentSustainability: asOption(pick(raw, "rent_sustainability"), RENT_SUSTAINABILITY, "Market rent"),
    rentReview: asOption(pick(raw, "rent_review"), RENT_REVIEWS, "None"),
    pricePerSqft: parseNumber(pick(raw, "price_per_sqft")),
    planningUpsideScore: parseNumber(pick(raw, "planning_upside_score")),
    voidRiskScore: parseNumber(pick(raw, "void_risk_score")),
    exitYieldSensitivity: asOption(pick(raw, "exit_yield_sensitivity"), EXIT_SENSITIVITY, "Moderate"),
    cashflowAfterDebt: parseNumber(pick(raw, "cashflow_after_debt")),
    returnOnEquity: parseNumber(pick(raw, "return_on_equity")),
    auctionGuideRisk: asOption(pick(raw, "auction_guide_risk"), EXIT_SENSITIVITY, "") || undefined,
    redFlags: splitList(pick(raw, "red_flags", "risk_flags")),
    mainRiskFlag: pick(raw, "main_risk_flag", "risk") || "Manual import pending review",
    description: pick(raw, "description", "snippet", "summary") || undefined,
    postedAt: pick(raw, "posted_at", "listed_at") || new Date().toISOString(),
  };
  const validationErrors = validateImportRow(normalized);
  return { rowNumber, raw, normalized, validationErrors, dedupeKeys: buildDedupeKeys(normalized) };
}

export function validateImportRow(row: DealImportInput) {
  const errors: string[] = [];
  if (!row.title) errors.push("title is required");
  if (!row.location) errors.push("location is required");
  if (!row.guidePrice || row.guidePrice <= 0) errors.push("guide_price must be greater than 0");
  else if (!isSafeGuidePrice(row.guidePrice)) errors.push(`guide_price must be a safe integer between ${MIN_GUIDE_PRICE} and ${MAX_GUIDE_PRICE}`);
  if (row.assetType && !ASSET_TYPES.includes(row.assetType)) errors.push(`asset_type must be one of: ${ASSET_TYPES.join(", ")}`);
  if (row.source && !SOURCES.includes(row.source)) errors.push(`source must be one of: ${SOURCES.join(", ")}`);
  if (row.sourceUrl && !/^https?:\/\//i.test(row.sourceUrl)) errors.push("source_url must start with http:// or https://");
  if (row.imageUrl && !/^https?:\/\//i.test(row.imageUrl)) errors.push("image_url must start with http:// or https://");
  return errors;
}

export function isSafeGuidePrice(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= MIN_GUIDE_PRICE && Number(value) <= MAX_GUIDE_PRICE;
}

function isSafeNonNegativeNumber(value: unknown, max = MAX_GUIDE_PRICE): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= max;
}

export function findDuplicate(row: DealImportInput, existingDeals: ExistingDealForDedupe[]): DuplicateMatch | null {
  const keys = buildDedupeKeys(row);
  for (const existing of existingDeals) {
    if (keys.sourceUrl && existing.sourceUrl && normalizeText(existing.sourceUrl) === keys.sourceUrl) {
      return { dealId: existing.id, rule: "source_url" };
    }
  }
  for (const existing of existingDeals) {
    const existingPostcode = extractPostcode(existing.location);
    if (keys.titlePostcode && existingPostcode && `${normalizeText(existing.title)}|${existingPostcode}` === keys.titlePostcode) {
      return { dealId: existing.id, rule: "title_postcode" };
    }
  }
  for (const existing of existingDeals) {
    const existingKey = `${normalizeText(existing.title)}|${moneyKey(existing.guidePrice)}|${normalizeText(existing.location)}`;
    if (keys.titlePriceLocation && existingKey === keys.titlePriceLocation) {
      return { dealId: existing.id, rule: "title_price_location" };
    }
  }
  return null;
}

export function mapImportToDealInsert(row: DealImportInput, sourceName = "Manual import") {
  const passingRent = isSafeNonNegativeNumber(row.passingRent) ? row.passingRent : 0;
  const guidePrice = isSafeGuidePrice(row.guidePrice) ? row.guidePrice : 0;
  const sqft = isSafeNonNegativeNumber(row.sqft) ? row.sqft : 0;
  const grossYield = row.grossYield ?? (guidePrice > 0 ? (passingRent / guidePrice) * 100 : 0);
  const netInitialYield = row.netInitialYield ?? Math.max(0, grossYield * 0.93);
  const reversionaryYield = row.reversionaryYield ?? netInitialYield;
  const pricePerSqft = row.pricePerSqft ?? (sqft > 0 ? Math.round(guidePrice / sqft) : 0);
  const tenantHealthScore = clamp(row.tenantHealthScore ?? covenantScore(row.covenantStrength));
  const voidRiskScore = clamp(row.voidRiskScore ?? defaultVoidRisk(row.covenantStrength));
  const planningUpsideScore = clamp(row.planningUpsideScore ?? 40);
  const scoreBreakdown = {
    incomeQuality: clamp(netInitialYield * 10 + (passingRent > 0 ? 10 : 0)),
    tenantSecurity: tenantHealthScore,
    marketPricing: clamp(pricePerSqft > 0 ? 70 : 45),
    upside: planningUpsideScore,
    riskExit: clamp(100 - voidRiskScore),
  };
  const score = Math.round(
    scoreBreakdown.incomeQuality * 0.25 +
      scoreBreakdown.tenantSecurity * 0.25 +
      scoreBreakdown.marketPricing * 0.2 +
      scoreBreakdown.upside * 0.15 +
      scoreBreakdown.riskExit * 0.15
  );

  return {
    id: makeDealId(row),
    title: row.title,
    location: row.location,
    region: row.region || "All UK",
    asset_type: row.assetType || "Retail",
    source: row.source || "Private treaty",
    guide_price: guidePrice,
    passing_rent: passingRent,
    sqft,
    gross_yield: grossYield,
    net_initial_yield: netInitialYield,
    reversionary_yield: reversionaryYield,
    wault: row.wault ?? 0,
    lease_length: row.leaseLength ?? row.wault ?? 0,
    tenant: row.tenant || "Unknown",
    covenant_strength: row.covenantStrength || "Moderate",
    tenant_health_score: tenantHealthScore,
    rent_sustainability: row.rentSustainability || "Market rent",
    rent_review: row.rentReview || "None",
    price_per_sqft: pricePerSqft,
    planning_upside_score: planningUpsideScore,
    void_risk_score: voidRiskScore,
    exit_yield_sensitivity: row.exitYieldSensitivity || "Moderate",
    cashflow_after_debt: row.cashflowAfterDebt ?? 0,
    return_on_equity: row.returnOnEquity ?? 0,
    auction_guide_risk: row.auctionGuideRisk ?? null,
    red_flags: row.redFlags ?? [],
    main_risk_flag: row.mainRiskFlag || "Manual import pending review",
    score,
    rating: score >= 78 ? "green" : score >= 60 ? "amber" : "red",
    score_breakdown: scoreBreakdown,
    insights: {
      mispricing: "Imported row awaiting analyst review.",
      couldGoWrong: row.mainRiskFlag || "Source data has not been fully underwritten.",
      askAgent: "Confirm lease, rent, title, EPC and tenancy details against source documents.",
      negotiation: "Set target pricing after validation against comparables.",
    },
    thumbnail: row.imageUrl || "from-cyan-500/30 to-blue-700/20",
    posted_at: row.postedAt || new Date().toISOString(),
    import_source_name: sourceName,
  };
}

export function importRowsToCsv(rows: DealImportInput[]) {
  const header = DEAL_IMPORT_HEADERS.join(",");
  const lines = rows.map((row) => [
    row.externalId ?? "",
    row.sourceUrl ?? "",
    row.imageUrl ?? "",
    row.title,
    row.location,
    row.postcode ?? "",
    row.region ?? "",
    row.assetType ?? "",
    row.source ?? "",
    row.guidePrice ?? "",
    row.passingRent ?? "",
    row.sqft ?? "",
    row.netInitialYield ?? "",
    row.reversionaryYield ?? "",
    row.wault ?? "",
    row.tenant ?? "",
    row.covenantStrength ?? "",
    row.mainRiskFlag ?? "",
  ].map(csvEscape).join(","));
  return [header, ...lines].join("\n");
}

function importRowIdentityKey(row: ParsedImportRow) {
  if (row.normalized.externalId) {
    const value = normalizeText(row.normalized.externalId);
    return { identity: `external_id:${value}`, rule: "external_id" as const, value };
  }
  if (row.normalized.sourceUrl) {
    const value = normalizeText(row.normalized.sourceUrl);
    return { identity: `source_url:${value}`, rule: "source_url" as const, value };
  }
  const fallback = row.dedupeKeys.titlePostcode || row.dedupeKeys.titlePriceLocation;
  if (!fallback) return null;
  return { identity: `dedupe_key:${fallback}`, rule: "dedupe_key" as const, value: fallback };
}

function parseCsvRecords(csv: string) {
  const records: string[][] = [];
  let record: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      record.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      record.push(cell);
      records.push(record);
      record = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  record.push(cell);
  records.push(record);
  return records.filter((row) => row.some((value) => value.trim()));
}

function csvEscape(value: string | number) {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function makeDealId(row: DealImportInput) {
  const seed = row.externalId || row.sourceUrl || `${row.title}|${row.location}|${row.guidePrice}`;
  return `imp-${hash(seed)}`;
}

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function covenantScore(value?: string) {
  if (value === "Strong") return 90;
  if (value === "Good") return 76;
  if (value === "Weak") return 38;
  if (value === "Vacant") return 10;
  return 60;
}

function defaultVoidRisk(value?: string) {
  if (value === "Strong") return 12;
  if (value === "Good") return 22;
  if (value === "Weak") return 68;
  if (value === "Vacant") return 85;
  return 40;
}
