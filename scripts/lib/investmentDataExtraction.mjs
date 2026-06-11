const MONEY = "(?:£|GBP|gbp|Â£)\\s*(\\d{1,3}(?:,\\d{3})+|\\d{4,})(?:\\.\\d+)?";
const MONTHS = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

export function extractInvestmentFacts({ text = "", title = "", description = "", payload = {}, now = new Date() } = {}) {
  const sourceText = flattenText([title, description, text, payload]);
  const tenantName = extractTenantName(sourceText);
  const passingRent = extractPassingRent(sourceText);
  const leaseExpiry = extractLeaseExpiry(sourceText);
  const leaseYears = leaseExpiry ? yearsUntil(leaseExpiry.date, now) : extractLeaseLength(sourceText);
  const rentReviews = extractRentReviews(sourceText);
  const covenantStrength = inferCovenantStrength(tenantName, sourceText);

  return {
    tenantName,
    passingRent,
    leaseExpiryText: leaseExpiry?.label,
    leaseExpiryDate: leaseExpiry?.date.toISOString(),
    leaseLength: leaseYears,
    wault: tenantName && leaseYears ? leaseYears : undefined,
    rentReviewDates: rentReviews.map((review) => review.year),
    rentReviewAmounts: rentReviews.map((review) => review.amount),
    rentReviews,
    covenantStrength,
    covenantVerified: covenantStrength && covenantStrength !== "Moderate",
    sourceText,
  };
}

export function extractTenantName(text) {
  const source = clean(text);
  const patterns = [
    /\b(?:let|leased|sold subject)\s+to\s+([^.;\n\r]{3,100}?)(?=\s+(?:until|for|on\s+a|at\s+a|producing|with|subject|expir|from|$)|[.;\n\r])/i,
    /\btenant(?:\s+name)?\s*[:\-]\s*([^.;\n\r]{3,100})/i,
    /\boccupied\s+by\s+([^.;\n\r]{3,100}?)(?=\s+(?:until|for|on\s+a|at\s+a|producing|with|subject|expir|from|$)|[.;\n\r])/i,
  ];
  for (const pattern of patterns) {
    const value = trimFact(source.match(pattern)?.[1] ?? "");
    if (isUsefulTenant(value)) return value;
  }
  return undefined;
}

export function extractPassingRent(text) {
  const source = clean(text);
  const contexts = [
    /\b(?:current\s+)?passing\s+rent\D{0,45}(?:of\s+)?(?:£|GBP|gbp|Â£)\s*(\d{1,3}(?:,\d{3})+|\d{4,})(?:\.\d+)?\s*(?:pa|per\s+annum|annum|p\.?a\.?)\b/i,
    /\b(?:gross\s+rental\s+income|rental\s+income|current\s+rent|rent\s+passing|producing)\D{0,45}(?:of\s+)?(?:£|GBP|gbp|Â£)\s*(\d{1,3}(?:,\d{3})+|\d{4,})(?:\.\d+)?\s*(?:pa|per\s+annum|annum|p\.?a\.?)\b/i,
    /\brent\s+(?:of\s+)?(?:£|GBP|gbp|Â£)\s*(\d{1,3}(?:,\d{3})+|\d{4,})(?:\.\d+)?\s*(?:pa|per\s+annum|annum|p\.?a\.?)\b/i,
    new RegExp(`${MONEY}\\s*(?:pa|per\\s+annum|annum|p\\.?a\\.?)\\b\\D{0,35}\\b(?:passing\\s+rent|rental\\s+income|current\\s+rent)`, "i"),
  ];
  for (const pattern of contexts) {
    const match = source.match(pattern);
    if (!match) continue;
    const context = source.slice(Math.max(0, (match.index ?? 0) - 80), Math.min(source.length, (match.index ?? 0) + 120));
    if (/rent\s+review|review|increase|fixed\s+rental|uplift/i.test(context) && !/passing\s+rent|current\s+rent|rental\s+income|rent\s+passing|producing/i.test(context)) continue;
    const amount = parseMoneyMatch(match[1]);
    if (amount) return amount;
  }
  return undefined;
}

