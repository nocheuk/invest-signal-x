import { parseArgs, readStringArg } from "./lib/env.mjs";
import { ENGLAND_NATIONAL_SCAN_LOCATIONS } from "./lib/englandLocationQueue.mjs";
import { buildRightmoveCommercialSearchUrl } from "./lib/rightmoveLocationSearch.mjs";
import {
  extractRightmovePaginationUrls,
  scrapeRightmoveCommercialHtmlToImportRows,
} from "./lib/rightmoveCommercialScraper.mjs";

const USER_AGENT = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  "AppleWebKit/537.36 (KHTML, like Gecko)",
  "Chrome/125.0.0.0 Safari/537.36",
].join(" ");

export async function validateRightmoveLocations({
  locations = ENGLAND_NATIONAL_SCAN_LOCATIONS,
  fetchImpl = fetch,
  maxPages = 2,
  delayMs = 250,
  logger = console.log,
} = {}) {
  const results = [];
  for (const location of locations) {
    const result = await validateRightmoveLocation({ location, fetchImpl, maxPages });
    results.push(result);
    logger(JSON.stringify(result));
    if (delayMs > 0) await sleep(delayMs);
  }
  const report = summarizeRightmoveValidation(results);
  logger(JSON.stringify(report, null, 2));
  return { results, report };
}

export async function validateRightmoveLocation({ location, fetchImpl = fetch, maxPages = 2 } = {}) {
  const generatedUrl = buildRightmoveCommercialSearchUrl(location);
  try {
    const firstPage = await fetchRightmoveDiagnosticPage({ url: generatedUrl, fetchImpl });
    const pageUrls = firstPage.ok
      ? [generatedUrl, ...safePaginationUrls({ html: firstPage.html, pageUrl: firstPage.finalUrl || generatedUrl, maxPages })]
      : [generatedUrl];
    const pages = [firstPage];
    for (const pageUrl of pageUrls.slice(1)) {
      pages.push(await fetchRightmoveDiagnosticPage({ url: pageUrl, fetchImpl }));
    }

    const parse = parseDiagnosticPages({ pages, generatedUrl, location });
    const status = classifyValidationResult({ firstPage, parse, generatedUrl });
    return {
      location,
      generatedUrl,
      httpStatus: firstPage.status,
      finalUrl: firstPage.finalUrl,
      status,
      hasPropertyCards: pages.some((page) => page.hasPropertyCards),
      listingsFound: parse.listingsFound,
      pagesChecked: pages.length,
      parserResult: parse.error ? "failed" : "parsed",
      error: parse.error,
    };
  } catch (error) {
    return {
      location,
      generatedUrl,
      httpStatus: 0,
      finalUrl: generatedUrl,
      status: "parser_failure",
      hasPropertyCards: false,
      listingsFound: 0,
      pagesChecked: 0,
      parserResult: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function summarizeRightmoveValidation(results) {
  const counts = results.reduce((acc, result) => {
    acc[result.status] = (acc[result.status] || 0) + 1;
    return acc;
  }, {});
  const validLocations = results.filter((result) => ["valid", "redirect"].includes(result.status));
  return {
    totalLocations: results.length,
    totalValidLocations: validLocations.length,
    totalInvalidLocations: results.length - validLocations.length,
    expectedReachableListingCount: results.reduce((total, result) => total + result.listingsFound, 0),
    byStatus: {
      valid: counts.valid || 0,
      redirect: counts.redirect || 0,
      empty: counts.empty || 0,
      parser_failure: counts.parser_failure || 0,
      location_not_supported: counts.location_not_supported || 0,
    },
  };
}

async function fetchRightmoveDiagnosticPage({ url, fetchImpl }) {
  const response = await fetchImpl(url, {
    redirect: "follow",
    headers: {
      "user-agent": USER_AGENT,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-GB,en;q=0.9",
      "cache-control": "no-cache",
    },
  });
  const html = await response.text();
  return {
    url,
    status: response.status,
    ok: response.ok,
    finalUrl: response.url || url,
    html,
    hasPropertyCards: /propertyCard|data-testid=["'][^"']*property|\/properties\//i.test(html),
    title: html.match(/<title[^>]*>([^<]+)/i)?.[1] ?? "",
  };
}

function parseDiagnosticPages({ pages, generatedUrl, location }) {
  let listingsFound = 0;
  for (const page of pages) {
    if (!page.ok) continue;
    try {
      const rows = scrapeRightmoveCommercialHtmlToImportRows({
        html: page.html,
        pageUrl: page.finalUrl || generatedUrl,
        sourceName: "Rightmove Commercial",
      });
      listingsFound += rows.length;
    } catch (error) {
      if (page.hasPropertyCards) {
        return {
          listingsFound,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  }
  return { listingsFound, error: null, location };
}

function classifyValidationResult({ firstPage, parse, generatedUrl }) {
  if (!firstPage.ok) return firstPage.status === 404 ? "location_not_supported" : "parser_failure";
  if (/\/page-not-found\/?$/i.test(new URL(firstPage.finalUrl).pathname)) return "location_not_supported";
  if (parse.error) return "parser_failure";
  if (parse.listingsFound === 0) return firstPage.hasPropertyCards ? "parser_failure" : "empty";
  if (normalizeUrl(firstPage.finalUrl) !== normalizeUrl(generatedUrl)) return "redirect";
  return "valid";
}

function safePaginationUrls({ html, pageUrl, maxPages }) {
  try {
    return extractRightmovePaginationUrls({ html, pageUrl, maxPages });
  } catch {
    return [];
  }
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return String(url ?? "");
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isDirectRun() {
  return process.argv[1]?.replace(/\\/g, "/").endsWith("/scripts/validate-rightmove-locations.mjs");
}

if (isDirectRun()) {
  const args = parseArgs(process.argv.slice(2));
  const limit = Number(readStringArg(args, "limit") || ENGLAND_NATIONAL_SCAN_LOCATIONS.length);
  const maxPages = Number(readStringArg(args, "max-pages") || 2);
  const delayMs = Number(readStringArg(args, "delay-ms") || 250);
  const locations = ENGLAND_NATIONAL_SCAN_LOCATIONS.slice(0, Math.max(0, limit));
  validateRightmoveLocations({ locations, maxPages, delayMs }).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
