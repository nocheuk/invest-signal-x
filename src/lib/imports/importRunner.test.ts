import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeImportRow } from "@/lib/imports/dealImport";
import { runDealImport } from "../../../scripts/lib/importRunner.mjs";

const supabaseMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: supabaseMocks.createClient,
}));

describe("deal import runner", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    supabaseMocks.createClient.mockReset();
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
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

  it("refreshes duplicate source_url image payloads without creating another deal", async () => {
    process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    const mock = createImportSupabaseMock();
    supabaseMocks.createClient.mockReturnValue(mock.client);
    const rows = [
      normalizeImportRow({
        external_id: "acuitus-1",
        source_url: "https://www.acuitus.co.uk/property/5760/",
        image_url: "https://www.acuitus.co.uk/images/property-5760.jpg",
        title: "Office Investment",
        location: "London W1J 7EE",
        guide_price: "5250000",
      }, 1),
    ];

    const result = await runDealImport({
      rows,
      sourceName: "Acuitus",
      sourceType: "custom_html_scraper",
      dryRun: false,
    });

    expect(result).toMatchObject({ inserted: 0, existing: 1, skipped_duplicate: 1 });
    expect(mock.calls.dealUpserts).toEqual([]);
    expect(mock.calls.dealUpdates).toEqual([
      expect.objectContaining({
        title: "Office Investment",
        thumbnail: "https://www.acuitus.co.uk/images/property-5760.jpg",
      }),
    ]);
    expect(mock.calls.rawInserts).toHaveLength(1);
    expect(mock.calls.rawInserts[0]).toMatchObject({
      source_url: "https://www.acuitus.co.uk/property/5760/",
      status: "skipped_duplicate",
      normalized_payload: expect.objectContaining({
        imageUrl: "https://www.acuitus.co.uk/images/property-5760.jpg",
      }),
    });
    expect(mock.calls.linkUpdates).toEqual([
      expect.objectContaining({
        deal_id: "existing-deal-1",
        raw_import_id: "raw-new-image",
        source_url: "https://www.acuitus.co.uk/property/5760/",
      }),
    ]);
    expect(mock.calls.rawUpdates).toEqual([
      expect.objectContaining({
        status: "skipped_duplicate",
        deal_id: "existing-deal-1",
        error_message: "Duplicate by source_url",
      }),
    ]);
  });

  it("refreshes duplicate Allsop source URLs without creating another deal", async () => {
    process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    const mock = createImportSupabaseMock();
    supabaseMocks.createClient.mockReturnValue(mock.client);
    const rows = [
      normalizeImportRow({
        external_id: "CI00436",
        source_url: "https://www.allsop.co.uk/investment-overview/rare-opportunity-in-wembley/ci00436",
        image_url: "https://www.allsop.co.uk/api/image/allsop-image/703/527",
        title: "Rare Opportunity to Acquire an Ultra Urban Industrial Sale and Leaseback",
        location: "265 Water Road, Wembley HA0 1HX",
        guide_price: "4500000",
      }, 1),
    ];

    const result = await runDealImport({
      rows,
      sourceName: "Allsop",
      sourceType: "auction_scraper",
      dryRun: false,
    });

    expect(result).toMatchObject({ inserted: 0, existing: 1, skipped_duplicate: 1 });
    expect(mock.calls.dealUpserts).toEqual([]);
    expect(mock.calls.dealUpdates).toEqual([
      expect.objectContaining({
        title: "Rare Opportunity to Acquire an Ultra Urban Industrial Sale and Leaseback",
        thumbnail: "https://www.allsop.co.uk/api/image/allsop-image/703/527",
      }),
    ]);
    expect(mock.calls.linkUpdates[0]).toMatchObject({
      deal_id: "existing-allsop-1",
      raw_import_id: "raw-new-image",
      source_url: "https://www.allsop.co.uk/investment-overview/rare-opportunity-in-wembley/ci00436",
    });
  });

  it("rejects unsafe guide prices before Supabase deal writes", async () => {
    process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    const mock = createImportSupabaseMock();
    supabaseMocks.createClient.mockReturnValue(mock.client);
    const unsafeRow = normalizeImportRow({
      external_id: "rightmove-overflow",
      source_url: "https://www.rightmove.co.uk/properties/350000030203#/?channel=COM_BUY",
      title: "Bournemouth Retail Investment",
      location: "Bournemouth, BH1",
      guide_price: "350000030203",
    }, 1);

    const result = await runDealImport({
      rows: [unsafeRow],
      sourceName: "Rightmove Commercial",
      sourceType: "custom_rightmove_commercial",
      dryRun: false,
    });

    expect(result).toMatchObject({ inserted: 0, existing: 0, failed: 1 });
    expect(mock.calls.dealUpserts).toEqual([]);
    expect(mock.calls.dealUpdates).toEqual([]);
    expect(mock.calls.rawInserts[0]).toMatchObject({
      status: "failed",
      normalized_payload: expect.not.objectContaining({ guidePrice: 350000030203 }),
      validation_errors: expect.arrayContaining(["guide_price must be a safe integer between 1000 and 500000000"]),
    });
  });

  it("does not refresh duplicate deals with unsafe guide prices", async () => {
    process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    const mock = createImportSupabaseMock();
    supabaseMocks.createClient.mockReturnValue(mock.client);
    const unsafeDuplicate = normalizeImportRow({
      external_id: "acuitus-1",
      source_url: "https://www.acuitus.co.uk/property/5760/",
      image_url: "https://www.acuitus.co.uk/images/property-5760.jpg",
      title: "Office Investment",
      location: "London W1J 7EE",
      guide_price: "350000030203",
    }, 1);

    const result = await runDealImport({
      rows: [unsafeDuplicate],
      sourceName: "Acuitus",
      sourceType: "custom_html_scraper",
      dryRun: false,
    });

    expect(result).toMatchObject({ inserted: 0, existing: 0, failed: 1, skipped_duplicate: 0 });
    expect(mock.calls.dealUpserts).toEqual([]);
    expect(mock.calls.dealUpdates).toEqual([]);
    expect(mock.calls.linkUpdates).toEqual([]);
    expect(mock.calls.rawInserts[0]).toMatchObject({
      status: "failed",
      validation_errors: expect.arrayContaining(["guide_price must be a safe integer between 1000 and 500000000"]),
    });
  });

  it("sanitizes unsafe area values before Supabase writes", async () => {
    process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    const mock = createImportSupabaseMock();
    supabaseMocks.createClient.mockReturnValue(mock.client);
    const row = normalizeImportRow({
      external_id: "rightmove-area-overflow",
      source_url: "https://www.rightmove.co.uk/properties/174711599#/?channel=COM_BUY",
      title: "Telecom House",
      location: "Bournemouth, BH8 8EJ",
      guide_price: "3500000",
      sqft: "350000030203",
    }, 1);

    const result = await runDealImport({
      rows: [row],
      sourceName: "Rightmove Commercial",
      sourceType: "custom_rightmove_commercial",
      dryRun: false,
    });

    expect(result).toMatchObject({ inserted: 1, failed: 0 });
    expect(mock.calls.dealUpserts[0]).toMatchObject({ guide_price: 3500000, sqft: 0 });
    expect(mock.calls.rawInserts[0]).toMatchObject({
      normalized_payload: expect.not.objectContaining({ sqft: 350000030203 }),
    });
  });
});

