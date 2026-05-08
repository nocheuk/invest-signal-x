import { describe, expect, it } from "vitest";
import { dedupeImportRows, findDuplicate, mapImportToDealInsert, normalizeImportRow, parseDealCsv } from "@/lib/imports/dealImport";

describe("deal import mapping", () => {
  it("parses CSV rows and normalizes aliases", () => {
    const rows = parseDealCsv("Title,Location,Price,URL\nTesco Express,\"Sheffield, S10\",1950000,https://example.com/a");
    expect(rows).toHaveLength(1);
    expect(rows[0].normalized).toMatchObject({
      title: "Tesco Express",
      location: "Sheffield, S10",
      guidePrice: 1950000,
      sourceUrl: "https://example.com/a",
      postcode: "S10",
    });
    expect(rows[0].validationErrors).toEqual([]);
  });

  it("returns validation errors for bad rows", () => {
    const row = normalizeImportRow({ title: "", location: "", guide_price: "0", source_url: "not-a-url" });
    expect(row.validationErrors).toEqual([
      "title is required",
      "location is required",
      "guide_price must be greater than 0",
      "source_url must start with http:// or https://",
    ]);
  });

  it("maps a valid row to a deal insert shape", () => {
    const row = normalizeImportRow({
      external_id: "lot-1",
      title: "Industrial Estate",
      location: "Wakefield, WF2",
      guide_price: "6400000",
      passing_rent: "512000",
      sqft: "78500",
      asset_type: "Industrial",
    });

    const deal = mapImportToDealInsert(row.normalized, "CSV upload");
    expect(deal).toMatchObject({
      id: expect.stringMatching(/^imp-/),
      title: "Industrial Estate",
      asset_type: "Industrial",
      guide_price: 6400000,
      source: "Private treaty",
    });
    expect(deal.score).toBeGreaterThan(0);
  });
});

describe("deal import dedupe", () => {
  const existing = [{
    id: "deal-1",
    title: "Tesco Express Investment",
    location: "Sheffield, S10",
    guidePrice: 1950000,
    sourceUrl: "https://example.com/deals/tesco",
  }];

  it("dedupes by source URL first", () => {
    const row = normalizeImportRow({
      title: "Different title",
      location: "Leeds, LS1",
      guide_price: "1000000",
      source_url: "https://example.com/deals/tesco",
    });
    expect(findDuplicate(row.normalized, existing)).toEqual({ dealId: "deal-1", rule: "source_url" });
  });

  it("dedupes by title and postcode", () => {
    const row = normalizeImportRow({
      title: "Tesco Express Investment",
      location: "Sheffield S10",
      guide_price: "2000000",
    });
    expect(findDuplicate(row.normalized, existing)).toEqual({ dealId: "deal-1", rule: "title_postcode" });
  });

  it("dedupes by title, guide price and location", () => {
    const row = normalizeImportRow({
      title: "Tesco Express Investment",
      location: "Sheffield",
      guide_price: "1950000",
    });
    expect(findDuplicate(row.normalized, [{ ...existing[0], location: "Sheffield" }])).toEqual({ dealId: "deal-1", rule: "title_price_location" });
  });

  it("keeps the first valid source-row occurrence for duplicate import identities", () => {
    const invalid = normalizeImportRow({
      external_id: "rm-1",
      title: "Missing price",
      location: "Bournemouth, BH1",
      guide_price: "0",
    }, 2);
    const valid = normalizeImportRow({
      external_id: "rm-1",
      title: "Valid price",
      location: "Bournemouth, BH1",
      guide_price: "1200000",
    }, 3);
    const laterDuplicate = normalizeImportRow({
      external_id: "rm-1",
      title: "Later duplicate",
      location: "Bournemouth, BH1",
      guide_price: "1250000",
    }, 4);

    const result = dedupeImportRows([invalid, valid, laterDuplicate]);

    expect(result.uniqueRows.map((row) => row.rowNumber)).toEqual([3]);
    expect(result.duplicateRows.map((duplicate) => duplicate.row.rowNumber)).toEqual([2, 4]);
    expect(result.duplicateRows[0]).toMatchObject({ duplicateOfRowNumber: 3, rule: "external_id" });
    expect(result.duplicateRows[1]).toMatchObject({ duplicateOfRowNumber: 3, rule: "external_id" });
  });
});