export function extractLeaseExpiry(text) {
  const source = clean(text);
  const patterns = [
    /\b(?:let|leased)[^.;\n\r]{0,120}?\buntil\s+([0-3]?\d\s+[A-Za-z]+\s+\d{4}|[A-Za-z]+\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i,
    /\b(?:lease\s+expiry|expiry|expires|expiring)\s*[:\-]?\s*([0-3]?\d\s+[A-Za-z]+\s+\d{4}|[A-Za-z]+\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i,
  ];
  for (const pattern of patterns) {
    const label = clean(source.match(pattern)?.[1] ?? "");
    const date = parseDateLabel(label);
    if (date) return { label, date };
  }
  return undefined;
}

export function extractLeaseLength(text) {
  const source = clean(text);
  const patterns = [
    /\b(?:lease\s+length|lease\s+term|unexpired\s+term|term\s+certain)\D{0,70}(\d+(?:\.\d+)?)\s*(?:years|yrs|year)/i,
    /\bon\s+a\s+(\d+(?:\.\d+)?)\s*(?:year|years|yr|yrs)\s+lease\b/i,
  ];
  for (const pattern of patterns) {
    const parsed = Number(source.match(pattern)?.[1]);
    if (Number.isFinite(parsed) && parsed > 0 && parsed < 250) return Math.round(parsed * 10) / 10;
  }
  return undefined;
}

export function extractRentReviews(text) {
  const source = clean(text);
  const reviews = [];
  const increasePattern = new RegExp(`${MONEY}\\s*(?:pa|per\\s+annum|annum|p\\.?a\\.?)?\\s+in\\s+(20\\d{2})`, "gi");
  for (const match of source.matchAll(increasePattern)) {
    const context = source.slice(Math.max(0, (match.index ?? 0) - 80), Math.min(source.length, (match.index ?? 0) + 120));
    if (!/review|increase|fixed|uplift/i.test(context)) continue;
    const amount = parseMoneyMatch(match[1]);
    const year = Number(match[2]);
    if (amount && year) reviews.push({ year, amount });
  }
  const reviewYears = [...source.matchAll(/\b(?:rent\s+reviews?|reviews?)\D{0,80}\b(20\d{2})\b(?:\D{0,40}\b(20\d{2})\b)?/gi)];
  for (const match of reviewYears) {
    for (const value of [match[1], match[2]]) {
      const year = Number(value);
      if (year && !reviews.some((review) => review.year === year)) reviews.push({ year });
    }
  }
  return [...new Map(reviews.map((review) => [`${review.year}:${review.amount ?? ""}`, review])).values()]
    .sort((a, b) => a.year - b.year);
}

export function hasExtractableInvestmentFacts(text) {
  const facts = extractInvestmentFacts({ text });
  return Boolean(facts.tenantName || facts.passingRent || facts.leaseLength || facts.leaseExpiryText || facts.rentReviewDates.length);
}

function flattenText(value) {
  if (Array.isArray(value)) return value.map(flattenText).filter(Boolean).join(" ");
  if (typeof value === "string" || typeof value === "number") return clean(value);
  if (value && typeof value === "object") {
    return Object.values(value).map(flattenText).filter(Boolean).join(" ");
  }
  return "";
}

function inferCovenantStrength(tenantName, text) {
  if (!tenantName) return undefined;
  if (/\b(asda|tesco|sainsbury|morrisons|aldi|lidl|boots|coop|co-op|b&m|marks\s*&\s*spencer|m&s|national retailer|government|nhs)\b/i.test(`${tenantName} ${text}`)) {
    return "Strong";
  }
  if (/\bplc\b/i.test(tenantName)) return "Good";
  return "Moderate";
}

function parseDateLabel(label) {
  const text = clean(label);
  const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) return validDate(Date.UTC(Number(slash[3]), Number(slash[2]) - 1, Number(slash[1])));
  const withDay = text.match(/^([0-3]?\d)\s+([A-Za-z]+)\s+(\d{4})$/);
  if (withDay) {
    const month = MONTHS[withDay[2].toLowerCase()];
    if (month !== undefined) return validDate(Date.UTC(Number(withDay[3]), month, Number(withDay[1])));
  }
  const monthYear = text.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (monthYear) {
    const month = MONTHS[monthYear[1].toLowerCase()];
    if (month !== undefined) return validDate(Date.UTC(Number(monthYear[2]), month + 1, 0));
  }
  return undefined;
}

function validDate(ms) {
  const date = new Date(ms);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

function yearsUntil(date, now) {
  const years = (date.getTime() - now.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return years > 0 && years < 250 ? Math.round(years * 10) / 10 : undefined;
}

function parseMoneyMatch(value) {
  if (!value) return undefined;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined;
}

function isUsefulTenant(value) {
  return Boolean(value && value.length > 2 && !/unknown|vacant|not\s+available|tenant|current/i.test(value));
}

function trimFact(value) {
  return clean(value)
    .replace(/\s+\([^)]+$/, "")
    .replace(/\b(no\s+breaks?|breaks?)\b.*$/i, "")
    .replace(/\b(?:producing|at|on|until|for|with|subject|from)\b.*$/i, "")
    .replace(/[-–|]+$/g, "")
    .trim();
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}