function createImportSupabaseMock() {
  const calls = {
    dealUpserts: [] as unknown[],
    rawInserts: [] as unknown[],
    rawUpdates: [] as unknown[],
    linkUpdates: [] as unknown[],
    linkInserts: [] as unknown[],
    dealUpdates: [] as unknown[],
  };

  const client = {
    from: vi.fn((table: string) => {
      if (table === "import_sources") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { id: "source-1", name: "Acuitus", source_type: "custom_html_scraper" }, error: null }),
              }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: async () => ({ data: { id: "source-1" }, error: null }),
            }),
          }),
        };
      }

      if (table === "import_runs") {
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({ data: { id: "run-1" }, error: null }),
            }),
          }),
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        };
      }

      if (table === "deals") {
        return {
          select: async () => ({
            data: [
              { id: "existing-deal-1", title: "Office Investment", location: "London W1J 7EE", guide_price: 5250000 },
              { id: "existing-allsop-1", title: "Rare Opportunity to Acquire an Ultra Urban Industrial Sale and Leaseback", location: "265 Water Road, Wembley HA0 1HX", guide_price: 4500000 },
            ],
            error: null,
          }),
          upsert: (payload: unknown) => {
            calls.dealUpserts.push(payload);
            return Promise.resolve({ error: null });
          },
          update: (payload: unknown) => {
            calls.dealUpdates.push(payload);
            return {
              eq: async () => ({ error: null }),
            };
          },
        };
      }

      if (table === "raw_imports") {
        return {
          insert: (payload: unknown) => {
            calls.rawInserts.push(payload);
            return {
              select: () => ({
                single: async () => ({ data: { id: "raw-new-image" }, error: null }),
              }),
            };
          },
          update: (payload: unknown) => {
            calls.rawUpdates.push(payload);
            return {
              eq: async () => ({ error: null }),
            };
          },
        };
      }

      if (table === "deal_source_links") {
        return {
          select: (columns: string) => {
            if (columns.includes("deal_id")) {
              return {
                not: async () => ({
                  data: [
                    { deal_id: "existing-deal-1", source_url: "https://www.acuitus.co.uk/property/5760/" },
                    { deal_id: "existing-allsop-1", source_url: "https://www.allsop.co.uk/investment-overview/rare-opportunity-in-wembley/ci00436" },
                  ],
                  error: null,
                }),
              };
            }
            return {
              eq: () => ({
                maybeSingle: async () => ({ data: { id: "link-1" }, error: null }),
              }),
            };
          },
          update: (payload: unknown) => {
            calls.linkUpdates.push(payload);
            return {
              eq: async () => ({ error: null }),
            };
          },
          insert: (payload: unknown) => {
            calls.linkInserts.push(payload);
            return Promise.resolve({ error: null });
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };

  return { client, calls };
}
