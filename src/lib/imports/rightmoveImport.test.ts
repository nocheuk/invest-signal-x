import fixture from "../../../test/fixtures/rightmove-commercial-items.json";
import { describe, expect, it } from "vitest";
import { dedupeImportRows } from "@/lib/imports/dealImport";
import { mapRightmoveItemToImportRow, mapRightmoveItemsToImportRows } from "@/lib/imports/rightmoveImport";

describe("Rightmove Apify import mapping", () => {
  it("maps Apify Rightmove items into normalized import rows", () => {
    const rows = mapRightmoveItemsToImportRows(fixture);

    expect(rows[0].normalized).toMatchObject({
      externalId: "148450001",
      sourceUrl: "https://www.rightmove.co.uk/properties/148450001#/?channel=COM_BUY",
      title: "Trade Counter Investment",
      location: "Leeds, LS11",
      postcode: "LS11",
      assetType: "Industrial",
      source: "Private treaty",
      guidePrice: 1750000,
      passingRent: 118000,
      sqft: 8500,
    });
    expect(rows[0].validationErrors).toEqual([]);
  });

  it("surfaces missing required fields as validation errors", () => {
    const row = mapRightmoveItemToImportRow({
      propertyId: "missing-fields",
      propertyUrl: "/properties/missing-fields",
      displayAddress: "",
      price: "",
    });

    expect(row.normalized.sourceUrl).toBe("https://www.rightmove.co.uk/properties/missing-fields");
    expect(row.validationErrors).toContain("location is required");
    expect(row.validationErrors).toContain("guide_price must be greater than 0");
  });

  it("dedupes duplicate Apify items before raw imports are inserted", () => {
    const rows = mapRightmoveItemsToImportRows(fixture);
    const result = dedupeImportRows(rows);

    expect(rows).toHaveLength(3);
    expect(result.uniqueRows).toHaveLength(2);
    expect(result.duplicateRows).toHaveLength(1);
    expect(result.duplicateRows[0]).toMatchObject({
      duplicateOfRowNumber: 1,
      rule: "external_id",
      key: "148450001",
    });
  });
});
