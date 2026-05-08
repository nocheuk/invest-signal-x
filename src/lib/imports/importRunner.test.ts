import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeImportRow } from "@/lib/imports/dealImport";
import { runDealImport } from "../../../scripts/lib/importRunner.mjs";

describe("deal import runner", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not require or call Supabase in dry-run mode", async () => {
    const rows = [
      normalizeImportRow({
        external_id: "rightmove-1",
        source_url: "https://example.com/1",
        title: "Bournemouth Retail Investment",
        location: "Bournemouth, BH1",
        guide_price: "1000000",
      }, 1),
      normalizeImportRow({
        external_id: "rightmove-2",
        source_url: "https://example.com/2",
        title: "Bournemouth Retail Investment",
        location: "Bournemouth, BH1",
        guide_price: "1100000",
      }, 2),
    ];
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const result = await runDealImport({
      rows,
      sourceName: "Rightmove Commercial Bournemouth",
      sourceType: "apify_rightmove_commercial",
      dryRun: true,
    });

    expect(result).toMatchObject({
      source: "Rightmove Commercial Bournemouth",
      dryRun: true,
      total: 2,
      unique: 2,
      processed: 1,
      failed: 0,
      skipped_duplicate: 1,
    });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('"source": "Rightmove Commercial Bournemouth"'));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('"dryRun": true'));
  });

  it("returns the provided source name in live-mode validation errors", async () => {
    await expect(runDealImport({
      rows: [normalizeImportRow({
        external_id: "rightmove-1",
        title: "Bournemouth Retail Investment",
        location: "Bournemouth, BH1",
        guide_price: "1000000",
      }, 1)],
      sourceName: "Rightmove Commercial Bournemouth",
      sourceType: "apify_rightmove_commercial",
      dryRun: false,
    })).rejects.toThrow("VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  });
});
